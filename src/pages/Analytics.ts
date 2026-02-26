import { Chart } from "../components/Chart";
import { Table } from "../components/Table";
import type { PageContext } from "../types";
import { createElement } from "../utils";

export function AnalyticsPage(ctx: PageContext): HTMLElement {
  const page = createElement("div", "page analytics-page");
  page.appendChild(createElement("h1", undefined, "Analytics"));

  const topSection = createElement("section", "analytics-grid");

  const topSongsBlock = createElement("article", "detail-block");
  topSongsBlock.appendChild(createElement("h2", undefined, "Top Songs"));
  topSongsBlock.appendChild(
    Table(
      [
        { key: "title", label: "Song" },
        { key: "count", label: "Count" }
      ],
      ctx.data.derived.top_songs.slice(0, 12)
    )
  );
  topSection.appendChild(topSongsBlock);

  const topWritersBlock = createElement("article", "detail-block");
  topWritersBlock.appendChild(createElement("h2", undefined, "Top Writers"));
  topWritersBlock.appendChild(
    Table(
      [
        { key: "writer", label: "Writer" },
        { key: "count", label: "Count" }
      ],
      ctx.data.derived.top_writers.slice(0, 12)
    )
  );
  topSection.appendChild(topWritersBlock);

  const topArtistsBlock = createElement("article", "detail-block");
  topArtistsBlock.appendChild(createElement("h2", undefined, "Top Original Artists"));
  topArtistsBlock.appendChild(
    Table(
      [
        { key: "original_artist", label: "Original Artist" },
        { key: "count", label: "Count" }
      ],
      ctx.data.derived.top_original_artists.slice(0, 12)
    )
  );
  topSection.appendChild(topArtistsBlock);

  page.appendChild(topSection);

  const rotationBlock = createElement("section", "detail-block");
  rotationBlock.appendChild(createElement("h2", undefined, "Rotation Health Buckets"));
  const rotationList = createElement("ul");
  for (const threshold of [4, 8, 12, 24]) {
    const key = `not_sung_${threshold}_weeks`;
    const size = ctx.data.derived.rotation_health[key]?.length ?? 0;
    rotationList.appendChild(createElement("li", undefined, `${threshold} weeks: ${size} song(s)`));
  }
  rotationBlock.appendChild(rotationList);
  page.appendChild(rotationBlock);

  const coverageGrid = createElement("section", "analytics-grid");
  coverageGrid.appendChild(
    Chart({
      title: "Theme Coverage (Last 12 Weeks)",
      data: ctx.data.derived.theme_coverage_last_12_weeks.map((item) => ({ label: item.theme, value: item.count }))
    })
  );
  coverageGrid.appendChild(
    Chart({
      title: "Doctrinal Coverage (Last 12 Weeks)",
      data: ctx.data.derived.doctrinal_coverage_last_12_weeks.map((item) => ({
        label: item.doctrine,
        value: item.count
      }))
    })
  );
  page.appendChild(coverageGrid);

  const gapBlock = createElement("section", "detail-block");
  gapBlock.appendChild(createElement("h2", undefined, "Gaps"));
  const gaps = ctx.data.derived.theme_gaps_last_12_weeks;
  if (gaps.length === 0) {
    gapBlock.appendChild(createElement("p", "empty-state", "No theme gaps in the last 12 weeks."));
  } else {
    const list = createElement("ul");
    gaps.forEach((gap) => list.appendChild(createElement("li", undefined, gap)));
    gapBlock.appendChild(list);
  }
  page.appendChild(gapBlock);

  const overReliance = createElement("section", "detail-block");
  overReliance.appendChild(createElement("h2", undefined, "Over-reliance Report"));
  const total = ctx.data.derived.over_reliance.total_usage_count;
  const top10 = ctx.data.derived.over_reliance.top_10_usage_count;
  const pct = (ctx.data.derived.over_reliance.top_10_share * 100).toFixed(1);
  overReliance.appendChild(createElement("p", undefined, `Top 10 songs account for ${top10}/${total} usages (${pct}%).`));
  page.appendChild(overReliance);

  return page;
}
