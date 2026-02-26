import type { PageContext } from "../types";
import { toAppHref } from "../router";
import { createElement, formatDate } from "../utils";

export function SeriesListPage(ctx: PageContext): HTMLElement {
  const page = createElement("div", "page series-page");
  page.appendChild(createElement("h1", undefined, "Series"));

  if (ctx.data.series.length === 0) {
    page.appendChild(createElement("p", "empty-state", "No series found."));
    return page;
  }

  const list = createElement("ul", "service-list");
  for (const item of ctx.data.series) {
    const li = createElement("li", "service-list-item");
    const link = createElement("a") as HTMLAnchorElement;
    link.href = toAppHref(`/series/${item.slug}`);
    link.textContent = item.title;
    const [start, end] = item.date_range;
    const dateText = start || end ? `${formatDate(start)} to ${formatDate(end)}` : "Open date range";
    const meta = createElement("p", "service-list-meta", `${dateText} | ${item.recommended.length} recommended song(s)`);
    li.append(link, meta);
    list.appendChild(li);
  }
  page.appendChild(list);
  return page;
}
