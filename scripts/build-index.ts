import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";
import { differenceInCalendarWeeks, parseISO, subWeeks } from "date-fns";

type AnyRecord = Record<string, unknown>;

interface SongServiceUsage {
  slug: string;
  usage: string[];
  key: string | null;
  notes: string | null;
}

interface ServiceRecord {
  date: string;
  series_slug: string | null;
  sermon_title: string | null;
  sermon_text: string | null;
  preacher: string | null;
  songs: SongServiceUsage[];
  notes_markdown: string | null;
}

interface SongHistoryEntry {
  date: string;
  series_slug: string | null;
  usage: string[];
  key: string | null;
}

interface SongRecord {
  title: string;
  slug: string;
  aka: string[];
  ccli_number: string | null;
  songselect_url: string | null;
  lyrics_source: "SongSelect" | "Other" | "Unknown";
  lyrics_hint?: string | null;
  original_artist: string | null;
  writers: string[];
  publisher: string | null;
  year: number | null;
  tempo_bpm: number | null;
  key: string | null;
  time_signature: string | null;
  congregational_fit: number | null;
  vocal_range: string | null;
  dominant_themes: string[];
  doctrinal_categories: string[];
  emotional_tone: string[];
  scriptural_anchors: string[];
  theological_summary: string;
  arrangement_notes: string | null;
  slides_path: string | null;
  tags: string[];
  last_sung_override: string | null;
  status: "active" | "archive";
  licensing_notes?: string | null;
  language?: string | null;
  meter?: string | null;
  notes_markdown: string | null;
  pastoral_use_markdown: string | null;
  lyric_warning_reasons: string[];
  times_sung: number;
  last_sung_computed: string | null;
  history: SongHistoryEntry[];
  writers_normalized: string[];
  original_artist_normalized: string | null;
}

interface SeriesRecord {
  title: string;
  slug: string;
  date_range: [string | null, string | null];
  description: string | null;
  recommended: string[];
  notes_markdown: string | null;
}

interface DerivedData {
  generated_at: string;
  rotation_health: Record<string, { slug: string; title: string; weeks_since_last_sung: number | null }[]>;
  top_songs: { slug: string; title: string; count: number }[];
  top_writers: { writer: string; count: number }[];
  top_original_artists: { original_artist: string; count: number }[];
  theme_coverage_last_12_weeks: { theme: string; count: number }[];
  doctrinal_coverage_last_12_weeks: { doctrine: string; count: number }[];
  theme_gaps_last_12_weeks: string[];
  over_reliance: {
    top_10_usage_count: number;
    total_usage_count: number;
    top_10_share: number;
  };
  recently_sung_services: Array<{ date: string; series_slug: string | null; song_slugs: string[] }>;
}

const ROOT = process.cwd();
const SONGS_DIR = path.join(ROOT, "songs");
const SERVICES_DIR = path.join(ROOT, "services");
const SERIES_DIR = path.join(ROOT, "series");
const OUTPUT_DIRS = [path.join(ROOT, "public", "data"), path.join(ROOT, "dist", "data")];

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function detectLyricLikeContent(markdown: string): string[] {
  const reasons: string[] = [];
  const lines = markdown.split(/\r?\n/);
  const trimmed = lines.map((line) => line.trim()).filter((line) => line.length > 0);

  if (trimmed.some((line) => /^\s*(verse|chorus|bridge|tag|refrain)\b[\s:\d-]*$/i.test(line))) {
    reasons.push("section markers");
  }
  if (/\b(verse|chorus|bridge|tag|refrain)\b/i.test(markdown)) {
    reasons.push("marker keywords");
  }

  const shortLines = trimmed.filter((line) => line.length < 60 && !line.startsWith("#") && !line.startsWith("- "));
  if (shortLines.length > 40) {
    reasons.push("more-than-40-short-lines");
  }

  let shortRun = 0;
  let maxShortRun = 0;
  for (const line of trimmed) {
    const isShort = line.length < 60 && !line.startsWith("#") && !line.startsWith("- ");
    shortRun = isShort ? shortRun + 1 : 0;
    maxShortRun = Math.max(maxShortRun, shortRun);
  }
  if (maxShortRun >= 16) {
    reasons.push("long-line-broken-block");
  }

  return reasons;
}

