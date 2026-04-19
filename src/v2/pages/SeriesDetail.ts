import { supabase } from "../../lib/supabase";
import { withAuth } from "../auth";
import { createElement, formatDate } from "../../utils";
import { toAppHref } from "../../router";

export function SeriesDetailPage(
  navigate: (path: string) => void,
  slug: string
): HTMLElement {
  const page = createElement("div", "page");

  const errorEl = createElement("p", "v2-logger-error");
  const content = createElement("div");
  content.appendChild(createElement("p", "empty-state", "Loading…"));
  page.append(errorEl, content);

  withAuth(page, navigate, async () => {
    const { data: series, error: seriesErr } = await supabase
      .from("series")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (seriesErr) throw seriesErr;

    if (!series) {
      content.innerHTML = "";
      content.appendChild(createElement("h1", undefined, "Series not found"));
      content.appendChild(createElement("p", "empty-state", `No series with slug "${slug}".`));
      const back = createElement("button", "button-secondary", "← Series") as HTMLButtonElement;
      back.addEventListener("click", () => navigate("/series"));
      content.appendChild(back);
      return;
    }

    // Load services in this series + their setlists
    const { data: services } = await supabase
      .from("services")
      .select("*")
      .eq("series_id", series.id)
      .order("service_date");

    const serviceIds = (services ?? []).map((sv) => sv.id);

    // Load service_songs + song details for all services in this series
    let serviceSongsWithSongs: Array<{
      service_id: string;
      song_id: string;
      position: number;
      key_override: string | null;
      usage: string | null;
      notes: string | null;
      songs: { id: string; title: string; slug: string } | null;
    }> = [];

    if (serviceIds.length > 0) {
      const { data: ssRows } = await supabase
        .from("service_songs")
        .select("service_id, song_id, position, key_override, usage, notes, songs(id, title, slug)")
        .in("service_id", serviceIds);
      serviceSongsWithSongs = (ssRows ?? []) as typeof serviceSongsWithSongs;
    }

    // Build song usage map for this series
    const songUsage = new Map<string, { title: string; slug: string; count: number }>();
    for (const ss of serviceSongsWithSongs) {
      if (!ss.songs) continue;
      const existing = songUsage.get(ss.song_id);
      if (existing) {
        existing.count++;
      } else {
        songUsage.set(ss.song_id, { title: ss.songs.title, slug: ss.songs.slug, count: 1 });
      }
    }

    // Load themes for all songs in this series
    const songIds = [...songUsage.keys()];
    const themesBySong = new Map<string, string[]>();
    if (songIds.length > 0) {
      const { data: themes } = await supabase
        .from("song_themes")
        .select("song_id, theme")
        .in("song_id", songIds);
      for (const t of themes ?? []) {
        const list = themesBySong.get(t.song_id) ?? [];
        list.push(t.theme);
        themesBySong.set(t.song_id, list);
      }
    }

    // Map song_id → themes for display
    const songThemes = new Map<string, string[]>();
    for (const [songId, usage] of songUsage.entries()) {
      void usage; // just to avoid unused var
      songThemes.set(songId, themesBySong.get(songId) ?? []);
    }

    content.innerHTML = "";

    // ── Header ────────────────────────────────────────────────────────────────
    const headerRow = createElement("div", "v2-page-header");
    headerRow.appendChild(createElement("h1", undefined, series.title));
    const editBtn = createElement("button", "button-secondary", "Edit series") as HTMLButtonElement;
    editBtn.addEventListener("click", () => navigate("/series"));
    headerRow.appendChild(editBtn);
    content.appendChild(headerRow);

    if (series.description) {
      content.appendChild(createElement("p", "page-intro", series.description));
    }

    // Date range from services
    const svcList = services ?? [];
    if (svcList.length > 0) {
      const first = svcList[0].service_date;
      const last  = svcList[svcList.length - 1].service_date;
      const rangeText = first === last ? formatDate(first) : `${formatDate(first)} – ${formatDate(last)}`;
      content.appendChild(createElement("p", "list-secondary", rangeText));
    }

    // ── Services ──────────────────────────────────────────────────────────────
    const svcsBlock = createElement("section", "detail-block");
    svcsBlock.appendChild(createElement("h2", undefined, `Services (${svcList.length})`));

    if (svcList.length === 0) {
      svcsBlock.appendChild(createElement("p", "empty-state", "No services in this series."));
    } else {
      const ul = createElement("ul", "v2-song-list");
      for (const sv of [...svcList].reverse()) {   // most recent first
        const li = createElement("li", "v2-song-item");
        const top = createElement("div", "v2-song-item-top");

        const a = createElement("a", "list-primary", formatDate(sv.service_date)) as HTMLAnchorElement;
        a.href = toAppHref(`/services/${sv.service_date}`);
        a.addEventListener("click", (e) => { e.preventDefault(); navigate(`/services/${sv.service_date}`); });

        const meta = createElement("span", "list-secondary");
        const parts: string[] = [];
        if (sv.sermon_title) parts.push(sv.sermon_title);
        if (sv.speaker) parts.push(sv.speaker);
        const songCount = serviceSongsWithSongs.filter((ss) => ss.service_id === sv.id).length;
        parts.push(`${songCount} song${songCount === 1 ? "" : "s"}`);
        meta.textContent = parts.join(" · ");

        top.append(a, meta);
        li.appendChild(top);
        ul.appendChild(li);
      }
      svcsBlock.appendChild(ul);
    }
    content.appendChild(svcsBlock);

    // ── Songs in this series ──────────────────────────────────────────────────
    const songsBlock = createElement("section", "detail-block");
    const songRows = [...songUsage.entries()]
      .map(([id, u]) => ({ id, ...u, themes: (themesBySong.get(id) ?? []).join(", ") || "—" }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

    songsBlock.appendChild(createElement("h2", undefined, `Songs sung (${songRows.length} unique)`));

    if (songRows.length === 0) {
      songsBlock.appendChild(createElement("p", "empty-state", "No songs recorded for this series."));
    } else {
      const table = createElement("table", "data-table");
      table.innerHTML = "<thead><tr><th>Song</th><th>Times sung</th><th>Themes</th></tr></thead>";
      const tbody = createElement("tbody");
      for (const row of songRows) {
        const tr = createElement("tr");

        const songTd = createElement("td");
        const a = createElement("a", "list-primary", row.title) as HTMLAnchorElement;
        a.href = toAppHref(`/songs/${row.slug}/edit`);
        a.addEventListener("click", (e) => { e.preventDefault(); navigate(`/songs/${row.slug}/edit`); });
        songTd.appendChild(a);

        const countTd = createElement("td", undefined, String(row.count));
        const themesTd = createElement("td", "list-secondary", row.themes);

        tr.append(songTd, countTd, themesTd);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      songsBlock.appendChild(table);
    }
    content.appendChild(songsBlock);

    // ── Back ──────────────────────────────────────────────────────────────────
    const backBtn = createElement("button", "button-secondary", "← All Series") as HTMLButtonElement;
    backBtn.addEventListener("click", () => navigate("/series"));
    content.appendChild(backBtn);
  });

  return page;
}
