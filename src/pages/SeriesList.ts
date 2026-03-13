import { SearchBar } from "../components/SearchBar";
import { toAppHref } from "../router";
import type { PageContext, Series } from "../types";
import { createElement, formatDate } from "../utils";

type SeriesViewMode = "tiles" | "list";
type SeriesSortMode =
  | "start-desc"
  | "start-asc"
  | "title-asc"
  | "title-desc"
  | "services-desc"
  | "services-asc"
  | "recommended-desc"
  | "recommended-asc";
type SortDirection = "asc" | "desc" | null;
type SeriesColumnKey = "title" | "range" | "services" | "recommended";

const DEFAULT_VIEW_MODE: SeriesViewMode = "tiles";
const DEFAULT_SORT_MODE: SeriesSortMode = "start-desc";

function readViewMode(query: URLSearchParams): SeriesViewMode {
  const value = query.get("view");
  return value === "list" || value === "tiles" ? value : DEFAULT_VIEW_MODE;
}

function readSortMode(query: URLSearchParams): SeriesSortMode {
  const value = query.get("sort");
  switch (value) {
    case "start-asc":
    case "title-asc":
    case "title-desc":
    case "services-desc":
    case "services-asc":
    case "recommended-desc":
    case "recommended-asc":
    case "start-desc":
      return value;
    default:
      return DEFAULT_SORT_MODE;
  }
}