function normalizeName(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

async function readMarkdownFiles(dir: string): Promise<Array<{ fileName: string; frontmatter: AnyRecord; body: string }>> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_"))
    .map((entry) => entry.name);

  const parsedFiles: Array<{ fileName: string; frontmatter: AnyRecord; body: string }> = [];
  for (const fileName of markdownFiles) {
    const raw = await fs.readFile(path.join(dir, fileName), "utf8");
    const parsed = matter(raw);
    parsedFiles.push({
      fileName,
      frontmatter: parsed.data as AnyRecord,
      body: parsed.content
    });
  }
  return parsedFiles;
}

function extractSections(body: string): { notes_markdown: string | null; pastoral_use_markdown: string | null } {
  const headings: Array<{ title: string; index: number; contentStart: number }> = [];
  const regex = /^##\s+(.+)\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    headings.push({
      title: match[1].trim(),
      index: match.index,
      contentStart: regex.lastIndex
    });
  }

  const sections: Record<string, string> = {};
  for (let i = 0; i < headings.length; i += 1) {
    const current = headings[i];
    const nextStart = i < headings.length - 1 ? headings[i + 1].index : body.length;
    const content = body.slice(current.contentStart, nextStart).trim();
    sections[current.title] = content;
  }

  return {
    notes_markdown: sections["Notes"]?.trim() || null,
    pastoral_use_markdown: sections["Pastoral Use"]?.trim() || null
  };
}

function parseDateSafe(value: string | null): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function weeksSince(dateValue: string | null, now: Date): number | null {
  const parsed = parseDateSafe(dateValue);
  if (!parsed) return null;
  return Math.max(0, differenceInCalendarWeeks(now, parsed));
}

async function writeJson(fileName: string, data: unknown): Promise<void> {
  const payload = JSON.stringify(data, null, 2);
  for (const outputDir of OUTPUT_DIRS) {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, fileName), payload, "utf8");
  }
}

