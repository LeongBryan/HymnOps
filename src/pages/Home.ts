import type { PageContext } from "../types";
import { toAppHref } from "../router";
import { createElement, formatDate } from "../utils";

const HOME_ROTATION_BUCKETS = [
  { weeks: 12, label: "3 mth" },
  { weeks: 24, label: "6 mth" },
  { weeks: 48, label: "12 mth" }
] as const;

function quickLink(label: string, href: string, description: string): HTMLElement {
  const card = createElement("a", "quick-link") as HTMLAnchorElement;
  card.href = href;
  const title = createElement("h3", undefined, label);
  const body = createElement("p", undefined, description);
  card.append(title, body);
  return card;
}

function formatRotationAge(weeks: number | null): string {
  if (weeks === null) return "never";
  return `${Math.max(1, Math.round(weeks / 4))}m`;
}

export function HomePage(ctx: PageContext): HTMLElement {
  const page = createElement("div", "page home-page");
  const heading = createElement("h1", undefined, "HymnOps");
  const sub = createElement(
    "p",
    "page-intro",
    "Metadata-first worship planning: search songs, build setlists, and monitor rotation health."
  );
  page.append(heading, sub);

  const quickActions = createElement("section", "quick-actions");
  quickActions.append(
    quickLink("Songs", toAppHref("/songs"), "Search and filter by theme, doctrine, scripture, writer, and usage history."),
    quickLink("Services", toAppHref("/services"), "Review past services and setlists."),
    quickLink("Series", toAppHref("/series"), "Organize recommended songs by preaching series."),
    quickLink("Planner", toAppHref("/planner"), "Draft a service setlist and export markdown."),
    quickLink("Analytics", toAppHref("/analytics"), "View rotation, coverage, and usage concentration.")
  );
  page.appendChild(quickActions);

  const widgets = createElement("section", "widget-grid");

  const rotation = createElement("article", "widget");
  rotation.appendChild(createElement("h2", undefined, "Not Sung in 3/6/12 Months"));
  for (const bucket of HOME_ROTATION_BUCKETS) {
    const key = `not_sung_${bucket.weeks}_weeks`;
    const list = ctx.data.derived.rotation_health[key] ?? [];
    const group = createElement("div", "widget-subgroup");
    group.appendChild(createElement("h3", undefined, bucket.label));
    const ul = createElement("ul");
    for (const item of list.slice(0, 10)) {
      const li = createElement("li");
      const anchor = createElement("a") as HTMLAnchorElement;
      anchor.href = toAppHref(`/songs/${item.slug}`);
      anchor.textContent = `${item.title} (${formatRotationAge(item.weeks_since_last_sung)})`;
      li.appendChild(anchor);
      ul.appendChild(li);
    }
    if (list.length === 0) {
      ul.appendChild(createElement("li", "empty-state", "No songs in this bucket."));
    }
    group.appendChild(ul);
    rotation.appendChild(group);
  }
  widgets.appendChild(rotation);

  const recent = createElement("article", "widget");
  recent.appendChild(createElement("h2", undefined, "Recently Sung (Last 5 Services)"));
  const recentList = createElement("ul");
  for (const service of ctx.data.derived.recently_sung_services) {
    const li = createElement("li");
    const songTitles = service.song_slugs
      .map((slug) => ctx.data.songs.find((song) => song.slug === slug)?.title ?? slug)
      .join(", ");
    li.textContent = `${formatDate(service.date)}${service.series_slug ? ` [${service.series_slug}]` : ""}: ${songTitles}`;
    recentList.appendChild(li);
  }
  if (ctx.data.derived.recently_sung_services.length === 0) {
    recentList.appendChild(createElement("li", "empty-state", "No services available."));
  }
  recent.appendChild(recentList);
  widgets.appendChild(recent);

  const gaps = createElement("article", "widget");
  gaps.appendChild(createElement("h2", undefined, "Theme Gaps (Last 12 Weeks)"));
  const gapList = createElement("ul");
  for (const theme of ctx.data.derived.theme_gaps_last_12_weeks.slice(0, 20)) {
    gapList.appendChild(createElement("li", undefined, theme));
  }
  if (ctx.data.derived.theme_gaps_last_12_weeks.length === 0) {
    gapList.appendChild(createElement("li", "empty-state", "No current theme gaps detected."));
  }
  gaps.appendChild(gapList);
  widgets.appendChild(gaps);

  page.appendChild(widgets);
  return page;
}
