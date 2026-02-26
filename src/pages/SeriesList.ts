import { SearchBar } from "../components/SearchBar";
import { toAppHref } from "../router";
import type { PageContext } from "../types";
import { createElement, formatDate } from "../utils";

export function SeriesListPage(ctx: PageContext): HTMLElement {
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
  let refocusSearch = false;
  let searchSelectionStart: number | null = null;
  let searchSelectionEnd: number | null = null;
  const controls = createElement("section", "song-controls");
  const results = createElement("section", "song-results");
  page.append(controls, results);

  const render = () => {
    controls.innerHTML = "";
    results.innerHTML = "";

    const topBar = createElement("div", "song-top-bar");
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

    results.appendChild(createElement("p", "results-summary", `${filtered.length} series item(s)`));

    if (filtered.length === 0) {
      results.appendChild(createElement("p", "empty-state", "No series matched this search."));
      return;
    }

    const grid = createElement("div", "entity-grid");
    for (const series of filtered) {
      const card = createElement("article", "entity-card");
      const title = createElement("h3", "entity-title");
      const link = createElement("a") as HTMLAnchorElement;
      link.href = toAppHref(`/series/${series.slug}`);
      link.textContent = series.title;
      title.appendChild(link);

      const [start, end] = series.date_range;
      const dateText = start || end ? `${formatDate(start)} to ${formatDate(end)}` : "Open date range";
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
