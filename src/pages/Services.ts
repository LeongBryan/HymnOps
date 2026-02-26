import type { PageContext } from "../types";
import { toAppHref } from "../router";
import { createElement, formatDate } from "../utils";

export function ServicesPage(ctx: PageContext): HTMLElement {
  const page = createElement("div", "page services-page");
  page.appendChild(createElement("h1", undefined, "Services"));

  if (ctx.data.services.length === 0) {
    page.appendChild(createElement("p", "empty-state", "No services found."));
    return page;
  }

  const list = createElement("ul", "service-list");
  for (const service of ctx.data.services) {
    const item = createElement("li", "service-list-item");
    const link = createElement("a") as HTMLAnchorElement;
    link.href = toAppHref(`/services/${service.date}`);
    link.textContent = formatDate(service.date);
    const meta = createElement(
      "p",
      "service-list-meta",
      `${service.sermon_title ?? "Untitled sermon"} | ${service.songs.length} song(s)${service.series_slug ? ` | ${service.series_slug}` : ""}`
    );
    item.append(link, meta);
    list.appendChild(item);
  }
  page.appendChild(list);
  return page;
}
