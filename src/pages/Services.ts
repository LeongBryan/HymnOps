import { SearchBar } from "../components/SearchBar";
import { toAppHref } from "../router";
import type { PageContext } from "../types";
import { createElement, formatDate } from "../utils";

function previewSongTitles(ctx: PageContext, slugs: string[]): string {
  const bySlug = new Map(ctx.data.songs.map((song) => [song.slug, song.title]));
  const preview = slugs.slice(0, 4).map((slug) => bySlug.get(slug) ?? slug);
  return preview.join(", ");
}

export function ServicesPage(ctx: PageContext): HTMLElement {
  const page = createElement("div", "page services-page");
  page.appendChild(createElement("h1", undefined, "Services"));

  if (ctx.data.services.length === 0) {
    page.appendChild(createElement("p", "empty-state", "No services found."));
    return page;
  }

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
        placeholder: "date, sermon title/text, preacher, or series slug...",
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
      ? ctx.data.services
      : ctx.data.services.filter((service) => {
          const haystack = [
            service.date,
            formatDate(service.date),
            service.sermon_title ?? "",
            service.sermon_text ?? "",
            service.preacher ?? "",
            service.series_slug ?? ""
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(needle);
        });

    results.appendChild(createElement("p", "results-summary", `${filtered.length} service(s)`));

    if (filtered.length === 0) {
      results.appendChild(createElement("p", "empty-state", "No services matched this search."));
      return;
    }

    const grid = createElement("div", "entity-grid");
    for (const service of filtered) {
      const card = createElement("article", "entity-card");
      const title = createElement("h3", "entity-title");
      const link = createElement("a") as HTMLAnchorElement;
      link.href = toAppHref(`/services/${service.date}`);
      link.textContent = formatDate(service.date);
      title.appendChild(link);

      const sermonLine = createElement(
        "p",
        "entity-meta",
        service.sermon_title ?? "Untitled sermon"
      );

      const preacherSeries = createElement(
        "p",
        "entity-subline",
        `${service.preacher ?? "Unknown preacher"}${service.series_slug ? ` | ${service.series_slug}` : ""}`
      );

      const songCount = service.songs.length;
      const preview = previewSongTitles(
        ctx,
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
