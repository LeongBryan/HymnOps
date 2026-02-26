import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";

type AnyRecord = Record<string, unknown>;

const SONGS_DIR = path.join(process.cwd(), "songs");
const SERVICES_DIR = path.join(process.cwd(), "services");
const SERIES_DIR = path.join(process.cwd(), "series");

interface ParsedMarkdown {
  filePath: string;
  fileName: string;
  body: string;
  frontmatter: AnyRecord;
}

const SONG_REQUIRED_KEYS = [
  "title",
  "slug",
  "aka",
  "ccli_number",
  "songselect_url",
  "lyrics_source",
  "original_artist",
  "writers",
  "publisher",
  "year",
  "tempo_bpm",
  "key",
  "time_signature",
  "congregational_fit",
  "vocal_range",
  "dominant_themes",
  "doctrinal_categories",
  "emotional_tone",
  "scriptural_anchors",
  "theological_summary",
  "arrangement_notes",
  "slides_path",
  "tags",
  "last_sung_override",
  "status"
] as const;

const SERVICE_REQUIRED_KEYS = [
  "date",
  "series_slug",
  "sermon_title",
  "sermon_text",
  "preacher",
  "songs"
] as const;

const SERIES_REQUIRED_KEYS = [
  "title",
  "slug",
  "date_range",
  "description",
  "recommended"
] as const;

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isNumberOrNull(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isDateYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function detectLyricLikeContent(markdown: string): string[] {
  const reasons: string[] = [];
  const lines = markdown.split(/\r?\n/);
  const trimmedLines = lines.map((line) => line.trim()).filter((line) => line.length > 0);

  const markerPattern = /^\s*(verse|chorus|bridge|tag|refrain)\b[\s:\d-]*$/i;
  if (trimmedLines.some((line) => markerPattern.test(line))) {
    reasons.push("contains lyric section markers (Verse/Chorus/Bridge/Tag/Refrain)");
  }
  if (/\b(verse|chorus|bridge|tag|refrain)\b/i.test(markdown)) {
    reasons.push("contains lyric marker keywords");
  }

  const shortLines = trimmedLines.filter(
    (line) => line.length < 60 && !line.startsWith("#") && !line.startsWith("- ")
  );
  if (shortLines.length > 40) {
    reasons.push("contains more than 40 short line-broken lines (<60 chars)");
  }

  const normalizedCounts = new Map<string, number>();
  for (const line of shortLines) {
    const normalized = line.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    if (normalized.length < 8) {
      continue;
    }
    normalizedCounts.set(normalized, (normalizedCounts.get(normalized) ?? 0) + 1);
  }
  const repeated = [...normalizedCounts.entries()].filter(([, count]) => count >= 3);
  if (repeated.length > 0) {
    reasons.push("contains repeated short lines that resemble chorus/refrain structure");
  }

  let maxShortRun = 0;
  let currentRun = 0;
  for (const line of trimmedLines) {
    const isShort = line.length < 60 && !line.startsWith("#") && !line.startsWith("- ");
    if (isShort) {
      currentRun += 1;
      maxShortRun = Math.max(maxShortRun, currentRun);
    } else {
      currentRun = 0;
    }
  }
  if (maxShortRun >= 16) {
    reasons.push("contains a long contiguous block of short line-broken text");
  }

  return reasons;
}

function checkRequiredKeys(frontmatter: AnyRecord, required: readonly string[], label: string, errors: string[], filePath: string): void {
  for (const key of required) {
    if (!(key in frontmatter)) {
      errors.push(`${filePath}: missing required ${label} field "${key}"`);
    }
  }
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_"))
    .map((entry) => path.join(dir, entry.name));
}

async function parseMarkdownFile(filePath: string): Promise<ParsedMarkdown> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  const fileName = path.basename(filePath, ".md");
  const frontmatter = parsed.data as AnyRecord;
  return {
    filePath,
    fileName,
    body: parsed.content,
    frontmatter
  };
}

