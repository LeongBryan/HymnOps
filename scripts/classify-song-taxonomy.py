#!/usr/bin/env python3
"""
Populate dominant_themes and doctrinal_categories in songs/*.md.

This classifier uses title/alias heuristics and controlled vocab from TAXONOMY.md.
It intentionally avoids storing any lyrics text.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SONGS_DIR = ROOT / "songs"

THEME_VOCAB = {
    "Adoration",
    "Awe",
    "Confession",
    "Repentance",
    "Assurance",
    "Grace",
    "Mercy",
    "Holiness",
    "Sovereignty",
    "Providence",
    "Faithfulness",
    "Covenant",
    "Identity in Christ",
    "Union with Christ",
    "Discipleship",
    "Mission",
    "Evangelism",
    "Justice",
    "Compassion",
    "Lament",
    "Suffering",
    "Hope",
    "Resurrection",
    "Second Coming",
    "Kingdom of God",
    "Cross",
    "Atonement",
    "Forgiveness",
    "Sanctification",
    "Spiritual Warfare",
    "Prayer",
    "Thanksgiving",
    "Joy",
    "Peace",
    "Contentment",
    "Guidance",
    "Communion",
    "Baptism",
    "Creation",
    "Stewardship",
    "Community",
    "Sending",
}

DOCTRINE_VOCAB = {
    "Trinity",
    "Christology",
    "Pneumatology",
    "Soteriology",
    "Ecclesiology",
    "Eschatology",
    "Sanctification",
    "Scripture",
    "Lament",
    "Mission",
    "Prayer",
    "Worship",
    "Sacraments",
    "Providence",
}

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
    keys: list[str] = []
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


def add_unique(target: list[str], value: str) -> None:
    if value not in target:
        target.append(value)


def add_if_match(target: list[str], text: str, pattern: str, values: list[str]) -> None:
    if re.search(pattern, text):
        for value in values:
            add_unique(target, value)


def infer_themes(title: str, aka: list[str], existing: list[str]) -> list[str]:
    text = normalize(" ".join([title] + aka))
    themes: list[str] = []

    for item in existing:
        if item in THEME_VOCAB:
            add_unique(themes, item)

    add_if_match(
        themes,
        text,
        r"\b(cross|calvary|blood|redeemer|redeemed|paid it all|nothing but the blood|finished upon that cross|sorrows|lamb)\b",
        ["Cross", "Atonement", "Grace", "Forgiveness"],
    )
    add_if_match(
        themes,
        text,
        r"\b(risen|resurrection|living hope|he lives|roll is called up yonder)\b",
        ["Resurrection", "Hope", "Assurance"],
    )
    add_if_match(
        themes,
        text,
        r"\b(noel|emmanuel|bethlehem|angels we have heard|hark the herald|o holy night|silent night|what child|joy has dawned|christmas)\b",
        ["Hope", "Joy", "Adoration"],
    )
    add_if_match(
        themes,
        text,
        r"\b(holy|holiness|purify|refiner|sanctif)\b",
        ["Holiness", "Sanctification", "Awe"],
    )
    add_if_match(
        themes,
        text,
        r"\b(king|throne|lord of lords|majesty|almighty|reign|crown him|sovereign)\b",
        ["Kingdom of God", "Sovereignty", "Adoration"],
    )
    add_if_match(
        themes,
        text,
        r"\b(praise|rejoice|celebrate|hallelujah|thanks|thanksgiving|glorified|bless)\b",
        ["Adoration", "Joy", "Thanksgiving"],
    )
    add_if_match(
        themes,
        text,
        r"\b(faith|trust|steadfast|wait|hold me fast|goodness|mercy|through it all|everlasting)\b",
        ["Faithfulness", "Providence", "Assurance"],
    )
    add_if_match(
        themes,
        text,
        r"\b(hope|heaven|yonder|coming)\b",
        ["Hope", "Second Coming"],
    )
    add_if_match(
        themes,
        text,
        r"\b(church|family|one voice|we are one|belong)\b",
        ["Community", "Discipleship"],
    )
    add_if_match(
        themes,
        text,
        r"\b(mission|declare|cause|call|task unfinished|gospel|evangel)\b",
        ["Mission", "Evangelism", "Sending"],
    )
    add_if_match(
        themes,
        text,
        r"\b(prayer|pray)\b",
        ["Prayer"],
    )
    add_if_match(
        themes,
        text,
        r"\b(peace|still my soul|it is well|comfort)\b",
        ["Peace", "Hope"],
    )
    add_if_match(
        themes,
        text,
        r"\b(word|truth|scripture|way)\b",
        ["Guidance", "Discipleship"],
    )
    add_if_match(
        themes,
        text,
        r"\b(love|compassion)\b",
        ["Grace", "Compassion"],
    )
    add_if_match(
        themes,
        text,
        r"\b(take my life|i surrender|just as i am|consecrate)\b",
        ["Repentance", "Discipleship", "Sanctification"],
    )
    add_if_match(
        themes,
        text,
        r"\b(creation|father s world|tree|deer)\b",
        ["Creation", "Providence"],
    )

    if len(themes) < 2:
        add_unique(themes, "Adoration")
    if len(themes) < 2:
        add_unique(themes, "Faithfulness")

    filtered = [t for t in themes if t in THEME_VOCAB]
    return filtered[:4]


def infer_doctrines(title: str, themes: list[str], existing: list[str]) -> list[str]:
    text = normalize(title)
    docs: list[str] = []

    for item in existing:
        if item in DOCTRINE_VOCAB:
            add_unique(docs, item)

    for theme in themes:
        if theme in {"Cross", "Atonement", "Forgiveness", "Grace", "Mercy", "Resurrection", "Assurance"}:
            add_unique(docs, "Soteriology")
        if theme in {"Kingdom of God", "Second Coming", "Hope"}:
            add_unique(docs, "Eschatology")
        if theme in {"Sovereignty", "Providence", "Faithfulness", "Creation"}:
            add_unique(docs, "Providence")
        if theme in {"Discipleship", "Sanctification", "Holiness", "Repentance", "Contentment"}:
            add_unique(docs, "Sanctification")
        if theme in {"Mission", "Evangelism", "Sending"}:
            add_unique(docs, "Mission")
        if theme in {"Prayer"}:
            add_unique(docs, "Prayer")
        if theme in {"Community"}:
            add_unique(docs, "Ecclesiology")
        if theme in {"Communion", "Baptism"}:
            add_unique(docs, "Sacraments")
        if theme in {"Adoration", "Awe", "Joy", "Thanksgiving", "Peace", "Compassion"}:
            add_unique(docs, "Worship")
        if theme in {"Guidance"}:
            add_unique(docs, "Scripture")
        if theme in {"Lament", "Suffering"}:
            add_unique(docs, "Lament")

    if re.search(r"\b(jesus|christ|saviour|lamb|redeemer|cross)\b", text):
        add_unique(docs, "Christology")
    if re.search(r"\b(spirit|holy spirit)\b", text):
        add_unique(docs, "Pneumatology")
    if re.search(r"\b(trinity|father son spirit|holy holy holy)\b", text):
        add_unique(docs, "Trinity")
    if re.search(r"\b(word|truth|scripture|bible)\b", text):
        add_unique(docs, "Scripture")

    if not docs:
        docs = ["Worship"]

    filtered = [d for d in docs if d in DOCTRINE_VOCAB]
    return filtered[:3]


def main() -> int:
    files = sorted([p for p in SONGS_DIR.glob("*.md") if not p.name.startswith("_")], key=lambda p: p.name)
    if not files:
        print("No song files found.")
        return 0

    updated = 0
    for path in files:
        text = path.read_text(encoding="utf-8")
        data, body = parse_frontmatter(text)

        title = str(data.get("title") or "").strip()
        aka_raw = data.get("aka")
        existing_themes = data.get("dominant_themes") if isinstance(data.get("dominant_themes"), list) else []
        existing_docs = data.get("doctrinal_categories") if isinstance(data.get("doctrinal_categories"), list) else []

        aka = [str(x).strip() for x in (aka_raw if isinstance(aka_raw, list) else []) if str(x).strip()]
        themes = infer_themes(title, aka, [str(x) for x in existing_themes if isinstance(x, str)])
        docs = infer_doctrines(title, themes, [str(x) for x in existing_docs if isinstance(x, str)])

        changed = False
        if data.get("dominant_themes") != themes:
            data["dominant_themes"] = themes
            changed = True
        if data.get("doctrinal_categories") != docs:
            data["doctrinal_categories"] = docs
            changed = True

        if changed:
            frontmatter = dump_frontmatter(data)
            path.write_text(frontmatter + body, encoding="utf-8")
            updated += 1

    print(f"updated_files={updated}")
    print(f"total_files={len(files)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
