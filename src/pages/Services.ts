import { SearchBar } from "../components/SearchBar";
import { toAppHref } from "../router";
import type { PageContext, Service } from "../types";
import { createElement, formatDate } from "../utils";

type ServiceViewMode = "tiles" | "list";
type ServiceSortMode =
  | "date-desc"
  | "date-asc"
  | "preacher-asc"
  | "preacher-desc"
  | "series-asc"
  | "series-desc"
  | "sermon-asc"
  | "sermon-desc"
  | "songs-desc"
  | "songs-asc";
type SortDirection = "asc" | "desc" | null;
type ServiceColumnKey = "date" | "sermon" | "preacher" | "series" | "songs";

const DEFAULT_VIEW_MODE: ServiceViewMode = "tiles";
const DEFAULT_SORT_MODE: ServiceSortMode = "date-desc";

function previewSongTitles(songTitleBySlug: Map<string, string>, slugs: string[], limit = 4): string {
  const preview = slugs.slice(0, limit).map((slug) => songTitleBySlug.get(slug) ?? slug);
  return preview.join(", ");
}

function readViewMode(query: URLSearchParams): ServiceViewMode {
  const value = query.get("view");
  return value === "list" || value === "tiles" ? value : DEFAULT_VIEW_MODE;
}

function readSortMode(query: URLSearchParams): ServiceSortMode {
  const value = query.get("sort");
  switch (value) {
    case "date-asc":
    case "preacher-asc":
    case "preacher-desc":
    case "series-asc":
    case "series-desc":
    case "sermon-asc":
    case "sermon-desc":
    case "songs-desc":
    case "songs-asc":
    case "date-desc":
      return value;
    default:
      return DEFAULT_SORT_MODE;
  }
}

function writeBrowseQuery(basePath: string, viewMode: ServiceViewMode, sortMode: ServiceSortMode): void {
  const params = new URLSearchParams(window.location.search);
  if (viewMode === DEFAULT_VIEW_MODE) {
    params.delete("view");
  } else {
    params.set("view", viewMode);
  }

  if (sortMode === DEFAULT_SORT_MODE) {
    params.delete("sort");
  } else {
    params.set("sort", sortMode);
  }

  const nextQuery = params.toString();
  window.history.replaceState({}, "", toAppHref(nextQuery.length > 0 ? `${basePath}?${nextQuery}` : basePath));
}