function validateSong(file: ParsedMarkdown, errors: string[]): string | null {
  const fm = file.frontmatter;
  checkRequiredKeys(fm, SONG_REQUIRED_KEYS, "song", errors, file.filePath);

  if (!isString(fm.title)) errors.push(`${file.filePath}: "title" must be a string`);
  if (!isString(fm.slug)) {
    errors.push(`${file.filePath}: "slug" must be a string`);
  } else if (fm.slug !== file.fileName) {
    errors.push(`${file.filePath}: "slug" must match filename "${file.fileName}"`);
  }
  if (!isStringArray(fm.aka)) errors.push(`${file.filePath}: "aka" must be a string array`);
  if (!isStringOrNull(fm.ccli_number)) errors.push(`${file.filePath}: "ccli_number" must be string or null`);
  if (!isStringOrNull(fm.songselect_url)) errors.push(`${file.filePath}: "songselect_url" must be string or null`);
  if (!isString(fm.lyrics_source) || !["SongSelect", "Other", "Unknown"].includes(fm.lyrics_source)) {
    errors.push(`${file.filePath}: "lyrics_source" must be one of SongSelect | Other | Unknown`);
  }
  if ("lyrics_hint" in fm && fm.lyrics_hint !== "" && fm.lyrics_hint !== null) {
    errors.push(`${file.filePath}: "lyrics_hint" must be empty string or null (avoid storing lyric excerpts)`);
  }
  if (!isStringOrNull(fm.original_artist)) errors.push(`${file.filePath}: "original_artist" must be string or null`);
  if (!isStringArray(fm.writers)) errors.push(`${file.filePath}: "writers" must be a string array`);
  if (!isStringOrNull(fm.publisher)) errors.push(`${file.filePath}: "publisher" must be string or null`);
  if (!isNumberOrNull(fm.year)) errors.push(`${file.filePath}: "year" must be number or null`);
  if (!isNumberOrNull(fm.tempo_bpm)) errors.push(`${file.filePath}: "tempo_bpm" must be number or null`);
  if (!isStringOrNull(fm.key)) errors.push(`${file.filePath}: "key" must be string or null`);
  if (!isStringOrNull(fm.time_signature)) errors.push(`${file.filePath}: "time_signature" must be string or null`);
  if (!isNumberOrNull(fm.congregational_fit)) {
    errors.push(`${file.filePath}: "congregational_fit" must be number or null`);
  } else if (typeof fm.congregational_fit === "number" && (fm.congregational_fit < 1 || fm.congregational_fit > 5)) {
    errors.push(`${file.filePath}: "congregational_fit" must be between 1 and 5`);
  }
  if (!isStringOrNull(fm.vocal_range)) errors.push(`${file.filePath}: "vocal_range" must be string or null`);
  if (!isStringArray(fm.dominant_themes)) errors.push(`${file.filePath}: "dominant_themes" must be a string array`);
  if (!isStringArray(fm.doctrinal_categories)) errors.push(`${file.filePath}: "doctrinal_categories" must be a string array`);
  if (!isStringArray(fm.emotional_tone)) errors.push(`${file.filePath}: "emotional_tone" must be a string array`);
  if (!isStringArray(fm.scriptural_anchors)) errors.push(`${file.filePath}: "scriptural_anchors" must be a string array`);
  if (!isString(fm.theological_summary)) errors.push(`${file.filePath}: "theological_summary" must be a string`);
  if (!isStringOrNull(fm.arrangement_notes)) errors.push(`${file.filePath}: "arrangement_notes" must be string or null`);
  if (!isStringOrNull(fm.slides_path)) errors.push(`${file.filePath}: "slides_path" must be string or null`);
  if (!isStringArray(fm.tags)) errors.push(`${file.filePath}: "tags" must be a string array`);
  if (!isStringOrNull(fm.last_sung_override)) {
    errors.push(`${file.filePath}: "last_sung_override" must be string or null`);
  } else if (typeof fm.last_sung_override === "string" && !isDateYmd(fm.last_sung_override)) {
    errors.push(`${file.filePath}: "last_sung_override" must be YYYY-MM-DD`);
  }
  if (!isString(fm.status) || !["active", "archive"].includes(fm.status)) {
    errors.push(`${file.filePath}: "status" must be active | archive`);
  }

  if ("licensing_notes" in fm && !isStringOrNull(fm.licensing_notes)) {
    errors.push(`${file.filePath}: "licensing_notes" must be string or null`);
  }
  if ("language" in fm && !isStringOrNull(fm.language)) {
    errors.push(`${file.filePath}: "language" must be string or null`);
  }
  if ("meter" in fm && !isStringOrNull(fm.meter)) {
    errors.push(`${file.filePath}: "meter" must be string or null`);
  }

  const lyricReasons = detectLyricLikeContent(file.body);
  for (const reason of lyricReasons) {
    errors.push(`${file.filePath}: lyric-like content flagged: ${reason}`);
  }

  return typeof fm.slug === "string" ? fm.slug : null;
}

