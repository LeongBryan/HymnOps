import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

interface UnconfirmedSong {
  slug: string;
  title: string;
  ccli_number: string | null;
}

interface SongMeta extends UnconfirmedSong {
  aka: string[];
  writers: string[];
}

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

interface ReviewEntry extends UnconfirmedSong {
  guess_source_url: string | null;
  guess_source_title: string | null;
  opening_line_guess: string | null;
  opening_line_truncated: boolean;
  guess_confidence: "high" | "medium" | "low";
  review_status: "pending_user_confirmation";
  notes: string | null;
}

const ROOT = process.cwd();
const INPUT_PATH = path.join(ROOT, "reports", "song-theology-unconfirmed.json");
const OUTPUT_PATH = path.join(ROOT, "reports", "song-theolog-unconfirmed.json");
const SONGS_DIR = path.join(ROOT, "songs");
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const WORD_TO_WORSHIP_BASE = "https://wordtoworship.com";
const STOP_WORDS = new Set(["a", "an", "and", "of", "the", "my", "our", "to", "in", "on"]);

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_match, digits) => String.fromCharCode(Number.parseInt(digits, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function normalizeSpace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function normalizeLoose(input: string): string {
  return normalizeSpace(
    input
      .toLowerCase()
      .replace(/saviour/g, "savior")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
  );
}

function normalizeBaseTitle(input: string): string {
  return normalizeLoose(input.replace(/\s*\([^)]*\)\s*/g, " "));
}

function hostName(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

function titleVariants(song: SongMeta): string[] {
  const variants = [song.title, ...song.aka]
    .map((value) => normalizeLoose(value))
    .filter((value, index, self) => value.length > 0 && self.indexOf(value) === index);
  const baseVariants = [song.title, ...song.aka]
    .map((value) => normalizeBaseTitle(value))
    .filter((value, index, self) => value.length > 0 && self.indexOf(value) === index);
  return [...new Set([...variants, ...baseVariants])];
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (response.ok) {
      return await response.text();
    }
    if (response.status !== 429) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    lastError = new Error(`HTTP ${response.status} for ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  throw lastError ?? new Error(`Request failed for ${url}`);
}

async function loadSongMeta(song: UnconfirmedSong): Promise<SongMeta> {
  const filePath = path.join(SONGS_DIR, `${song.slug}.md`);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  return {
    ...song,
    aka: Array.isArray(parsed.data.aka)
      ? parsed.data.aka.map((item: unknown) => String(item))
      : [],
    writers: Array.isArray(parsed.data.writers)
      ? parsed.data.writers.map((item: unknown) => String(item))
      : []
  };
}

function openingCue(line: string): { text: string; truncated: boolean } {
  const clean = normalizeSpace(line.replace(/^["']|["']$/g, ""));
  const words = clean.split(" ").filter((word) => word.length > 0);
  if (words.length <= 10) {
    return { text: clean, truncated: false };
  }
  return { text: `${words.slice(0, 10).join(" ")} ...`, truncated: true };
}

function takeCandidateLine(lines: string[]): string | null {
  for (const rawLine of lines) {
    const clean = normalizeSpace(rawLine.replace(/\*/g, "").replace(/\s+\/\s+/g, " "));
    if (clean.length < 4 || clean.length > 160) continue;
    if (/^(verse|chorus|bridge|refrain|tag|intro|ending|misc|lyrics|scripture|copyright)\b[:\s0-9-]*$/i.test(clean)) {
      continue;
    }
    if (/^(menu|search|account|close|options|notifications|register|login)$/i.test(clean)) {
      continue;
    }
    return clean;
  }
  return null;
}

function parseWordToWorshipResults(markdown: string): SearchResult[] {
  const results: SearchResult[] = [];
  const pattern =
    /### \[(.+?)\]\((https?:\/\/wordtoworship\.com\/song\/\d+)\)\s*(?:\r?\n)+(?:By .+?\r?\n)?(?:Keywords:\s*(.+?)\r?\n)?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    results.push({
      url: match[2],
      title: normalizeSpace(decodeHtmlEntities(match[1])),
      snippet: normalizeSpace(decodeHtmlEntities(match[3] ?? ""))
    });
  }
  return results;
}

async function searchWordToWorship(query: string): Promise<SearchResult[]> {
  const url = `${WORD_TO_WORSHIP_BASE}/search/node/${encodeURIComponent(query)}`;
  const markdown = await fetchText(`https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`, 30000);
  if (/Your search yielded no results/i.test(markdown)) {
    return [];
  }
  return parseWordToWorshipResults(markdown);
}

function writerTokens(song: SongMeta): string[] {
  return song.writers
    .flatMap((writer) => normalizeLoose(writer).split(" "))
    .filter((token) => token.length >= 4);
}

function significantTitleTokens(input: string): string[] {
  return normalizeBaseTitle(input)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function hasStrongTitleMatch(song: SongMeta, resultTitle: string): boolean {
  const variants = titleVariants(song);
  const normalizedTitle = normalizeLoose(resultTitle);
  const baseTitle = normalizeBaseTitle(resultTitle);
  if (variants.includes(normalizedTitle) || variants.includes(baseTitle)) {
    return true;
  }

  const songTokens = significantTitleTokens(song.title);
  const resultTokens = new Set(significantTitleTokens(resultTitle));
  const overlap = songTokens.filter((token) => resultTokens.has(token)).length;
  return overlap >= Math.max(2, Math.ceil(songTokens.length * 0.75));
}

function scoreWordToWorshipResult(song: SongMeta, result: SearchResult, matchedByCcli: boolean): number {
  const normalizedTitle = normalizeLoose(result.title);
  const baseTitle = normalizeBaseTitle(result.title);
  const variants = titleVariants(song);
  const haystack = normalizeLoose(`${result.title} ${result.snippet}`);
  let score = 0;

  if (variants.includes(normalizedTitle)) score += 8;
  if (variants.includes(baseTitle)) score += 7;
  if (variants.some((variant) => normalizedTitle.includes(variant) || variant.includes(normalizedTitle))) score += 4;
  if (variants.some((variant) => baseTitle.includes(variant) || variant.includes(baseTitle))) score += 3;

  const writers = writerTokens(song);
  const writerHits = writers.filter((token) => haystack.includes(token)).length;
  score += Math.min(writerHits, 3);

  if (matchedByCcli) score += 3;
  if (hostName(result.url).includes("wordtoworship.com")) score += 1;
  if (!hasStrongTitleMatch(song, result.title)) score -= 10;

  return score;
}

function extractLyricFromWordToWorship(markdown: string): string | null {
  const match = markdown.match(/\nLyrics:\s*\n([\s\S]*?)(?:\nCopyright:|\nCCLI2?:|\n\*   Log in|\nComments\b|$)/i);
  if (!match?.[1]) return null;

  const lines = match[1].split(/\n+/).map((line) => normalizeSpace(line));

  return takeCandidateLine(lines);
}

async function fetchOpeningLineFromWordToWorship(url: string): Promise<string | null> {
  const markdown = await fetchText(`https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`, 30000);
  return extractLyricFromWordToWorship(markdown);
}

function searchQueries(song: SongMeta): string[] {
  const queries: string[] = [];
  if (song.ccli_number) queries.push(song.ccli_number);
  queries.push(song.title);
  for (const aka of song.aka) queries.push(aka);
  if (song.writers.length > 0) {
    queries.push(`${song.title} ${song.writers[0]}`);
  }
  return queries.filter((value, index, self) => value.length > 0 && self.indexOf(value) === index);
}

async function findWordToWorshipMatch(song: SongMeta): Promise<{ result: SearchResult | null; notes: string[] }> {
  const notes: string[] = [];
  let bestResult: SearchResult | null = null;
  let bestScore = -1;

  for (const query of searchQueries(song)) {
    try {
      const matchedByCcli = song.ccli_number !== null && query === song.ccli_number;
      const results = await searchWordToWorship(query);
      for (const result of results) {
        const score = scoreWordToWorshipResult(song, result, matchedByCcli);
        if (score > bestScore) {
          bestScore = score;
          bestResult = result;
        }
      }
      if (bestScore >= 10) {
        if (!matchedByCcli) {
          notes.push(`Matched by Word to Worship search on "${query}".`);
        }
        break;
      }
    } catch (error) {
      notes.push(`Word to Worship search failed for "${query}": ${(error as Error).message}`);
    }
  }

  if (bestResult && !hasStrongTitleMatch(song, bestResult.title) && bestScore < 10) {
    return { result: null, notes };
  }

  return { result: bestResult, notes };
}

function inferConfidence(song: SongMeta, result: SearchResult | null, noteText: string | null): ReviewEntry["guess_confidence"] {
  if (!result) return "low";
  const score = scoreWordToWorshipResult(song, result, song.ccli_number !== null && result.snippet.includes(song.ccli_number));
  if (score >= 10 && !noteText) return "high";
  if (score >= 7) return "medium";
  return "low";
}

async function reviewSong(song: SongMeta): Promise<ReviewEntry> {
  const { result, notes } = await findWordToWorshipMatch(song);

  if (!result) {
    return {
      slug: song.slug,
      title: song.title,
      ccli_number: song.ccli_number,
      guess_source_url: null,
      guess_source_title: null,
      opening_line_guess: null,
      opening_line_truncated: false,
      guess_confidence: "low",
      review_status: "pending_user_confirmation",
      notes: "No Word to Worship match was strong enough for a best-guess opening line."
    };
  }

  let openingLine: string | null = null;
  let noteText = notes.length > 0 ? notes.join(" ") : null;

  try {
    openingLine = await fetchOpeningLineFromWordToWorship(result.url);
  } catch (error) {
    noteText = [noteText, `Source fetch failed: ${(error as Error).message}`]
      .filter((value): value is string => Boolean(value))
      .join(" ");
  }

  if (!openingLine && result.snippet.length > 0) {
    const snippetLine = takeCandidateLine(
      result.snippet
        .replace(/AKA:\s*/gi, "")
        .replace(/Lyrics:\s*/gi, "")
        .split(/\s{2,}|(?<=\.)\s+/)
        .map((line) => normalizeSpace(line))
    );
    if (snippetLine) {
      openingLine = snippetLine;
      noteText = [noteText, "Used search snippet because the lyric block was not extractable from the source page."]
        .filter((value): value is string => Boolean(value))
        .join(" ");
    }
  }

  const cue = openingLine ? openingCue(openingLine) : { text: null, truncated: false };

  return {
    slug: song.slug,
    title: song.title,
    ccli_number: song.ccli_number,
    guess_source_url: result.url,
    guess_source_title: result.title,
    opening_line_guess: cue.text,
    opening_line_truncated: cue.truncated,
    guess_confidence: inferConfidence(song, result, noteText),
    review_status: "pending_user_confirmation",
    notes: noteText
  };
}

async function main(): Promise<void> {
  const raw = await fs.readFile(INPUT_PATH, "utf8");
  const songs = JSON.parse(raw) as UnconfirmedSong[];
  const output: ReviewEntry[] = [];

  for (const unresolved of songs) {
    const song = await loadSongMeta(unresolved);
    console.log(`Reviewing ${song.slug}`);
    output.push(await reviewSong(song));
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${output.length} entries to ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error("Review generation failed.");
  console.error(error);
  process.exit(1);
});