function compareOptionalText(left: string | null | undefined, right: string | null | undefined): number {
  const a = (left ?? "").trim();
  const b = (right ?? "").trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function sortServices(services: Service[], sortMode: ServiceSortMode, seriesLabelBySlug: Map<string, string>): Service[] {
  const sorted = [...services];
  switch (sortMode) {
    case "date-asc":
      sorted.sort((a, b) => a.date.localeCompare(b.date));
      break;
    case "preacher-asc":
      sorted.sort(
        (a, b) =>
          compareOptionalText(a.preacher, b.preacher) ||
          b.date.localeCompare(a.date)
      );
      break;
    case "preacher-desc":
      sorted.sort(
        (a, b) =>
          compareOptionalText(b.preacher, a.preacher) ||
          b.date.localeCompare(a.date)
      );
      break;
    case "series-asc":
      sorted.sort(
        (a, b) =>
          compareOptionalText(
            a.series_slug ? seriesLabelBySlug.get(a.series_slug) ?? a.series_slug : "",
            b.series_slug ? seriesLabelBySlug.get(b.series_slug) ?? b.series_slug : ""
          ) || b.date.localeCompare(a.date)
      );
      break;
    case "series-desc":
      sorted.sort(
        (a, b) =>
          compareOptionalText(
            b.series_slug ? seriesLabelBySlug.get(b.series_slug) ?? b.series_slug : "",
            a.series_slug ? seriesLabelBySlug.get(a.series_slug) ?? a.series_slug : ""
          ) || b.date.localeCompare(a.date)
      );
      break;
    case "sermon-asc":
      sorted.sort(
        (a, b) =>
          compareOptionalText(a.sermon_title, b.sermon_title) ||
          b.date.localeCompare(a.date)
      );
      break;
    case "sermon-desc":
      sorted.sort(
        (a, b) =>
          compareOptionalText(b.sermon_title, a.sermon_title) ||
          b.date.localeCompare(a.date)
      );
      break;
    case "songs-asc":
      sorted.sort((a, b) => a.songs.length - b.songs.length || b.date.localeCompare(a.date));
      break;
    case "songs-desc":
      sorted.sort((a, b) => b.songs.length - a.songs.length || b.date.localeCompare(a.date));
      break;
    case "date-desc":
    default:
      sorted.sort((a, b) => b.date.localeCompare(a.date));
      break;
  }
  return sorted;
}

function makeViewToggle(
  current: ServiceViewMode,
  onChange: (next: ServiceViewMode) => void
): HTMLElement {
  const field = createElement("div", "control-field");
  field.appendChild(createElement("span", "filter-label", "View"));

  const group = createElement("div", "segmented-control");
  const options: Array<{ value: ServiceViewMode; label: string }> = [
    { value: "tiles", label: "Tiles" },
    { value: "list", label: "List" }
  ];

  for (const optionData of options) {
    const button = createElement(
      "button",
      `segmented-option${optionData.value === current ? " is-active" : ""}`,
      optionData.label
    ) as HTMLButtonElement;
    button.type = "button";
    button.setAttribute("aria-pressed", String(optionData.value === current));
    button.addEventListener("click", () => {
      if (optionData.value !== current) {
        onChange(optionData.value);
      }
    });
    group.appendChild(button);
  }

  field.appendChild(group);
  return field;
}

function makeSortField(
  current: ServiceSortMode,
  onChange: (next: ServiceSortMode) => void
): HTMLElement {
  const field = createElement("label", "control-field sort-field");
  field.appendChild(createElement("span", "filter-label", "Sort"));

  const select = createElement("select", "filter-input") as HTMLSelectElement;
  const options: Array<{ value: ServiceSortMode; label: string }> = [
    { value: "date-desc", label: "Newest date" },
    { value: "date-asc", label: "Oldest date" },
    { value: "preacher-asc", label: "Preacher A-Z" },
    { value: "preacher-desc", label: "Preacher Z-A" },
    { value: "series-asc", label: "Series title A-Z" },
    { value: "series-desc", label: "Series title Z-A" },
    { value: "sermon-asc", label: "Sermon title A-Z" },
    { value: "sermon-desc", label: "Sermon title Z-A" },
    { value: "songs-desc", label: "Most songs" },
    { value: "songs-asc", label: "Fewest songs" }
  ];

  for (const optionData of options) {
    const option = createElement("option") as HTMLOptionElement;
    option.value = optionData.value;
    option.textContent = optionData.label;
    option.selected = optionData.value === current;
    select.appendChild(option);
  }

  select.addEventListener("change", () => {
    onChange(select.value as ServiceSortMode);
  });
  field.appendChild(select);
  return field;
}

function getServiceHeaderState(
  column: ServiceColumnKey,
  sortMode: ServiceSortMode
): { direction: SortDirection; nextSort: ServiceSortMode } {
  switch (column) {
    case "date":
      if (sortMode === "date-desc") return { direction: "desc", nextSort: "date-asc" };
      if (sortMode === "date-asc") return { direction: "asc", nextSort: "date-desc" };
      return { direction: null, nextSort: "date-desc" };
    case "sermon":
      if (sortMode === "sermon-asc") return { direction: "asc", nextSort: "sermon-desc" };
      if (sortMode === "sermon-desc") return { direction: "desc", nextSort: "sermon-asc" };
      return { direction: null, nextSort: "sermon-asc" };
    case "preacher":
      if (sortMode === "preacher-asc") return { direction: "asc", nextSort: "preacher-desc" };
      if (sortMode === "preacher-desc") return { direction: "desc", nextSort: "preacher-asc" };
      return { direction: null, nextSort: "preacher-asc" };
    case "series":
      if (sortMode === "series-asc") return { direction: "asc", nextSort: "series-desc" };
      if (sortMode === "series-desc") return { direction: "desc", nextSort: "series-asc" };
      return { direction: null, nextSort: "series-asc" };
    case "songs":
      if (sortMode === "songs-asc") return { direction: "asc", nextSort: "songs-desc" };
      if (sortMode === "songs-desc") return { direction: "desc", nextSort: "songs-asc" };
      return { direction: null, nextSort: "songs-desc" };
    default:
      return { direction: null, nextSort: DEFAULT_SORT_MODE };
  }
}

function buildSortableHeader(
  label: string,
  state: { direction: SortDirection; nextSort: ServiceSortMode },
  onSortChange: (next: ServiceSortMode) => void
): HTMLTableCellElement {
  const cell = createElement("th");
  cell.setAttribute(
    "aria-sort",
    state.direction === "asc" ? "ascending" : state.direction === "desc" ? "descending" : "none"
  );

  const button = createElement(
    "button",
    `table-sort-button${state.direction ? " is-active" : ""}`
  ) as HTMLButtonElement;
  button.type = "button";
  button.addEventListener("click", () => onSortChange(state.nextSort));

  const labelSpan = createElement("span", "table-sort-label", label);
  const indicator = createElement(
    "span",
    "table-sort-indicator",
    state.direction === "asc" ? "\u2191" : state.direction === "desc" ? "\u2193" : "\u2195"
  );
  indicator.setAttribute("aria-hidden", "true");
  button.append(labelSpan, indicator);
  cell.appendChild(button);
  return cell;
}

function buildSeriesCell(service: Service, seriesTitleBySlug: Map<string, string>): HTMLTableCellElement {
  const cell = createElement("td");
  if (!service.series_slug) {
    cell.appendChild(createElement("div", "list-secondary", "No series"));
    return cell;
  }

  const seriesTitle = seriesTitleBySlug.get(service.series_slug) ?? service.series_slug;
  const link = createElement("a", "list-primary") as HTMLAnchorElement;
  link.href = toAppHref(`/series/${service.series_slug}`);
  link.textContent = seriesTitle;
  cell.appendChild(link);

  if (seriesTitle !== service.series_slug) {
    cell.appendChild(createElement("div", "list-secondary", service.series_slug));
  }
  return cell;
}

function buildServiceList(
  services: Service[],
  seriesTitleBySlug: Map<string, string>,
  songTitleBySlug: Map<string, string>,
  sortMode: ServiceSortMode,
  onSortChange: (next: ServiceSortMode) => void
): HTMLElement {
  const wrapper = createElement("div", "table-wrap");
  const table = createElement("table", "data-table entity-table");
  const thead = createElement("thead");
  const headRow = createElement("tr");
  headRow.append(
    buildSortableHeader("Date", getServiceHeaderState("date", sortMode), onSortChange),
    buildSortableHeader("Sermon", getServiceHeaderState("sermon", sortMode), onSortChange),
    buildSortableHeader("Preacher", getServiceHeaderState("preacher", sortMode), onSortChange),
    buildSortableHeader("Series", getServiceHeaderState("series", sortMode), onSortChange),
    buildSortableHeader("Songs", getServiceHeaderState("songs", sortMode), onSortChange)
  );
  thead.appendChild(headRow);

  const tbody = createElement("tbody");
  for (const service of services) {
    const row = createElement("tr");

    const dateCell = createElement("td");
    const dateLink = createElement("a", "list-primary") as HTMLAnchorElement;
    dateLink.href = toAppHref(`/services/${service.date}`);
    dateLink.textContent = formatDate(service.date);
    dateCell.appendChild(dateLink);
    row.appendChild(dateCell);

    const sermonCell = createElement("td");
    sermonCell.appendChild(createElement("div", "list-primary", service.sermon_title ?? "Untitled sermon"));
    if (service.sermon_text) {
      sermonCell.appendChild(createElement("div", "list-secondary", service.sermon_text));
    }
    row.appendChild(sermonCell);

    const preacherCell = createElement("td");
    preacherCell.appendChild(createElement("div", "list-primary", service.preacher ?? "Unknown preacher"));
    row.appendChild(preacherCell);

    row.appendChild(buildSeriesCell(service, seriesTitleBySlug));

    const songCell = createElement("td");
    songCell.appendChild(createElement("div", "list-primary", `${service.songs.length} song(s)`));
    if (service.songs.length > 0) {
      const preview = previewSongTitles(
        songTitleBySlug,
        service.songs.map((item) => item.slug),
        3
      );
      songCell.appendChild(
        createElement(
          "div",
          "list-secondary",
          `${preview}${service.songs.length > 3 ? ", ..." : ""}`
        )
      );
    }
    row.appendChild(songCell);

    tbody.appendChild(row);
  }

  table.append(thead, tbody);
  wrapper.appendChild(table);
  return wrapper;
}

export function ServicesPage(ctx: PageContext, query: URLSearchParams): HTMLElement {
  const page = createElement("div", "page services-page");
  page.appendChild(createElement("h1", undefined, "Services"));

  if (ctx.data.services.length === 0) {
    page.appendChild(createElement("p", "empty-state", "No services found."));
    return page;
  }

  const seriesTitleBySlug = new Map(ctx.data.series.map((series) => [series.slug, series.title]));
  const songTitleBySlug = new Map(ctx.data.songs.map((song) => [song.slug, song.title]));

  let searchText = "";
  let viewMode = readViewMode(query);
  let sortMode = readSortMode(query);
  let refocusSearch = false;
  let searchSelectionStart: number | null = null;
  let searchSelectionEnd: number | null = null;
  const controls = createElement("section", "song-controls");
  const results = createElement("section", "song-results");
  page.append(controls, results);

  const render = () => {
    controls.innerHTML = "";
    results.innerHTML = "";

    const topBar = createElement("div", "song-top-bar browse-toolbar");
    topBar.appendChild(
      SearchBar({
        placeholder: "date, sermon, preacher, series, or song...",
        value: searchText,
        onChange: (value, selectionStart, selectionEnd) => {
          searchText = value;
          refocusSearch = true;
          searchSelectionStart = selectionStart;
          searchSelectionEnd = selectionEnd;
          render();
        }
      })
    );

    const toolbarCluster = createElement("div", "toolbar-cluster");
    toolbarCluster.append(
      makeViewToggle(viewMode, (next) => {
        viewMode = next;
        writeBrowseQuery("/services", viewMode, sortMode);
        render();
      }),
      makeSortField(sortMode, (next) => {
        sortMode = next;
        writeBrowseQuery("/services", viewMode, sortMode);
        render();
      })
    );
    topBar.appendChild(toolbarCluster);
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

    const needle = searchText.trim().toLowerCase();
    const filtered = needle.length === 0
      ? ctx.data.services
      : ctx.data.services.filter((service) => {
          const seriesTitle = service.series_slug
            ? seriesTitleBySlug.get(service.series_slug) ?? service.series_slug
            : "";
          const songTitles = service.songs
            .map((item) => songTitleBySlug.get(item.slug) ?? item.slug)
            .join(" ");
          const haystack = [
            service.date,
            formatDate(service.date),
            service.sermon_title ?? "",
            service.sermon_text ?? "",
            service.preacher ?? "",
            service.series_slug ?? "",
            seriesTitle,
            songTitles
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(needle);
        });
    const sorted = sortServices(filtered, sortMode, seriesTitleBySlug);

    results.appendChild(createElement("p", "results-summary", `${sorted.length} service(s)`));

    if (sorted.length === 0) {
      results.appendChild(createElement("p", "empty-state", "No services matched this search."));
      return;
    }

    if (viewMode === "list") {
      results.appendChild(
        buildServiceList(sorted, seriesTitleBySlug, songTitleBySlug, sortMode, (next) => {
          sortMode = next;
          writeBrowseQuery("/services", viewMode, sortMode);
          render();
        })
      );
      return;
    }

    const grid = createElement("div", "entity-grid");
    for (const service of sorted) {
      const card = createElement("article", "entity-card");
      const title = createElement("h3", "entity-title");
      const link = createElement("a") as HTMLAnchorElement;
      link.href = toAppHref(`/services/${service.date}`);
      link.textContent = formatDate(service.date);
      title.appendChild(link);

      const sermonLine = createElement("p", "entity-meta", service.sermon_title ?? "Untitled sermon");

      const seriesLabel = service.series_slug
        ? seriesTitleBySlug.get(service.series_slug) ?? service.series_slug
        : null;
      const preacherLineParts = [service.preacher ?? "Unknown preacher"];
      if (seriesLabel) {
        preacherLineParts.push(seriesLabel);
      }
      const preacherSeries = createElement("p", "entity-subline", preacherLineParts.join(" | "));

      const songCount = service.songs.length;
      const preview = previewSongTitles(
        songTitleBySlug,
        service.songs.map((item) => item.slug)
      );
      const songsLine = createElement(
        "p",
        "entity-preview",
        songCount > 0
          ? `${songCount} song(s): ${preview}${songCount > 4 ? ", ..." : ""}`
          : "No songs recorded."
      );

      card.append(title, sermonLine, preacherSeries, songsLine);
      grid.appendChild(card);
    }
    results.appendChild(grid);
  };

  render();
  return page;
}
