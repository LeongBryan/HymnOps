#!/usr/bin/env python3
"""
Populate song metadata from CCLI's public Rehearse API.

This fills missing fields in songs/*.md frontmatter:
- ccli_number
- songselect_url
- lyrics_source
- original_artist
- writers
- tempo_bpm
- key
- time_signature

It intentionally does not overwrite existing non-empty values.
"""

from __future__ import annotations

import json
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests


ROOT = Path(__file__).resolve().parents[1]
SONGS_DIR = ROOT / "songs"
REHEARSE_API_URL = "https://rehearse-api.ccli.com/api/songs"
SONGSELECT_SEARCH_URL = "https://songselect.ccli.com/api/GetSongSearchResults"
SONGSELECT_DETAILS_URL = "https://songselect.ccli.com/api/GetSongDetails"
COUNTRY = "US"
TIMEOUT = 20
SLEEP_SECONDS = 0.08

KEY_ORDER = [
    "title",
    "slug",
    "aka",
    "ccli_number",
    "songselect_url",
    "lyrics_source",
    "lyrics_hint",
    "original_artist",
    "writers",
    "publisher",
    "year",
    "tempo_bpm",
    "key",
    "time_signature",
    "congregational_fit",
    "vocal_range",
    "dominant_themes",
    "doctrinal_categories",
    "emotional_tone",
    "scriptural_anchors",
    "theological_summary",
    "arrangement_notes",
    "slides_path",
    "tags",
    "last_sung_override",
    "status",
    "licensing_notes",
    "language",
    "meter",
]