function validateService(file: ParsedMarkdown, errors: string[]): { date: string | null; refs: string[]; series: string | null } {
  const fm = file.frontmatter;
  checkRequiredKeys(fm, SERVICE_REQUIRED_KEYS, "service", errors, file.filePath);

  let date: string | null = null;
  if (!isString(fm.date)) {
    errors.push(`${file.filePath}: "date" must be a string`);
  } else if (!isDateYmd(fm.date)) {
    errors.push(`${file.filePath}: "date" must be YYYY-MM-DD`);
  } else if (fm.date !== file.fileName) {
    errors.push(`${file.filePath}: "date" must match filename "${file.fileName}"`);
    date = fm.date;
  } else {
    date = fm.date;
  }

  if (!isStringOrNull(fm.series_slug)) errors.push(`${file.filePath}: "series_slug" must be string or null`);
  if (!isStringOrNull(fm.sermon_title)) errors.push(`${file.filePath}: "sermon_title" must be string or null`);
  if (!isStringOrNull(fm.sermon_text)) errors.push(`${file.filePath}: "sermon_text" must be string or null`);
  if (!isStringOrNull(fm.preacher)) errors.push(`${file.filePath}: "preacher" must be string or null`);

  const refs: string[] = [];
  if (!Array.isArray(fm.songs)) {
    errors.push(`${file.filePath}: "songs" must be an array`);
  } else {
    for (const [index, item] of fm.songs.entries()) {
      if (typeof item !== "object" || item === null) {
        errors.push(`${file.filePath}: songs[${index}] must be an object`);
        continue;
      }
      const song = item as AnyRecord;
      if (!isString(song.slug)) {
        errors.push(`${file.filePath}: songs[${index}].slug must be a string`);
      } else {
        refs.push(song.slug);
      }
      if (!isStringArray(song.usage)) {
        errors.push(`${file.filePath}: songs[${index}].usage must be a string array`);
      }
      if (!isStringOrNull(song.key)) {
        errors.push(`${file.filePath}: songs[${index}].key must be string or null`);
      }
      if (!isStringOrNull(song.notes)) {
        errors.push(`${file.filePath}: songs[${index}].notes must be string or null`);
      }
    }
  }

  return { date, refs, series: isStringOrNull(fm.series_slug) ? fm.series_slug : null };
}