function writeBrowseQuery(basePath: string, viewMode: SeriesViewMode, sortMode: SeriesSortMode): void {
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

function compareOptionalDate(left: string | null | undefined, right: string | null | undefined): number {
  const a = (left ?? "").trim();
  const b = (right ?? "").trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function formatDateRange(start: string | null, end: string | null): string {
  return start || end ? `${formatDate(start)} to ${formatDate(end)}` : "Open date range";
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function sortSeries(
  seriesItems: Series[],
  sortMode: SeriesSortMode,
  serviceCountBySeries: Map<string, number>
): Series[] {
  const sorted = [...seriesItems];
  switch (sortMode) {
    case "start-asc":
      sorted.sort(
        (a, b) =>
          compareOptionalDate(a.date_range[0], b.date_range[0]) ||
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      );
      break;
    case "title-asc":
      sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
      break;
    case "title-desc":
      sorted.sort((a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: "base" }));
      break;
    case "services-asc":
      sorted.sort(
        (a, b) =>
          (serviceCountBySeries.get(a.slug) ?? 0) - (serviceCountBySeries.get(b.slug) ?? 0) ||
          compareOptionalDate(b.date_range[0], a.date_range[0]) ||
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      );
      break;
    case "services-desc":
      sorted.sort(
        (a, b) =>
          (serviceCountBySeries.get(b.slug) ?? 0) - (serviceCountBySeries.get(a.slug) ?? 0) ||
          compareOptionalDate(b.date_range[0], a.date_range[0]) ||
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      );
      break;
    case "recommended-asc":
      sorted.sort(
        (a, b) =>
          a.recommended.length - b.recommended.length ||
          compareOptionalDate(b.date_range[0], a.date_range[0]) ||
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      );
      break;
    case "recommended-desc":
      sorted.sort(
        (a, b) =>
          b.recommended.length - a.recommended.length ||
          compareOptionalDate(b.date_range[0], a.date_range[0]) ||
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      );
      break;
    case "start-desc":
    default:
      sorted.sort(
        (a, b) =>
          compareOptionalDate(b.date_range[0], a.date_range[0]) ||
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      );
      break;
  }
  return sorted;
}

function makeViewToggle(
  current: SeriesViewMode,
  onChange: (next: SeriesViewMode) => void
): HTMLElement {
  const field = createElement("div", "control-field");
  field.appendChild(createElement("span", "filter-label", "View"));

  const group = createElement("div", "segmented-control");
  const options: Array<{ value: SeriesViewMode; label: string }> = [
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
  current: SeriesSortMode,
  onChange: (next: SeriesSortMode) => void
): HTMLElement {
  const field = createElement("label", "control-field sort-field");
  field.appendChild(createElement("span", "filter-label", "Sort"));

  const select = createElement("select", "filter-input") as HTMLSelectElement;
  const options: Array<{ value: SeriesSortMode; label: string }> = [
    { value: "start-desc", label: "Newest start" },
    { value: "start-asc", label: "Oldest start" },
    { value: "title-asc", label: "Series title A-Z" },
    { value: "title-desc", label: "Series title Z-A" },
    { value: "services-desc", label: "Most services" },
    { value: "services-asc", label: "Fewest services" },
    { value: "recommended-desc", label: "Most recommended songs" },
    { value: "recommended-asc", label: "Fewest recommended songs" }
  ];

  for (const optionData of options) {
    const option = createElement("option") as HTMLOptionElement;
    option.value = optionData.value;
    option.textContent = optionData.label;
    option.selected = optionData.value === current;
    select.appendChild(option);
  }

  select.addEventListener("change", () => {
    onChange(select.value as SeriesSortMode);
  });
  field.appendChild(select);
  return field;
}

function getSeriesHeaderState(
  column: SeriesColumnKey,
  sortMode: SeriesSortMode
): { direction: SortDirection; nextSort: SeriesSortMode } {
  switch (column) {
    case "title":
      if (sortMode === "title-asc") return { direction: "asc", nextSort: "title-desc" };
      if (sortMode === "title-desc") return { direction: "desc", nextSort: "title-asc" };
      return { direction: null, nextSort: "title-asc" };
    case "range":
      if (sortMode === "start-desc") return { direction: "desc", nextSort: "start-asc" };
      if (sortMode === "start-asc") return { direction: "asc", nextSort: "start-desc" };
      return { direction: null, nextSort: "start-desc" };
    case "services":
      if (sortMode === "services-asc") return { direction: "asc", nextSort: "services-desc" };
      if (sortMode === "services-desc") return { direction: "desc", nextSort: "services-asc" };
      return { direction: null, nextSort: "services-desc" };
    case "recommended":
      if (sortMode === "recommended-asc") return { direction: "asc", nextSort: "recommended-desc" };
      if (sortMode === "recommended-desc") return { direction: "desc", nextSort: "recommended-asc" };
      return { direction: null, nextSort: "recommended-desc" };
    default:
      return { direction: null, nextSort: DEFAULT_SORT_MODE };
  }
}

function buildSortableHeader(
  label: string,
  state: { direction: SortDirection; nextSort: SeriesSortMode },
  onSortChange: (next: SeriesSortMode) => void
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

function buildSeriesList(
  seriesItems: Series[],
  serviceCountBySeries: Map<string, number>,
  songTitleBySlug: Map<string, string>,
  sortMode: SeriesSortMode,
  onSortChange: (next: SeriesSortMode) => void
): HTMLElement {
  const wrapper = createElement("div", "table-wrap");
  const table = createElement("table", "data-table entity-table");
  const thead = createElement("thead");
  const headRow = createElement("tr");
  headRow.append(
    buildSortableHeader("Series", getSeriesHeaderState("title", sortMode), onSortChange),
    buildSortableHeader("Date Range", getSeriesHeaderState("range", sortMode), onSortChange),
    buildSortableHeader("Services", getSeriesHeaderState("services", sortMode), onSortChange),
    buildSortableHeader("Recommended Songs", getSeriesHeaderState("recommended", sortMode), onSortChange),
    createElement("th", undefined, "Description")
  );
  thead.appendChild(headRow);

  const tbody = createElement("tbody");
  for (const series of seriesItems) {
    const row = createElement("tr");

    const titleCell = createElement("td");
    const titleLink = createElement("a", "list-primary") as HTMLAnchorElement;
    titleLink.href = toAppHref(`/series/${series.slug}`);
    titleLink.textContent = series.title;
    titleCell.appendChild(titleLink);
    titleCell.appendChild(createElement("div", "list-secondary", series.slug));
    row.appendChild(titleCell);

    const rangeCell = createElement("td");
    rangeCell.appendChild(
      createElement("div", "list-primary", formatDateRange(series.date_range[0], series.date_range[1]))
    );
    row.appendChild(rangeCell);

    const servicesCell = createElement("td");
    servicesCell.appendChild(
      createElement("div", "list-primary", `${serviceCountBySeries.get(series.slug) ?? 0} service(s)`)
    );
    row.appendChild(servicesCell);

    const recommendedCell = createElement("td");
    recommendedCell.appendChild(createElement("div", "list-primary", `${series.recommended.length} song(s)`));
    if (series.recommended.length > 0) {
      const preview = series.recommended
        .slice(0, 3)
        .map((slug) => songTitleBySlug.get(slug) ?? slug)
        .join(", ");
      recommendedCell.appendChild(
        createElement(
          "div",
          "list-secondary",
          `${preview}${series.recommended.length > 3 ? ", ..." : ""}`
        )
      );
    }
    row.appendChild(recommendedCell);

    const descriptionCell = createElement("td");
    descriptionCell.appendChild(
      createElement(
        "div",
        "list-secondary",
        series.description ? truncateText(series.description, 140) : "No description"
      )
    );
    row.appendChild(descriptionCell);

    tbody.appendChild(row);
  }

  table.append(thead, tbody);
  wrapper.appendChild(table);
  return wrapper;
}

export function SeriesListPage(ctx: PageContext, query: URLSearchParams): HTMLElement {
  const page = createElement("div", "page series-page");
  page.appendChild(createElement("h1", undefined, "Series"));

  if (ctx.data.series.length === 0) {
    page.appendChild(createElement("p", "empty-state", "No series found."));
    return page;
  }

  const serviceCountBySeries = new Map<string, number>();
  for (const service of ctx.data.services) {
    if (!service.series_slug) continue;
    serviceCountBySeries.set(service.series_slug, (serviceCountBySeries.get(service.series_slug) ?? 0) + 1);
  }

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
        placeholder: "title, slug, date range, description, or recommended song...",
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
        writeBrowseQuery("/series", viewMode, sortMode);
        render();
      }),
      makeSortField(sortMode, (next) => {
        sortMode = next;
        writeBrowseQuery("/series", viewMode, sortMode);
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
      ? ctx.data.series
      : ctx.data.series.filter((series) => {
          const [start, end] = series.date_range;
          const recommendedTitles = series.recommended
            .map((slug) => songTitleBySlug.get(slug) ?? slug)
            .join(" ");
          const haystack = [
            series.title,
            series.slug,
            start ?? "",
            end ?? "",
            formatDate(start),
            formatDate(end),
            series.description ?? "",
            series.recommended.join(" "),
            recommendedTitles
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(needle);
        });
    const sorted = sortSeries(filtered, sortMode, serviceCountBySeries);

    results.appendChild(createElement("p", "results-summary", `${sorted.length} series item(s)`));

    if (sorted.length === 0) {
      results.appendChild(createElement("p", "empty-state", "No series matched this search."));
      return;
    }

    if (viewMode === "list") {
      results.appendChild(
        buildSeriesList(sorted, serviceCountBySeries, songTitleBySlug, sortMode, (next) => {
          sortMode = next;
          writeBrowseQuery("/series", viewMode, sortMode);
          render();
        })
      );
      return;
    }

    const grid = createElement("div", "entity-grid");
    for (const series of sorted) {
      const card = createElement("article", "entity-card");
      const title = createElement("h3", "entity-title");
      const link = createElement("a") as HTMLAnchorElement;
      link.href = toAppHref(`/series/${series.slug}`);
      link.textContent = series.title;
      title.appendChild(link);

      const [start, end] = series.date_range;
      const dateText = formatDateRange(start, end);
      const meta = createElement("p", "entity-meta", dateText);

      const serviceCount = serviceCountBySeries.get(series.slug) ?? 0;
      const stats = createElement(
        "p",
        "entity-subline",
        `${serviceCount} service(s) | ${series.recommended.length} recommended song(s)`
      );

      const recommendedPreview = series.recommended
        .slice(0, 4)
        .map((slug) => songTitleBySlug.get(slug) ?? slug)
        .join(", ");
      const preview = createElement(
        "p",
        "entity-preview",
        recommendedPreview.length > 0
          ? `Recommended: ${recommendedPreview}${series.recommended.length > 4 ? ", ..." : ""}`
          : "No recommended songs."
      );

      card.append(title, meta, stats, preview);
      if (series.description) {
        card.appendChild(createElement("p", "entity-body", series.description));
      }
      grid.appendChild(card);
    }
    results.appendChild(grid);
  };

  render();
  return page;
}
