import type { PageContext } from "../types";
import { createElement, formatDate } from "../utils";

export function SeriesDetailPage(ctx: PageContext, slug: string): HTMLElement {
  const page = createElement("div", "page series-detail-page");
  const series = ctx.data.series.find((item) => item.slug === slug);
  if (!series) {
    page.appendChild(createElement("h1", undefined, "Series not found"));
    page.appendChild(createElement("p", "empty-state", `No series exists for slug "${slug}".`));
    return page;
  }

  page.appendChild(createElement("h1", undefined, series.title));
  const [start, end] = series.date_range;
  page.appendChild(createElement("p", "page-intro", `${formatDate(start)} to ${formatDate(end)}`));
  if (series.description) {
    page.appendChild(createElement("p", undefined, series.description));
  }

  const recommended = createElement("section", "detail-block");
  recommended.appendChild(createElement("h2", undefined, "Recommended Playlist"));
  const list = createElement("ul");
  for (const songSlug of series.recommended) {
    const song = ctx.data.songs.find((item) => item.slug === songSlug);
    const li = createElement("li");
    const link = createElement("a") as HTMLAnchorElement;
    link.href = `#/songs/${songSlug}`;
    link.textContent = song?.title ?? songSlug;
    li.appendChild(link);
    list.appendChild(li);
  }
  if (series.recommended.length === 0) {
    list.appendChild(createElement("li", "empty-state", "No recommended songs."));
  }
  recommended.appendChild(list);
  page.appendChild(recommended);

  const plannerBlock = createElement("section", "detail-block");
  plannerBlock.appendChild(createElement("h2", undefined, "Planning"));
  const button = createElement("button", "button-primary", "Start plan from this series") as HTMLButtonElement;
  button.addEventListener("click", () => {
    ctx.navigate(`/planner?series=${encodeURIComponent(series.slug)}`);
  });
  plannerBlock.appendChild(button);
  page.appendChild(plannerBlock);

  if (series.notes_markdown) {
    const notes = createElement("section", "detail-block markdown-block");
    notes.appendChild(createElement("h2", undefined, "Series Notes"));
    const body = createElement("div");
    body.innerHTML = ctx.markdown.render(series.notes_markdown);
    notes.appendChild(body);
    page.appendChild(notes);
  }

  return page;
}