def normalize(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"\(.*?\)", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def parse_scalar(raw: str) -> Any:
    text = raw.strip()
    if text == "null":
        return None
    if text == "[]":
        return []
    if text == "true":
        return True
    if text == "false":
        return False
    if re.fullmatch(r"-?\d+", text):
        return int(text)
    if re.fullmatch(r"-?\d+\.\d+", text):
        return float(text)
    if len(text) >= 2 and text[0] == '"' and text[-1] == '"':
        return text[1:-1].replace(r"\"", '"')
    if len(text) >= 2 and text[0] == "'" and text[-1] == "'":
        return text[1:-1].replace("\\'", "'")
    return text


def quote_yaml(text: str) -> str:
    escaped = text.replace("\\", "\\\\").replace('"', r"\"")
    return f'"{escaped}"'


def dump_scalar(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)
    if isinstance(value, str):
        return quote_yaml(value)
    raise TypeError(f"Unsupported scalar type: {type(value)!r}")


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if text.startswith("\ufeff"):
        text = text.lstrip("\ufeff")
    if not text.startswith("---\n"):
        raise ValueError("File does not start with frontmatter")
    end_idx = text.find("\n---\n", 4)
    if end_idx == -1:
        raise ValueError("Frontmatter closing delimiter not found")

    fm_block = text[4:end_idx]
    body = text[end_idx + 5 :]
    lines = fm_block.splitlines()

    data: dict[str, Any] = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue

        m = re.match(r"^([A-Za-z0-9_]+):\s*(.*)$", line)
        if not m:
            i += 1
            continue

        key = m.group(1)
        remainder = m.group(2)

        if remainder == "":
            items: list[Any] = []
            j = i + 1
            while j < len(lines):
                lm = re.match(r"^\s*-\s*(.*)$", lines[j])
                if not lm:
                    break
                items.append(parse_scalar(lm.group(1)))
                j += 1
            data[key] = items
            i = j
            continue

        data[key] = parse_scalar(remainder)
        i += 1

    return data, body


def dump_frontmatter(data: dict[str, Any]) -> str:
    keys = []
    for key in KEY_ORDER:
        if key in data:
            keys.append(key)
    for key in data.keys():
        if key not in keys:
            keys.append(key)

    out: list[str] = ["---"]
    for key in keys:
        value = data[key]
        if isinstance(value, list):
            if not value:
                out.append(f"{key}: []")
            else:
                out.append(f"{key}:")
                for item in value:
                    if item is None:
                        out.append("  - null")
                    elif isinstance(item, (int, float, bool)):
                        out.append(f"  - {dump_scalar(item)}")
                    else:
                        out.append(f"  - {quote_yaml(str(item))}")
        else:
            out.append(f"{key}: {dump_scalar(value)}")
    out.append("---")
    return "\n".join(out) + "\n"


def normalize_musical_key(value: str | None) -> str | None:
    if not value:
        return None
    key = value.strip()
    if not key:
        return None
    letter = key[0].upper()
    rest = key[1:]
    return letter + rest


def query_rehearse(session: requests.Session, query: str) -> list[dict[str, Any]]:
    params = {
        "search": query,
        "page": "1",
        "limit": "20",
        "countrycode": COUNTRY,
    }
    response = session.get(REHEARSE_API_URL, params=params, timeout=TIMEOUT)
    response.raise_for_status()
    payload = response.json().get("payload") or []
    if not isinstance(payload, list):
        return []
    return payload


@dataclass
class Candidate:
    score: float
    item: dict[str, Any]
    query: str
    source: str


def rank_candidates(song_title: str, query: str, payload: list[dict[str, Any]], source: str) -> list[Candidate]:
    title_norm = normalize(song_title)
    query_norm = normalize(query)
    candidates: list[Candidate] = []

    for item in payload:
        result_title = str(item.get("title") or "").strip()
        if not result_title:
            continue

        result_norm = normalize(result_title)
        if source == "songselect":
            ccli_number = str(item.get("songNumber") or "").strip()
        else:
            ccli_number = ((item.get("otherIds") or {}).get("ccliSongNumber") or "").strip()

        score = 0.0
        if result_norm == title_norm:
            score += 120.0
        elif result_norm and title_norm and (result_norm in title_norm or title_norm in result_norm):
            score += 70.0

        if result_norm == query_norm:
            score += 40.0
        elif result_norm and query_norm and (result_norm in query_norm or query_norm in result_norm):
            score += 20.0

        api_score = item.get("score")
        if isinstance(api_score, (int, float)):
            score += float(api_score) * 8.0

        if ccli_number:
            score += 8.0

        source_label = str(item.get("sourceLabel") or "")
        if source_label.lower() == "original master":
            score += 4.0

        length_delta = abs(len(result_norm) - len(title_norm))
        score -= min(length_delta, 20) * 0.6

        candidates.append(Candidate(score=score, item=item, query=query, source=source))

    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates


def query_songselect_search(session: requests.Session, query: str) -> list[dict[str, Any]]:
    data = {
        "numPerPage": "25",
        "search": query,
        "page": "1",
    }
    headers = {
        "client-locale": "en-US",
    }
    response = session.post(SONGSELECT_SEARCH_URL, data=data, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    payload = response.json().get("payload") or {}
    items = payload.get("items") or []
    if not isinstance(items, list):
        return []
    return items


def get_songselect_details(session: requests.Session, song_number: str, slug: str) -> dict[str, Any] | None:
    if not song_number:
        return None
    params = {
        "songNumber": song_number,
        "slug": slug or "",
    }
    headers = {
        "client-locale": "en-US",
    }
    try:
        response = session.get(SONGSELECT_DETAILS_URL, params=params, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException:
        return None
    payload = response.json().get("payload")
    if isinstance(payload, dict):
        return payload
    return None


def extract_songselect_authors(item: dict[str, Any]) -> list[str]:
    out: list[str] = []
    raw_authors = item.get("authors") or []
    if isinstance(raw_authors, list):
        for author in raw_authors:
            if isinstance(author, dict):
                label = str(author.get("label") or "").strip()
                if label:
                    out.append(label)
            else:
                text = str(author).strip()
                if text:
                    out.append(text)
    deduped: list[str] = []
    seen: set[str] = set()
    for name in out:
        key = normalize(name)
        if key and key not in seen:
            seen.add(key)
            deduped.append(name)
    return deduped


def query_rehearse_by_ccli(session: requests.Session, ccli_number: str) -> dict[str, Any] | None:
    if not ccli_number:
        return None
    params = {
        "cclisongnumber": ccli_number,
        "page": "1",
        "limit": "5",
        "countrycode": COUNTRY,
    }
    try:
        response = session.get(REHEARSE_API_URL, params=params, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException:
        return None
    payload = response.json().get("payload") or []
    if not isinstance(payload, list) or not payload:
        return None
    return payload[0]


def pick_best_match(session: requests.Session, title: str, aka: list[str]) -> Candidate | None:
    queries = [title]
    bare = re.sub(r"\(.*?\)", "", title).strip()
    if bare and bare.lower() != title.lower():
        queries.append(bare)
    for alt in aka:
        alt = (alt or "").strip()
        if alt and alt not in queries:
            queries.append(alt)

    best: Candidate | None = None
    seen_queries: set[str] = set()
    for query in queries:
        qnorm = normalize(query)
        if not qnorm or qnorm in seen_queries:
            continue
        seen_queries.add(qnorm)

        # Primary source: SongSelect search endpoint.
        try:
            songselect_items = query_songselect_search(session, query)
        except requests.RequestException:
            songselect_items = []
        if songselect_items:
            candidates = rank_candidates(title, query, songselect_items, "songselect")
            if candidates:
                top = candidates[0]
                if best is None or top.score > best.score:
                    best = top

        # Secondary source: Rehearse catalog.
        if best is None or best.score < 90.0:
            try:
                rehearse_items = query_rehearse(session, query)
            except requests.RequestException:
                rehearse_items = []
            if rehearse_items:
                candidates = rank_candidates(title, query, rehearse_items, "rehearse")
                if candidates:
                    top = candidates[0]
                    if best is None or top.score > best.score:
                        best = top

        time.sleep(SLEEP_SECONDS)

    if best is None:
        return None

    # Conservative threshold to avoid bad auto-matches on generic titles.
    if best.score < 78.0:
        return None

    return best


def main() -> int:
    files = sorted(
        [p for p in SONGS_DIR.glob("*.md") if not p.name.startswith("_")],
        key=lambda p: p.name,
    )
    if not files:
        print("No song files found.")
        return 0

    session = requests.Session()
    session.headers.update({"User-Agent": "HymnOps-Importer/1.0"})

    updated = 0
    skipped_with_data = 0
    no_match: list[str] = []
    matched_summary: list[dict[str, Any]] = []

    for path in files:
        text = path.read_text(encoding="utf-8")
        data, body = parse_frontmatter(text)

        title = str(data.get("title") or "").strip()
        slug = str(data.get("slug") or path.stem).strip()
        aka = data.get("aka") if isinstance(data.get("aka"), list) else []
        aka = [str(x) for x in aka if x is not None]

        if not title:
            no_match.append(f"{path.name} (missing title)")
            continue

        has_ccli = isinstance(data.get("ccli_number"), str) and bool(str(data.get("ccli_number")).strip())
        has_writers = isinstance(data.get("writers"), list) and len(data.get("writers")) > 0
        has_url = isinstance(data.get("songselect_url"), str) and bool(str(data.get("songselect_url")).strip())
        if has_ccli and has_writers and has_url:
            skipped_with_data += 1
            continue

        best = pick_best_match(session, title, aka)
        if best is None:
            no_match.append(path.name)
            continue

        item = best.item
        result_title = str(item.get("title") or title).strip()
        authors: list[str] = []
        artist_name = ""
        bpm: Any = None
        key: str | None = None
        time_sig = ""

        if best.source == "songselect":
            ccli_number = str(item.get("songNumber") or "").strip()
            details = get_songselect_details(session, ccli_number, str(item.get("slug") or "").strip())
            if details:
                result_title = str(details.get("title") or result_title).strip()
                detail_num = str(details.get("ccliSongNumber") or "").strip()
                if detail_num:
                    ccli_number = detail_num
                authors = extract_songselect_authors(details)
            else:
                authors = extract_songselect_authors(item)

            rehearse = query_rehearse_by_ccli(session, ccli_number)
            if rehearse:
                artist_name = str(rehearse.get("artistName") or "").strip()
                bpm = rehearse.get("bpm")
                key = normalize_musical_key(str(rehearse.get("key") or "").strip())
                time_sig = str(rehearse.get("timeSignature") or "").strip()
        else:
            other_ids = item.get("otherIds") or {}
            ccli_number = str(other_ids.get("ccliSongNumber") or "").strip()
            authors = [str(a).strip() for a in (item.get("authors") or []) if str(a).strip()]
            artist_name = str(item.get("artistName") or "").strip()
            bpm = item.get("bpm")
            key = normalize_musical_key(str(item.get("key") or "").strip())
            time_sig = str(item.get("timeSignature") or "").strip()

            # SongSelect is the canonical metadata source; prefer its title/authors when available.
            if ccli_number:
                details = get_songselect_details(session, ccli_number, slug)
                if details:
                    result_title = str(details.get("title") or result_title).strip()
                    detail_authors = extract_songselect_authors(details)
                    if detail_authors:
                        authors = detail_authors

        changed = False

        if ccli_number and (data.get("ccli_number") is None or str(data.get("ccli_number")).strip() == ""):
            data["ccli_number"] = ccli_number
            changed = True

        if ccli_number and (data.get("songselect_url") is None or str(data.get("songselect_url")).strip() == ""):
            data["songselect_url"] = f"https://songselect.ccli.com/songs/{ccli_number}/{slug}"
            changed = True

        lyrics_source = str(data.get("lyrics_source") or "").strip()
        if ccli_number and (lyrics_source == "" or lyrics_source == "Unknown"):
            data["lyrics_source"] = "SongSelect"
            changed = True

        if artist_name and (data.get("original_artist") is None or str(data.get("original_artist")).strip() == ""):
            data["original_artist"] = artist_name
            changed = True

        if authors and (not isinstance(data.get("writers"), list) or len(data.get("writers")) == 0):
            data["writers"] = authors
            changed = True

        if isinstance(bpm, (int, float)) and data.get("tempo_bpm") is None:
            data["tempo_bpm"] = int(round(float(bpm)))
            changed = True

        if key and (data.get("key") is None or str(data.get("key")).strip() == ""):
            data["key"] = key
            changed = True

        if time_sig and (data.get("time_signature") is None or str(data.get("time_signature")).strip() == ""):
            data["time_signature"] = time_sig
            changed = True

        if changed:
            frontmatter = dump_frontmatter(data)
            path.write_text(frontmatter + body, encoding="utf-8")
            updated += 1

        matched_summary.append(
            {
                "file": path.name,
                "title": title,
                "matched_title": result_title,
                "ccli_number": ccli_number,
                "score": round(best.score, 2),
                "query": best.query,
                "source": best.source,
            }
        )

    report_path = ROOT / "imports" / "2024-ccli-enrichment-report.json"
    report = {
        "updated_files": updated,
        "skipped_already_populated": skipped_with_data,
        "unmatched_count": len(no_match),
        "unmatched_files": no_match,
        "matches": matched_summary,
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"updated_files={updated}")
    print(f"skipped_already_populated={skipped_with_data}")
    print(f"unmatched_count={len(no_match)}")
    print(f"report={report_path}")
    if no_match:
        print("unmatched_sample=" + ", ".join(no_match[:15]))

    return 0


if __name__ == "__main__":
    sys.exit(main())