async function run(): Promise<void> {
  const [rawSongs, rawServices, rawSeries] = await Promise.all([
    readMarkdownFiles(SONGS_DIR),
    readMarkdownFiles(SERVICES_DIR),
    readMarkdownFiles(SERIES_DIR)
  ]);

  const services: ServiceRecord[] = rawServices
    .map((file) => {
      const fm = file.frontmatter;
      const songs = Array.isArray(fm.songs)
        ? fm.songs
            .filter((song) => typeof song === "object" && song !== null)
            .map((song) => {
              const item = song as AnyRecord;
              return {
                slug: isString(item.slug) ? item.slug : "",
                usage: isStringArray(item.usage) ? item.usage : [],
                key: isString(item.key) ? item.key : null,
                notes: isString(item.notes) ? item.notes : null
              } satisfies SongServiceUsage;
            })
            .filter((song) => song.slug.length > 0)
        : [];
      return {
        date: isString(fm.date) ? fm.date : file.fileName.replace(/\.md$/i, ""),
        series_slug: isString(fm.series_slug) ? fm.series_slug : null,
        sermon_title: isString(fm.sermon_title) ? fm.sermon_title : null,
        sermon_text: isString(fm.sermon_text) ? fm.sermon_text : null,
        preacher: isString(fm.preacher) ? fm.preacher : null,
        songs,
        notes_markdown: file.body.trim() || null
      } satisfies ServiceRecord;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const historyBySong = new Map<string, SongHistoryEntry[]>();
  for (const service of services) {
    for (const item of service.songs) {
      const history = historyBySong.get(item.slug) ?? [];
      history.push({
        date: service.date,
        series_slug: service.series_slug,
        usage: item.usage,
        key: item.key
      });
      historyBySong.set(item.slug, history);
    }
  }

  for (const [slug, history] of historyBySong.entries()) {
    history.sort((a, b) => b.date.localeCompare(a.date));
    historyBySong.set(slug, history);
  }

  const songs: SongRecord[] = rawSongs
    .map((file) => {
      const fm = file.frontmatter;
      const slug = isString(fm.slug) ? fm.slug : file.fileName.replace(/\.md$/i, "");
      const lyricWarnings = detectLyricLikeContent(file.body);
      const sections = lyricWarnings.length > 0 ? { notes_markdown: null, pastoral_use_markdown: null } : extractSections(file.body);
      const history = (historyBySong.get(slug) ?? []).slice(0, 12);
      const lastFromHistory = history[0]?.date ?? null;
      const lastOverride = isString(fm.last_sung_override) ? fm.last_sung_override : null;
      const lastSungComputed = lastOverride ?? lastFromHistory;
      const writers = isStringArray(fm.writers) ? fm.writers : [];
      const originalArtist = isString(fm.original_artist) ? fm.original_artist : null;

      return {
        title: isString(fm.title) ? fm.title : slug,
        slug,
        aka: isStringArray(fm.aka) ? fm.aka : [],
        ccli_number: isString(fm.ccli_number) ? fm.ccli_number : null,
        songselect_url: isString(fm.songselect_url) ? fm.songselect_url : null,
        lyrics_source: fm.lyrics_source === "SongSelect" || fm.lyrics_source === "Other" ? fm.lyrics_source : "Unknown",
        lyrics_hint: isString(fm.lyrics_hint) ? fm.lyrics_hint : null,
        original_artist: originalArtist,
        writers,
        publisher: isString(fm.publisher) ? fm.publisher : null,
        year: typeof fm.year === "number" ? fm.year : null,
        tempo_bpm: typeof fm.tempo_bpm === "number" ? fm.tempo_bpm : null,
        key: isString(fm.key) ? fm.key : null,
        time_signature: isString(fm.time_signature) ? fm.time_signature : null,
        congregational_fit: typeof fm.congregational_fit === "number" ? fm.congregational_fit : null,
        vocal_range: isString(fm.vocal_range) ? fm.vocal_range : null,
        dominant_themes: isStringArray(fm.dominant_themes) ? fm.dominant_themes : [],
        doctrinal_categories: isStringArray(fm.doctrinal_categories) ? fm.doctrinal_categories : [],
        emotional_tone: isStringArray(fm.emotional_tone) ? fm.emotional_tone : [],
        scriptural_anchors: isStringArray(fm.scriptural_anchors) ? fm.scriptural_anchors : [],
        theological_summary: isString(fm.theological_summary) ? fm.theological_summary : "",
        arrangement_notes: isString(fm.arrangement_notes) ? fm.arrangement_notes : null,
        slides_path: isString(fm.slides_path) ? fm.slides_path : null,
        tags: isStringArray(fm.tags) ? fm.tags : [],
        last_sung_override: lastOverride,
        status: fm.status === "archive" ? "archive" : "active",
        licensing_notes: isString(fm.licensing_notes) ? fm.licensing_notes : null,
        language: isString(fm.language) ? fm.language : null,
        meter: isString(fm.meter) ? fm.meter : null,
        notes_markdown: sections.notes_markdown,
        pastoral_use_markdown: sections.pastoral_use_markdown,
        lyric_warning_reasons: lyricWarnings,
        times_sung: historyBySong.get(slug)?.length ?? 0,
        last_sung_computed: lastSungComputed,
        history,
        writers_normalized: writers.map(normalizeName),
        original_artist_normalized: originalArtist ? normalizeName(originalArtist) : null
      } satisfies SongRecord;
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const series: SeriesRecord[] = rawSeries
    .map((file) => {
      const fm = file.frontmatter;
      return {
        title: isString(fm.title) ? fm.title : file.fileName.replace(/\.md$/i, ""),
        slug: isString(fm.slug) ? fm.slug : file.fileName.replace(/\.md$/i, ""),
        date_range:
          Array.isArray(fm.date_range) && fm.date_range.length === 2
            ? [
                isString(fm.date_range[0]) ? fm.date_range[0] : null,
                isString(fm.date_range[1]) ? fm.date_range[1] : null
              ]
            : [null, null],
        description: isString(fm.description) ? fm.description : null,
        recommended: isStringArray(fm.recommended) ? fm.recommended : [],
        notes_markdown: file.body.trim() || null
      } satisfies SeriesRecord;
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const now = new Date();
  const rotationThresholds = [4, 8, 12, 24];
  const rotationHealth: DerivedData["rotation_health"] = {};
  for (const threshold of rotationThresholds) {
    const bucket = songs
      .filter((song) => song.status === "active")
      .map((song) => ({
        slug: song.slug,
        title: song.title,
        weeks_since_last_sung: weeksSince(song.last_sung_computed, now)
      }))
      .filter((song) => song.weeks_since_last_sung === null || song.weeks_since_last_sung >= threshold)
      .sort((a, b) => {
        const aVal = a.weeks_since_last_sung ?? Number.POSITIVE_INFINITY;
        const bVal = b.weeks_since_last_sung ?? Number.POSITIVE_INFINITY;
        return bVal - aVal;
      });
    rotationHealth[`not_sung_${threshold}_weeks`] = bucket;
  }

  const topSongs = [...songs]
    .sort((a, b) => b.times_sung - a.times_sung || a.title.localeCompare(b.title))
    .map((song) => ({ slug: song.slug, title: song.title, count: song.times_sung }));

  const writerCount = new Map<string, number>();
  const originalArtistCount = new Map<string, number>();
  const songBySlug = new Map<string, SongRecord>(songs.map((song) => [song.slug, song]));

  for (const service of services) {
    for (const item of service.songs) {
      const song = songBySlug.get(item.slug);
      if (!song) continue;
      for (const writer of song.writers) {
        writerCount.set(writer, (writerCount.get(writer) ?? 0) + 1);
      }
      if (song.original_artist) {
        originalArtistCount.set(song.original_artist, (originalArtistCount.get(song.original_artist) ?? 0) + 1);
      }
    }
  }

  const toSortedPairs = (source: Map<string, number>, key: string) =>
    [...source.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ [key]: name, count }));

  const cutoff = subWeeks(now, 12);
  const recentServices = services.filter((service) => {
    const parsed = parseDateSafe(service.date);
    return parsed ? parsed >= cutoff : false;
  });

  const themeCoverage = new Map<string, number>();
  const doctrinalCoverage = new Map<string, number>();

  for (const service of recentServices) {
    for (const item of service.songs) {
      const song = songBySlug.get(item.slug);
      if (!song) continue;
      for (const theme of song.dominant_themes) {
        themeCoverage.set(theme, (themeCoverage.get(theme) ?? 0) + 1);
      }
      for (const doctrine of song.doctrinal_categories) {
        doctrinalCoverage.set(doctrine, (doctrinalCoverage.get(doctrine) ?? 0) + 1);
      }
    }
  }

  const allThemes = new Set<string>();
  for (const song of songs) {
    if (song.status !== "active") continue;
    for (const theme of song.dominant_themes) {
      allThemes.add(theme);
    }
  }
  const recentThemeSet = new Set(themeCoverage.keys());
  const themeGaps = [...allThemes].filter((theme) => !recentThemeSet.has(theme)).sort((a, b) => a.localeCompare(b));

  const totalUsageCount = songs.reduce((sum, song) => sum + song.times_sung, 0);
  const top10UsageCount = topSongs.slice(0, 10).reduce((sum, item) => sum + item.count, 0);

  const derived: DerivedData = {
    generated_at: new Date().toISOString(),
    rotation_health: rotationHealth,
    top_songs: topSongs,
    top_writers: toSortedPairs(writerCount, "writer") as DerivedData["top_writers"],
    top_original_artists: toSortedPairs(originalArtistCount, "original_artist") as DerivedData["top_original_artists"],
    theme_coverage_last_12_weeks: [...themeCoverage.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([theme, count]) => ({ theme, count })),
    doctrinal_coverage_last_12_weeks: [...doctrinalCoverage.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([doctrine, count]) => ({ doctrine, count })),
    theme_gaps_last_12_weeks: themeGaps,
    over_reliance: {
      top_10_usage_count: top10UsageCount,
      total_usage_count: totalUsageCount,
      top_10_share: totalUsageCount > 0 ? top10UsageCount / totalUsageCount : 0
    },
    recently_sung_services: services.slice(0, 5).map((service) => ({
      date: service.date,
      series_slug: service.series_slug,
      song_slugs: service.songs.map((song) => song.slug)
    }))
  };

  await Promise.all([
    writeJson("songs.json", songs),
    writeJson("services.json", services),
    writeJson("series.json", series),
    writeJson("derived.json", derived)
  ]);

  console.log(`Built indexes (${songs.length} songs, ${services.length} services, ${series.length} series).`);
}

run().catch((error: unknown) => {
  console.error("Failed to build indexes.");
  console.error(error);
  process.exit(1);
});
