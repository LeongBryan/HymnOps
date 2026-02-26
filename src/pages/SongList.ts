import Fuse from "fuse.js";
import { FilterPanel, defaultSongFilters, type SongFilters } from "../components/FilterPanel";
import { SearchBar } from "../components/SearchBar";
import { SongCard } from "../components/SongCard";
import type { PageContext, Song } from "../types";
import { createElement, weeksSince } from "../utils";

type SortMode = "alpha" | "most-sung" | "least-recent" | "highest-fit";

function applySongFilters(songs: Song[], filters: SongFilters, songYearsBySlug: Map<string, Set<number>>): Song[] {
  return songs.filter((song) => {
    if (filters.status !== "all" && song.status !== filters.status) return false;

    if (filters.themes.length > 0 && !filters.themes.every((theme) => song.dominant_themes.includes(theme))) {
      return false;
    }
    if (filters.doctrines.length > 0 && !filters.doctrines.every((doc) => song.doctrinal_categories.includes(doc))) {
      return false;
    }
    if (filters.tones.length > 0 && !filters.tones.every((tone) => song.emotional_tone.includes(tone))) {
      return false;
    }

    if (filters.scriptureText.trim().length > 0) {
      const needle = filters.scriptureText.trim().toLowerCase();
      const hay = song.scriptural_anchors.join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (filters.keyText.trim().length > 0) {
      const needle = filters.keyText.trim().toLowerCase();
      if (!(song.key ?? "").toLowerCase().includes(needle)) return false;
    }

    if (filters.fitMin > 0 && (song.congregational_fit ?? 0) < filters.fitMin) return false;
    if (filters.tempoMin !== null && (song.tempo_bpm ?? -1) < filters.tempoMin) return false;
    if (filters.tempoMax !== null && (song.tempo_bpm ?? Number.POSITIVE_INFINITY) > filters.tempoMax) return false;

    if (filters.notSungWeeks > 0) {
      const weeks = weeksSince(song.last_sung_computed);
      if (weeks !== null && weeks < filters.notSungWeeks) return false;
    }

    if (filters.serviceYears.length > 0) {
      const years = songYearsBySlug.get(song.slug);
      if (!years || years.size === 0) return false;

      const matches =
        filters.serviceYearMode === "all"
          ? filters.serviceYears.every((year) => years.has(year))
          : filters.serviceYears.some((year) => years.has(year));
      if (!matches) return false;
    }

    return true;
  });
}

function sortSongs(songs: Song[], mode: SortMode): Song[] {
  const sorted = [...songs];
  switch (mode) {
    case "most-sung":
      sorted.sort((a, b) => b.times_sung - a.times_sung || a.title.localeCompare(b.title));
      break;
    case "least-recent":
      sorted.sort((a, b) => {
        const aWeeks = weeksSince(a.last_sung_computed) ?? Number.POSITIVE_INFINITY;
        const bWeeks = weeksSince(b.last_sung_computed) ?? Number.POSITIVE_INFINITY;
        return bWeeks - aWeeks || a.title.localeCompare(b.title);
      });
      break;
    case "highest-fit":
      sorted.sort((a, b) => (b.congregational_fit ?? 0) - (a.congregational_fit ?? 0) || a.title.localeCompare(b.title));
      break;
    case "alpha":
    default:
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }
  return sorted;
}

export function SongListPage(ctx: PageContext): HTMLElement {
  const page = createElement("div", "page songs-page");
  page.appendChild(createElement("h1", undefined, "Songs"));

  const controls = createElement("section", "song-controls");
  const resultsWrap = createElement("section", "song-results");
  page.append(controls, resultsWrap);

  const themes = [...new Set(ctx.data.songs.flatMap((song) => song.dominant_themes))].sort((a, b) => a.localeCompare(b));
  const doctrines = [...new Set(ctx.data.songs.flatMap((song) => song.doctrinal_categories))].sort((a, b) => a.localeCompare(b));
  const tones = [...new Set(ctx.data.songs.flatMap((song) => song.emotional_tone))].sort((a, b) => a.localeCompare(b));
  const availableServiceYears = [
    ...new Set(
      ctx.data.services
        .map((service) => Number.parseInt(service.date.slice(0, 4), 10))
        .filter((year) => Number.isFinite(year))
    )
  ].sort((a, b) => b - a);

  const songYearsBySlug = new Map<string, Set<number>>();
  for (const service of ctx.data.services) {
    const year = Number.parseInt(service.date.slice(0, 4), 10);
    if (!Number.isFinite(year)) continue;

    for (const serviceSong of service.songs) {
      const years = songYearsBySlug.get(serviceSong.slug) ?? new Set<number>();
      years.add(year);
      songYearsBySlug.set(serviceSong.slug, years);
    }
  }

  let searchText = "";
  let refocusSearch = false;
  let searchSelectionStart: number | null = null;
  let searchSelectionEnd: number | null = null;
  let filters = defaultSongFilters();
  let sortMode: SortMode = "alpha";

  const fuse = new Fuse(ctx.data.songs, {
    threshold: 0.35,
    keys: [
      "title",
      "aka",
      "ccli_number",
      "writers",
      "original_artist",
      "dominant_themes",
      "doctrinal_categories",
      "scriptural_anchors"
    ]
  });

  const render = () => {
    controls.innerHTML = "";
    resultsWrap.innerHTML = "";

    const topBar = createElement("div", "song-top-bar");
    topBar.appendChild(
      SearchBar({
        placeholder: "title, aka, CCLI, writer, artist, theme, scripture...",
        value: searchText,
        onChange: (next, selectionStart, selectionEnd) => {
          searchText = next;
          refocusSearch = true;
          searchSelectionStart = selectionStart;
          searchSelectionEnd = selectionEnd;
          render();
        }
      })
    );

    const sortField = createElement("label", "sort-field");
    sortField.appendChild(createElement("span", "filter-label", "Sort"));
    const sortSelect = createElement("select", "filter-input") as HTMLSelectElement;
    const sortOptions: Array<{ value: SortMode; label: string }> = [
      { value: "alpha", label: "Alphabetical" },
      { value: "most-sung", label: "Most sung" },
      { value: "least-recent", label: "Least recently sung" },
      { value: "highest-fit", label: "Highest fit" }
    ];
    for (const optionData of sortOptions) {
      const option = createElement("option") as HTMLOptionElement;
      option.value = optionData.value;
      option.textContent = optionData.label;
      option.selected = optionData.value === sortMode;
      sortSelect.appendChild(option);
    }
    sortSelect.addEventListener("change", () => {
      sortMode = sortSelect.value as SortMode;
      render();
    });
    sortField.appendChild(sortSelect);
    topBar.appendChild(sortField);
    controls.appendChild(topBar);

    if (refocusSearch) {
      const input = topBar.querySelector<HTMLInputElement>(".search-input");
      if (input) {
        input.focus();
        if (searchSelectionStart !== null && searchSelectionEnd !== null) {
          input.setSelectionRange(searchSelectionStart, searchSelectionEnd);
        }
      }
      refocusSearch = false;
    }

    controls.appendChild(
      FilterPanel({
        themes,
        doctrines,
        tones,
        serviceYears: availableServiceYears,
        value: filters,
        onChange: (next) => {
          filters = next;
          render();
        }
      })
    );

    const searchedSongs = searchText.trim().length > 0 ? fuse.search(searchText).map((result) => result.item) : ctx.data.songs;
    const filteredSongs = applySongFilters(searchedSongs, filters, songYearsBySlug);
    const sortedSongs = sortSongs(filteredSongs, sortMode);

    const summary = createElement("p", "results-summary", `${sortedSongs.length} song(s)`);
    resultsWrap.appendChild(summary);

    if (sortedSongs.length === 0) {
      resultsWrap.appendChild(createElement("p", "empty-state", "No songs matched these filters."));
      return;
    }

    const list = createElement("div", "song-grid");
    for (const song of sortedSongs) {
      list.appendChild(SongCard(song));
    }
    resultsWrap.appendChild(list);
  };

  render();
  return page;
}
