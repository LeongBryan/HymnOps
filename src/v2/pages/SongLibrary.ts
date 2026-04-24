import Fuse from "fuse.js";
import { supabase } from "../../lib/supabase";
import type { SongRow, SongAliasRow, SongWriterRow, SongThemeRow } from "../../lib/supabase";
import { withPublicPage } from "../auth";
import { createElement } from "../../utils";
import { toAppHref } from "../../router";

interface SongSearchItem extends SongRow {
  aliases: string[];
  writers: string[];
  themes:  string[];
}

function buildSearchItem(
  song: SongRow,
  aliases: SongAliasRow[],
  writers: SongWriterRow[],
  themes:  SongThemeRow[]
): SongSearchItem {
  return {
    ...song,
    aliases: aliases.filter((a) => a.song_id === song.id).map((a) => a.alias),
    writers: writers.filter((w) => w.song_id === song.id).map((w) => w.writer_name),
    themes:  themes.filter((t) => t.song_id === song.id).map((t) => t.theme)
  };
}

function applySort(items: SongSearchItem[], sort: string): SongSearchItem[] {
  const sorted = [...items];
  if (sort === "title-asc") {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === "title-desc") {
    sorted.sort((a, b) => b.title.localeCompare(a.title));
  } else if (sort === "artist-asc") {
    sorted.sort((a, b) => {
      const aA = a.original_artist_name ?? "";
      const bA = b.original_artist_name ?? "";
      if (!aA && !bA) return 0;
      if (!aA) return 1;
      if (!bA) return -1;
      return aA.localeCompare(bA);
    });
  } else if (sort === "newest") {
    sorted.sort((a, b) =>
      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    );
  }
  return sorted;
}

function renderSongList(
  items: SongSearchItem[],
  navigate: (path: string) => void
): HTMLElement {
  if (items.length === 0) {
    return createElement("p", "empty-state", "No songs match your search.");
  }

  const list = createElement("ul", "v2-song-list");
  for (const song of items) {
    const li = createElement("li", "v2-song-item");

    const titleRow = createElement("div", "v2-song-item-top");
    const titleLink = createElement("a", "list-primary") as HTMLAnchorElement;
    titleLink.href = toAppHref(`/songs/${song.slug}/edit`);
    titleLink.textContent = song.title;
    titleLink.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(`/songs/${song.slug}/edit`);
    });

    const statusChip = createElement("span", `chip ${song.status === "archive" ? "chip-muted" : ""}`, song.status);
    titleRow.append(titleLink, statusChip);

    const meta = createElement("p", "list-secondary");
    const parts: string[] = [];
    if (song.writers.length > 0) parts.push(song.writers.join(", "));
    if (song.original_artist_name) parts.push(`orig. ${song.original_artist_name}`);
    if (song.default_key) parts.push(`key: ${song.default_key}`);
    if (song.ccli_number) parts.push(`CCLI ${song.ccli_number}`);
    meta.textContent = parts.join(" · ") || "No metadata";

    li.append(titleRow, meta);

    if (song.aliases.length > 0) {
      li.appendChild(createElement("p", "list-secondary", `aka: ${song.aliases.join(", ")}`));
    }
    if (song.themes.length > 0) {
      const themeRow = createElement("div", "chip-row v2-song-themes");
      song.themes.forEach((t) => themeRow.appendChild(createElement("span", "chip", t)));
      li.appendChild(themeRow);
    }

    list.appendChild(li);
  }
  return list;
}