function validateSeries(file: ParsedMarkdown, errors: string[]): { slug: string | null; recommended: string[] } {
  const fm = file.frontmatter;
  checkRequiredKeys(fm, SERIES_REQUIRED_KEYS, "series", errors, file.filePath);

  let slug: string | null = null;
  if (!isString(fm.title)) errors.push(`${file.filePath}: "title" must be a string`);
  if (!isString(fm.slug)) {
    errors.push(`${file.filePath}: "slug" must be a string`);
  } else if (fm.slug !== file.fileName) {
    errors.push(`${file.filePath}: "slug" must match filename "${file.fileName}"`);
    slug = fm.slug;
  } else {
    slug = fm.slug;
  }

  if (
    !Array.isArray(fm.date_range) ||
    fm.date_range.length !== 2 ||
    !fm.date_range.every((value) => value === null || typeof value === "string")
  ) {
    errors.push(`${file.filePath}: "date_range" must be [string|null, string|null]`);
  } else {
    for (const [index, value] of fm.date_range.entries()) {
      if (typeof value === "string" && !isDateYmd(value)) {
        errors.push(`${file.filePath}: date_range[${index}] must be YYYY-MM-DD or null`);
      }
    }
  }

  if (!isStringOrNull(fm.description)) errors.push(`${file.filePath}: "description" must be string or null`);

  const recommended: string[] = [];
  if (!isStringArray(fm.recommended)) {
    errors.push(`${file.filePath}: "recommended" must be a string array`);
  } else {
    recommended.push(...fm.recommended);
  }

  return { slug, recommended };
}

async function run(): Promise<void> {
  const errors: string[] = [];

  const songFiles = await listMarkdownFiles(SONGS_DIR);
  const serviceFiles = await listMarkdownFiles(SERVICES_DIR);
  const seriesFiles = await listMarkdownFiles(SERIES_DIR);

  const songSlugs = new Set<string>();
  for (const filePath of songFiles) {
    const parsed = await parseMarkdownFile(filePath);
    const slug = validateSong(parsed, errors);
    if (slug) {
      if (songSlugs.has(slug)) {
        errors.push(`${filePath}: duplicate song slug "${slug}"`);
      }
      songSlugs.add(slug);
    }
  }

  const seriesSlugs = new Set<string>();
  const seriesRecommendedRefs: Array<{ filePath: string; slug: string }> = [];
  for (const filePath of seriesFiles) {
    const parsed = await parseMarkdownFile(filePath);
    const validated = validateSeries(parsed, errors);
    if (validated.slug) {
      if (seriesSlugs.has(validated.slug)) {
        errors.push(`${filePath}: duplicate series slug "${validated.slug}"`);
      }
      seriesSlugs.add(validated.slug);
    }
    for (const ref of validated.recommended) {
      seriesRecommendedRefs.push({ filePath, slug: ref });
    }
  }

  const serviceSongRefs: Array<{ filePath: string; slug: string }> = [];
  const serviceSeriesRefs: Array<{ filePath: string; slug: string }> = [];
  for (const filePath of serviceFiles) {
    const parsed = await parseMarkdownFile(filePath);
    const validated = validateService(parsed, errors);
    for (const ref of validated.refs) {
      serviceSongRefs.push({ filePath, slug: ref });
    }
    if (validated.series) {
      serviceSeriesRefs.push({ filePath, slug: validated.series });
    }
  }

  for (const ref of serviceSongRefs) {
    if (!songSlugs.has(ref.slug)) {
      errors.push(`${ref.filePath}: references missing song slug "${ref.slug}"`);
    }
  }

  for (const ref of seriesRecommendedRefs) {
    if (!songSlugs.has(ref.slug)) {
      errors.push(`${ref.filePath}: recommended references missing song slug "${ref.slug}"`);
    }
  }

  for (const ref of serviceSeriesRefs) {
    if (!seriesSlugs.has(ref.slug)) {
      errors.push(`${ref.filePath}: references missing series slug "${ref.slug}"`);
    }
  }

  if (errors.length > 0) {
    console.error("Validation failed with the following issues:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Validation passed (${songFiles.length} songs, ${serviceFiles.length} services, ${seriesFiles.length} series).`);
}

run().catch((error: unknown) => {
  console.error("Validation failed due to unexpected error.");
  console.error(error);
  process.exit(1);
});
