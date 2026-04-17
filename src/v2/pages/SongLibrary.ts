import Fuse from "fuse.js";
import { supabase } from "../../lib/supabase";
import type { SongRow, SongAliasRow, SongWriterRow } from "../../lib/supabase";
import { withAuth } from "../auth";
import { createElement } from "../../utils";
import { toAppHref } from "../../router";

interface SongSearchItem extends SongRow {
  aliases:     string[];
  writers:     string[];
}

function buildSearchItem(
  song: SongRow,
  aliases: SongAliasRow[],
  writers: SongWriterRow[]
): SongSearchItem {
  return {
    ...song,
    aliases: aliases.filter((a) => a.song_id === song.id).map((a) => a.alias),
    writers: writers.filter((w) => w.song_id === song.id).map((w) => w.writer_name)
  };
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
    titleLink.href = toAppHref(`/v2/songs/${song.slug}/edit`);
    titleLink.textContent = song.title;
    titleLink.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(`/v2/songs/${song.slug}/edit`);
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

    if (song.aliases.length > 0) {
      const akaEl = createElement("p", "list-secondary", `aka: ${song.aliases.join(", ")}`);
      li.append(titleRow, meta, akaEl);
    } else {
      li.append(titleRow, meta);
    }

    list.appendChild(li);
  }
  return list;
}

export function SongLibraryPage(navigate: (path: string) => void): HTMLElement {
  const page = createElement("div", "page");

  const headerRow = createElement("div", "v2-page-header");
  headerRow.appendChild(createElement("h1", undefined, "Song Library"));
  const addBtn = createElement("button", "button-primary", "+ Add song") as HTMLButtonElement;
  addBtn.type = "button";
  addBtn.addEventListener("click", () => navigate("/v2/songs/new"));
  headerRow.appendChild(addBtn);
  page.appendChild(headerRow);

  const searchWrap = createElement("div", "search-bar");
  searchWrap.appendChild(createElement("label", "search-bar-label", "Search songs"));
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.className = "search-input";
  searchInput.placeholder = "Title, alias, writer, artist, CCLI, scripture…";
  searchWrap.appendChild(searchInput);

  const statusWrap = createElement("div", "control-field");
  statusWrap.appendChild(createElement("label", "filter-label", "Status"));
  const statusSelect = document.createElement("select");
  statusSelect.className = "filter-input";
  [["all", "All"], ["active", "Active only"], ["archive", "Archive only"]].forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    statusSelect.appendChild(opt);
  });
  statusWrap.appendChild(statusSelect);

  const toolbar = createElement("div", "song-top-bar browse-toolbar");
  toolbar.append(searchWrap, statusWrap);
  page.appendChild(toolbar);

  const countEl = createElement("p", "results-summary");
  const listContainer = createElement("div", "song-results");
  listContainer.appendChild(createElement("p", "empty-state", "Loading…"));
  page.append(countEl, listContainer);

  withAuth(page, navigate, async () => {
    // Load all songs + aliases + writers in parallel
    const [songsRes, aliasesRes, writersRes] = await Promise.all([
      supabase.from("songs").select("*").order("title"),
      supabase.from("song_aliases").select("*"),
      supabase.from("song_writers").select("*")
    ]);

    if (songsRes.error) throw songsRes.error;

    const allSongs = (songsRes.data ?? []).map((s) =>
      buildSearchItem(s, aliasesRes.data ?? [], writersRes.data ?? [])
    );

    const fuse = new Fuse(allSongs, {
      keys: ["title", "aliases", "writers", "original_artist_name", "ccli_number", "default_key"],
      threshold: 0.35,
      includeScore: false
    });

    const render = () => {
      const query = searchInput.value.trim();
      const statusFilter = statusSelect.value;

      let results = query.length > 0 ? fuse.search(query).map((r) => r.item) : [...allSongs];

      if (statusFilter !== "all") {
        results = results.filter((s) => s.status === statusFilter);
      }

      countEl.textContent = `${results.length} song${results.length === 1 ? "" : "s"}`;
      listContainer.innerHTML = "";
      listContainer.appendChild(renderSongList(results, navigate));
    };

    searchInput.addEventListener("input", render);
    statusSelect.addEventListener("change", render);
    render();
  });

  return page;
}
