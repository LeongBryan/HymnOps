import { Chart } from "../components/Chart";
import { Table } from "../components/Table";
import type { PageContext } from "../types";
import { createElement, weeksSince } from "../utils";

const FILTER_YEARS = [2024, 2025] as const;
const ROTATION_THRESHOLDS = [4, 8, 12, 24] as const;

interface RotationRow {
  slug: string;
  title: string;
  weeks_since_last_sung: number | null;
}

interface AnalyticsSnapshot {
  topSongs: Array<{ slug: string; title: string; count: number }>;
  topWriters: Array<{ writer: string; count: number }>;
  topArtists: Array<{ original_artist: string; count: number }>;
  rotationHealth: Record<string, RotationRow[]>;
  themeCoverage: Array<{ theme: string; count: number }>;
  doctrinalCoverage: Array<{ doctrine: string; count: number }>;
  themeGaps: string[];
  overReliance: {
    totalUsageCount: number;
    top10UsageCount: number;
    top10Share: number;
  };
}

function yearOf(date: string): number | null {
  const parsed = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function incrementCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function buildSnapshot(ctx: PageContext, selectedYears: Set<number>): AnalyticsSnapshot {
  const songBySlug = new Map(ctx.data.songs.map((song) => [song.slug, song]));
  const filteredServices = ctx.data.services.filter((service) => {
    if (selectedYears.size === 0) return true;
    const year = yearOf(service.date);
    return year !== null && selectedYears.has(year);
  });

  const usageCount = new Map<string, number>();
  const writerCount = new Map<string, number>();
  const artistCount = new Map<string, number>();
  const themeCount = new Map<string, number>();
  const doctrineCount = new Map<string, number>();
  const lastSungBySlug = new Map<string, string>();

  for (const service of filteredServices) {
    for (const item of service.songs) {
      incrementCount(usageCount, item.slug);
      const song = songBySlug.get(item.slug);
      if (!song) continue;

      for (const writer of song.writers) incrementCount(writerCount, writer);
      if (song.original_artist) incrementCount(artistCount, song.original_artist);
      for (const theme of song.dominant_themes) incrementCount(themeCount, theme);
      for (const doctrine of song.doctrinal_categories) incrementCount(doctrineCount, doctrine);

      const current = lastSungBySlug.get(song.slug);
      if (!current || service.date > current) {
        lastSungBySlug.set(song.slug, service.date);
      }
    }
  }

  const topSongs = [...usageCount.entries()]
    .map(([slug, count]) => ({ slug, title: songBySlug.get(slug)?.title ?? slug, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

  const topWriters = [...writerCount.entries()]
    .map(([writer, count]) => ({ writer, count }))
    .sort((a, b) => b.count - a.count || a.writer.localeCompare(b.writer));

  const topArtists = [...artistCount.entries()]
    .map(([original_artist, count]) => ({ original_artist, count }))
    .sort((a, b) => b.count - a.count || a.original_artist.localeCompare(b.original_artist));

  const activeSongs = ctx.data.songs.filter((song) => song.status === "active");
  const rotationSongs =
    selectedYears.size === 0 ? activeSongs : activeSongs.filter((song) => usageCount.has(song.slug));
  const rotationHealth: Record<string, RotationRow[]> = {};
  for (const threshold of ROTATION_THRESHOLDS) {
    const key = `not_sung_${threshold}_weeks`;
    rotationHealth[key] = rotationSongs
      .map((song) => ({
        slug: song.slug,
        title: song.title,
        weeks_since_last_sung: weeksSince(lastSungBySlug.get(song.slug) ?? null)
      }))
      .filter((song) => song.weeks_since_last_sung === null || song.weeks_since_last_sung >= threshold)
      .sort((a, b) => {
        const aVal = a.weeks_since_last_sung ?? Number.POSITIVE_INFINITY;
        const bVal = b.weeks_since_last_sung ?? Number.POSITIVE_INFINITY;
        return bVal - aVal || a.title.localeCompare(b.title);
      });
  }

  const themeCoverage = [...themeCount.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme));

  const doctrinalCoverage = [...doctrineCount.entries()]
    .map(([doctrine, count]) => ({ doctrine, count }))
    .sort((a, b) => b.count - a.count || a.doctrine.localeCompare(b.doctrine));

  const allThemes = new Set<string>();
  for (const song of activeSongs) {
    for (const theme of song.dominant_themes) allThemes.add(theme);
  }
  const themeGaps = [...allThemes].filter((theme) => !themeCount.has(theme)).sort((a, b) => a.localeCompare(b));

  const totalUsageCount = [...usageCount.values()].reduce((sum, count) => sum + count, 0);
  const top10UsageCount = topSongs.slice(0, 10).reduce((sum, item) => sum + item.count, 0);

  return {
    topSongs,
    topWriters,
    topArtists,
    rotationHealth,
    themeCoverage,
    doctrinalCoverage,
    themeGaps,
    overReliance: {
      totalUsageCount,
      top10UsageCount,
      top10Share: totalUsageCount > 0 ? top10UsageCount / totalUsageCount : 0
    }
  };
}

export function AnalyticsPage(ctx: PageContext): HTMLElement {
  const page = createElement("div", "page analytics-page");
  page.appendChild(createElement("h1", undefined, "Analytics"));
  const filterBlock = createElement("section", "detail-block analytics-filters");
  const content = createElement("div");
  page.append(filterBlock, content);

  const selectedYears = new Set<number>();

  const render = () => {
    filterBlock.innerHTML = "";
    content.innerHTML = "";

    filterBlock.appendChild(createElement("h2", undefined, "Year Filter"));
    const filterRow = createElement("div", "year-filter-row");
    for (const year of FILTER_YEARS) {
      const button = createElement("button", "button-secondary year-filter-btn", String(year)) as HTMLButtonElement;
      button.type = "button";
      if (selectedYears.has(year)) {
        button.classList.add("is-active");
      }
      button.addEventListener("click", () => {
        if (selectedYears.has(year)) {
          selectedYears.delete(year);
        } else {
          selectedYears.add(year);
        }
        render();
      });
      filterRow.appendChild(button);
    }
    filterBlock.appendChild(filterRow);
    const scopeLabel =
      selectedYears.size === 0
        ? "Scope: All-time"
        : `Scope: ${[...selectedYears].sort((a, b) => a - b).join(" + ")}`;
    filterBlock.appendChild(createElement("p", "analytics-scope-label", scopeLabel));

    const snapshot = buildSnapshot(ctx, selectedYears);
    const scopeTitle = selectedYears.size === 0 ? "All-time" : "Selected year(s)";

    const topSection = createElement("section", "analytics-grid");

    const topSongsBlock = createElement("article", "detail-block");
    topSongsBlock.appendChild(createElement("h2", undefined, "Top Songs"));
    topSongsBlock.appendChild(
      Table(
        [
          { key: "title", label: "Song" },
          { key: "count", label: "Count" }
        ],
        snapshot.topSongs.slice(0, 12)
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
        snapshot.topWriters.slice(0, 12)
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
        snapshot.topArtists.slice(0, 12)
      )
    );
    topSection.appendChild(topArtistsBlock);

    content.appendChild(topSection);

    const rotationBlock = createElement("section", "detail-block");
    rotationBlock.appendChild(createElement("h2", undefined, `Rotation Health Buckets (${scopeTitle})`));
    const rotationList = createElement("ul");
    for (const threshold of ROTATION_THRESHOLDS) {
      const key = `not_sung_${threshold}_weeks`;
      const size = snapshot.rotationHealth[key]?.length ?? 0;
      rotationList.appendChild(createElement("li", undefined, `${threshold} weeks: ${size} song(s)`));
    }
    rotationBlock.appendChild(rotationList);
    content.appendChild(rotationBlock);

    const coverageGrid = createElement("section", "analytics-grid");
    coverageGrid.appendChild(
      Chart({
        title: `Theme Coverage (${scopeTitle})`,
        data: snapshot.themeCoverage.map((item) => ({ label: item.theme, value: item.count }))
      })
    );
    coverageGrid.appendChild(
      Chart({
        title: `Doctrinal Coverage (${scopeTitle})`,
        data: snapshot.doctrinalCoverage.map((item) => ({
          label: item.doctrine,
          value: item.count
        }))
      })
    );
    content.appendChild(coverageGrid);

    const gapBlock = createElement("section", "detail-block");
    gapBlock.appendChild(createElement("h2", undefined, "Gaps"));
    if (snapshot.themeGaps.length === 0) {
      gapBlock.appendChild(createElement("p", "empty-state", "No theme gaps in this scope."));
    } else {
      const list = createElement("ul");
      snapshot.themeGaps.forEach((gap) => list.appendChild(createElement("li", undefined, gap)));
      gapBlock.appendChild(list);
    }
    content.appendChild(gapBlock);

    const overReliance = createElement("section", "detail-block");
    overReliance.appendChild(createElement("h2", undefined, "Over-reliance Report"));
    const total = snapshot.overReliance.totalUsageCount;
    const top10 = snapshot.overReliance.top10UsageCount;
    const pct = (snapshot.overReliance.top10Share * 100).toFixed(1);
    overReliance.appendChild(createElement("p", undefined, `Top 10 songs account for ${top10}/${total} usages (${pct}%).`));
    content.appendChild(overReliance);
  };

  render();
  return page;
}