export function SongLibraryPage(navigate: (path: string) => void): HTMLElement {
  const page = createElement("div", "page");

  const headerRow = createElement("div", "v2-page-header");
  headerRow.appendChild(createElement("h1", undefined, "Song Library"));
  page.appendChild(headerRow);

  // ── Search ───────────────────────────────────────────────────────────────────
  const searchWrap = createElement("div", "search-bar");
  searchWrap.appendChild(createElement("label", "search-bar-label", "Search songs"));
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.className = "search-input";
  searchInput.placeholder = "Title, alias, writer, artist, CCLI, theme…";
  searchWrap.appendChild(searchInput);

  // ── Status filter ────────────────────────────────────────────────────────────
  const statusWrap = createElement("div", "control-field");
  statusWrap.appendChild(createElement("label", "filter-label", "Status"));
  const statusSelect = document.createElement("select");
  statusSelect.className = "filter-input";
  [["all", "All statuses"], ["active", "Active only"], ["archive", "Archive only"]].forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val; opt.textContent = label;
    statusSelect.appendChild(opt);
  });
  statusWrap.appendChild(statusSelect);

  // ── Theme filter (populated after load) ──────────────────────────────────────
  const themeWrap = createElement("div", "control-field");
  themeWrap.appendChild(createElement("label", "filter-label", "Theme"));
  const themeSelect = document.createElement("select");
  themeSelect.className = "filter-input";
  const themeAllOpt = document.createElement("option");
  themeAllOpt.value = ""; themeAllOpt.textContent = "All themes";
  themeSelect.appendChild(themeAllOpt);
  themeWrap.appendChild(themeSelect);

  // ── Sort ─────────────────────────────────────────────────────────────────────
  const sortWrap = createElement("div", "control-field");
  sortWrap.appendChild(createElement("label", "filter-label", "Sort"));
  const sortSelect = document.createElement("select");
  sortSelect.className = "filter-input";
  [
    ["title-asc",  "Title A→Z"],
    ["title-desc", "Title Z→A"],
    ["artist-asc", "Artist A→Z"],
    ["newest",     "Newest first"]
  ].forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val; opt.textContent = label;
    sortSelect.appendChild(opt);
  });
  sortWrap.appendChild(sortSelect);

  const toolbar = createElement("div", "song-top-bar browse-toolbar");
  toolbar.append(searchWrap, statusWrap, themeWrap, sortWrap);
  page.appendChild(toolbar);

  const countEl = createElement("p", "results-summary");
  const listContainer = createElement("div", "song-results");
  listContainer.appendChild(createElement("p", "empty-state", "Loading…"));
  page.append(countEl, listContainer);

  withPublicPage(page, async (isAuthenticated) => {
    if (isAuthenticated) {
      const addBtn = createElement("button", "button-primary", "+ Add song") as HTMLButtonElement;
      addBtn.type = "button";
      addBtn.addEventListener("click", () => navigate("/songs/new"));
      headerRow.appendChild(addBtn);
    }

    const [songsRes, aliasesRes, writersRes, themesRes] = await Promise.all([
      supabase.from("songs").select("*").order("title"),
      supabase.from("song_aliases").select("*"),
      supabase.from("song_writers").select("*"),
      supabase.from("song_themes").select("*")
    ]);

    if (songsRes.error) throw songsRes.error;

    const allThemeRows = themesRes.data ?? [];

    // Populate theme dropdown
    const uniqueThemes = [...new Set(allThemeRows.map((t) => t.theme))].sort();
    uniqueThemes.forEach((theme) => {
      const opt = document.createElement("option");
      opt.value = theme; opt.textContent = theme;
      themeSelect.appendChild(opt);
    });

    const allSongs = (songsRes.data ?? []).map((s) =>
      buildSearchItem(s, aliasesRes.data ?? [], writersRes.data ?? [], allThemeRows)
    );

    const fuse = new Fuse(allSongs, {
      keys: ["title", "aliases", "writers", "original_artist_name", "ccli_number", "default_key", "themes"],
      threshold: 0.35,
      includeScore: false
    });

    const render = () => {
      const query        = searchInput.value.trim();
      const statusFilter = statusSelect.value;
      const themeFilter  = themeSelect.value;
      const sortVal      = sortSelect.value;

      let results: SongSearchItem[];
      if (query.length > 0) {
        results = fuse.search(query).map((r) => r.item);
      } else {
        results = applySort([...allSongs], sortVal);
      }

      if (statusFilter !== "all") {
        results = results.filter((s) => s.status === statusFilter);
      }
      if (themeFilter) {
        results = results.filter((s) => s.themes.includes(themeFilter));
      }

      countEl.textContent = `${results.length} song${results.length === 1 ? "" : "s"}`;
      listContainer.innerHTML = "";
      listContainer.appendChild(renderSongList(results, navigate));
    };

    searchInput.addEventListener("input", render);
    statusSelect.addEventListener("change", render);
    themeSelect.addEventListener("change", render);
    sortSelect.addEventListener("change", render);
    render();
  });

  return page;
}
