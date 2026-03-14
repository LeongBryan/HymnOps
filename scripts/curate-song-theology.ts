import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";

type AnyRecord = Record<string, unknown>;

interface SongFile {
  filePath: string;
  fileName: string;
  data: AnyRecord;
  body: string;
}

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

interface PageSnapshot {
  finalUrl: string;
  title: string;
  description: string;
  text: string;
}

interface SourceMatch {
  sourceUrl: string;
  sourceTitle: string;
  verification: string;
  analysisText: string;
}

interface ReviewOverride {
  slug: string;
  title: string;
  ccli_number: string | null;
  guess_source_url: string | null;
  guess_source_title: string | null;
  opening_line_guess: string | null;
  guess_confidence: "high" | "medium" | "low";
  notes: string | null;
}

interface AuditEntry {
  slug: string;
  title: string;
  status: "updated" | "unconfirmed" | "unchanged";
  source_url: string | null;
  source_title: string | null;
  verification: string | null;
  theological_summary: string | null;
  dominant_themes: string[];
  doctrinal_categories: string[];
}

interface TaxonomyRule {
  target: string;
  keywords: string[];
  minimumMatches?: number;
}

const ROOT = process.cwd();
const SONGS_DIR = path.join(ROOT, "songs");
const REPORT_PATH = path.join(ROOT, "reports", "song-theology-audit.json");
const REVIEW_OVERRIDE_PATH = path.join(ROOT, "reports", "song-theolog-unconfirmed.json");

const THEME_ORDER = [
  "Adoration",
  "Assurance",
  "Atonement",
  "Awe",
  "Community",
  "Compassion",
  "Contentment",
  "Creation",
  "Cross",
  "Discipleship",
  "Evangelism",
  "Faithfulness",
  "Forgiveness",
  "Grace",
  "Guidance",
  "Holiness",
  "Hope",
  "Identity in Christ",
  "Joy",
  "Kingdom of God",
  "Lament",
  "Mission",
  "Peace",
  "Providence",
  "Repentance",
  "Resurrection",
  "Sanctification",
  "Second Coming",
  "Sending",
  "Sovereignty",
  "Thanksgiving"
] as const;

const DOCTRINE_ORDER = [
  "Christology",
  "Ecclesiology",
  "Eschatology",
  "Lament",
  "Mission",
  "Pneumatology",
  "Providence",
  "Sanctification",
  "Scripture",
  "Soteriology",
  "Trinity",
  "Worship"
] as const;

const THEME_RULES: TaxonomyRule[] = [
  { target: "Adoration", keywords: ["worship", "praise", "glory", "worthy", "hallelujah", "exalt", "adore"], minimumMatches: 2 },
  { target: "Assurance", keywords: ["assurance", "secure", "hold me", "confidence", "i'm safe", "keep me"], minimumMatches: 1 },
  { target: "Atonement", keywords: ["cross", "blood", "calvary", "sacrifice", "atonement", "ransom", "wrath"], minimumMatches: 1 },
  { target: "Awe", keywords: ["wonder", "majesty", "awe", "mystery"], minimumMatches: 1 },
  { target: "Community", keywords: ["together", "family", "one voice", "one body", "saints", "church", "one another", "disciples"], minimumMatches: 1 },
  { target: "Compassion", keywords: ["compassion", "mercy", "kindness", "tender"], minimumMatches: 1 },
  { target: "Contentment", keywords: ["enough", "satisfied", "all i need", "portion"], minimumMatches: 1 },
  { target: "Creation", keywords: ["creation", "creatures", "heavens", "earth", "stars", "sun", "moon"], minimumMatches: 1 },
  { target: "Cross", keywords: ["cross", "calvary", "crucified"], minimumMatches: 1 },
  { target: "Discipleship", keywords: ["follow", "obey", "surrender", "take my life", "walk with", "trust and obey", "commandment", "disciple"], minimumMatches: 1 },
  { target: "Evangelism", keywords: ["sinners", "come to jesus", "save the lost", "call to faith"], minimumMatches: 1 },
  { target: "Faithfulness", keywords: ["faithful", "steadfast", "never fails", "unchanging"], minimumMatches: 2 },
  { target: "Forgiveness", keywords: ["forgive", "forgiven", "pardon", "washed away my sin", "cleansed"], minimumMatches: 1 },
  { target: "Grace", keywords: ["grace", "mercy", "undeserved"], minimumMatches: 1 },
  { target: "Guidance", keywords: ["lead", "guide", "shepherd", "way", "thy word", "your word"], minimumMatches: 2 },
  { target: "Holiness", keywords: ["holy", "holiness", "purify", "refiner", "clean heart"], minimumMatches: 2 },
  { target: "Hope", keywords: ["hope", "anchor", "future", "confidence"], minimumMatches: 2 },
  { target: "Identity in Christ", keywords: ["adopted", "child of god", "belong", "in christ", "redeemed"], minimumMatches: 1 },
  { target: "Joy", keywords: ["joy", "rejoice", "glad"], minimumMatches: 2 },
  { target: "Kingdom of God", keywords: ["kingdom", "king", "throne", "reign"], minimumMatches: 2 },
  { target: "Lament", keywords: ["sorrow", "tears", "grief", "cry", "darkness", "how long"], minimumMatches: 1 },
  { target: "Mission", keywords: ["nations", "gospel", "proclaim", "unfinished task", "to the world"], minimumMatches: 2 },
  { target: "Peace", keywords: ["peace", "be still", "calm"], minimumMatches: 1 },
  { target: "Providence", keywords: ["sovereign", "sustain", "provide", "hold me", "lead me", "keep me"], minimumMatches: 2 },
  { target: "Repentance", keywords: ["repent", "search me", "cleanse me", "turn from"], minimumMatches: 1 },
  { target: "Resurrection", keywords: ["risen", "alive", "grave", "death could not", "resurrection"], minimumMatches: 1 },
  { target: "Sanctification", keywords: ["make me holy", "sanctify", "purify", "refine", "consecrate", "obedience"], minimumMatches: 1 },
  { target: "Second Coming", keywords: ["coming again", "return", "that day", "final day", "until he comes"], minimumMatches: 1 },
  { target: "Sending", keywords: ["send us", "send me", "here am i", "go"], minimumMatches: 2 },
  { target: "Sovereignty", keywords: ["sovereign", "reign", "rules", "throne"], minimumMatches: 2 },
  { target: "Thanksgiving", keywords: ["thank you", "thanks", "gratitude"], minimumMatches: 1 }
];

const DOCTRINE_RULES: TaxonomyRule[] = [
  { target: "Christology", keywords: ["jesus", "christ", "son of god", "lamb of god", "lord", "saviour"], minimumMatches: 2 },
  { target: "Ecclesiology", keywords: ["church", "body", "family", "saints", "one voice", "one body", "one another", "disciples"], minimumMatches: 1 },
  { target: "Eschatology", keywords: ["heaven", "coming again", "return", "that day", "higher throne", "final"], minimumMatches: 1 },
  { target: "Lament", keywords: ["sorrow", "tears", "grief", "darkness", "how long"], minimumMatches: 1 },
  { target: "Mission", keywords: ["nations", "gospel", "proclaim", "send", "unfinished task"], minimumMatches: 2 },
  { target: "Pneumatology", keywords: ["holy spirit", "spirit of god", "living breath"], minimumMatches: 1 },
  { target: "Providence", keywords: ["sovereign", "provide", "sustain", "keep me", "lead me", "hold me"], minimumMatches: 2 },
  { target: "Sanctification", keywords: ["holy", "sanctify", "purify", "refine", "obey", "follow"], minimumMatches: 2 },
  { target: "Scripture", keywords: ["your word", "thy word", "scripture", "lamp", "speak o lord", "teach us"], minimumMatches: 1 },
  { target: "Soteriology", keywords: ["salvation", "save", "saved", "forgive", "forgiven", "redeem", "redeemed", "cross", "blood", "sin", "grace", "mercy", "ransom", "wrath", "calvary"], minimumMatches: 2 },
  { target: "Trinity", keywords: ["father", "son", "spirit", "triune"], minimumMatches: 2 },
  { target: "Worship", keywords: ["worship", "praise", "glory", "worthy", "hallelujah", "adore", "sing"], minimumMatches: 2 }
];

const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "is",
  "my",
  "of",
  "on",
  "the",
  "to",
  "with",
  "your",
  "you"
]);

const GENERIC_WORDS = new Set([
  "all",
  "always",
  "amazing",
  "bless",
  "blessing",
  "christ",
  "cornerstone",
  "day",
  "forever",
  "friend",
  "god",
  "grace",
  "great",
  "hallelujah",
  "heaven",
  "holy",
  "hope",
  "jesus",
  "joy",
  "king",
  "lord",
  "love",
  "mercy",
  "name",
  "one",
  "rejoice",
  "salvation",
  "thank",
  "trust",
  "worthy"
]);

const PLACEHOLDER_SUMMARY_PATTERN =
  /update with (?:a )?(?:2-5 sentence )?non-lyrical theological summary/i;

const SPECIAL_UNCONFIRMED_PATTERN = /once the exact song version is confirmed/i;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

const BLOCKED_SOURCE_DOMAINS = new Set([
  "genius.com",
  "www.genius.com",
  "azlyrics.com",
  "www.azlyrics.com",
  "musixmatch.com",
  "www.musixmatch.com",
  "lyricsmode.com",
  "www.lyricsmode.com",
  "lyricsondemand.com",
  "www.lyricsondemand.com"
]);

const NON_LYRIC_SOURCE_DOMAINS = new Set([
  "songselect.ccli.com",
  "wordtoworship.com",
  "www.wordtoworship.com"
]);

const PREFERRED_SOURCE_DOMAINS = [
  "cityalight.com",
  "bensleemusic.com",
  "sovereigngracemusic.com",
  "hillsong.com",
  "zionlyrics.com",
  "letras.com",
  "praisecharts.com",
  "hymnary.org",
  "pnwarchive.com",
  "wordtoworship.com",
  "theworshiplyrics.com",
  "divinehymns.org",
  "lyrics.com"
];

const TITLE_NOISE_WORDS = new Set(["a", "an", "and", "of", "the", "my", "our", "to", "in", "on"]);

const MANUAL_METADATA_OVERRIDES: Record<
  string,
  {
    ccli_number?: string | null;
    songselect_url?: string | null;
    original_artist?: string | null;
    writers?: string[];
  }
> = {
  "ancient-of-days": {
    ccli_number: "7121851",
    songselect_url: "https://songselect.ccli.com/songs/7121851/ancient-of-days",
    original_artist: "CityAlight",
    writers: ["Jonny Robinson", "Rich Thompson", "Michael Farren", "Jesse Reeves"]
  },
  "at-the-cross": {
    ccli_number: "4591816",
    songselect_url: "https://songselect.ccli.com/songs/4591816/at-the-cross",
    original_artist: "Hillsong Worship",
    writers: ["Darlene Zschech", "Reuben Morgan"]
  },
  "behold-the-lamb": {
    ccli_number: "5003372",
    songselect_url: "https://songselect.ccli.com/songs/5003372/behold-the-lamb-communion-hymn",
    original_artist: "Keith & Kristyn Getty",
    writers: ["Keith Getty", "Kristyn Getty", "Stuart Townend"]
  },
  "creator-god": {
    ccli_number: "7089057",
    songselect_url: "https://songselect.ccli.com/songs/7089057/creator-god",
    original_artist: "Ben Slee",
    writers: ["Ben Slee"]
  },
  "he-is-lord": {
    ccli_number: "5065918",
    songselect_url: "https://songselect.ccli.com/songs/5065918/he-is-lord",
    original_artist: "Hillsong Worship",
    writers: ["Ben Fielding"]
  }
};

function parseArgs(): { limit: number | null; slugs: Set<string> } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  const slugs = new Set<string>();
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--limit") {
      const parsed = Number.parseInt(args[i + 1] ?? "", 10);
      limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
    if (args[i] === "--slug" && typeof args[i + 1] === "string") {
      slugs.add(args[i + 1]);
    }
  }
  return { limit, slugs };
}

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
  return normalizeSpace(input.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " "));
}

function titleWords(title: string): string[] {
  return normalizeLoose(title)
    .split(" ")
    .filter((word) => word.length > 1 && !TITLE_STOP_WORDS.has(word));
}

function isGenericTitle(title: string): boolean {
  const words = titleWords(title);
  return words.length <= 2 || words.every((word) => GENERIC_WORDS.has(word));
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function uniqueOrdered(values: string[], order: readonly string[]): string[] {
  const valueSet = new Set(values);
  return order.filter((item) => valueSet.has(item));
}

function hasPlaceholderSummary(value: unknown): boolean {
  return typeof value === "string" && (PLACEHOLDER_SUMMARY_PATTERN.test(value) || SPECIAL_UNCONFIRMED_PATTERN.test(value));
}

function stripPastoralUseSection(body: string): string {
  const nextBody = body.replace(/^##\s+Pastoral Use\s*$[\r\n]+[\s\S]*?(?=^##\s+.+$|$)/gim, "").trimEnd();
  return nextBody.length === 0 ? "" : `${nextBody}\n`;
}

async function listSongFiles(): Promise<SongFile[]> {
  const entries = await fs.readdir(SONGS_DIR, { withFileTypes: true });
  const files: SongFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const filePath = path.join(SONGS_DIR, entry.name);
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = matter(raw);
    files.push({
      filePath,
      fileName: entry.name,
      data: parsed.data as AnyRecord,
      body: parsed.content
    });
  }
  return files.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

async function loadReviewOverrides(): Promise<Map<string, ReviewOverride>> {
  try {
    const raw = await fs.readFile(REVIEW_OVERRIDE_PATH, "utf8");
    const parsed = JSON.parse(raw) as ReviewOverride[];
    return new Map(parsed.map((entry) => [entry.slug, entry]));
  } catch {
    return new Map();
  }
}

async function fetchText(url: string, timeoutMs: number): Promise<{ finalUrl: string; text: string }> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (response.ok) {
      return {
        finalUrl: response.url,
        text: await response.text()
      };
    }
    if (response.status !== 429) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    lastError = new Error(`HTTP ${response.status} for ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  throw lastError ?? new Error(`Unable to fetch ${url}`);
}

function hostName(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

function isBlockedOrNonLyricDomain(url: string): boolean {
  const host = hostName(url);
  return BLOCKED_SOURCE_DOMAINS.has(host) || NON_LYRIC_SOURCE_DOMAINS.has(host);
}

function extractMetaContent(html: string, keys: string[]): string {
  for (const key of keys) {
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["'][^>]*>`, "i")
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return normalizeSpace(decodeHtmlEntities(match[1]));
      }
    }
  }
  return "";
}

function stripHtml(html: string): string {
  return normalizeSpace(
    decodeHtmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

async function fetchPageSnapshot(url: string): Promise<PageSnapshot> {
  let finalUrl = url;
  let title = "";
  let description = "";
  let rawText = "";

  try {
    const direct = await fetchText(url, 15000);
    finalUrl = direct.finalUrl;
    const titleMatch = direct.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    title = titleMatch ? normalizeSpace(decodeHtmlEntities(titleMatch[1])) : "";
    description = extractMetaContent(direct.text, ["description", "og:description", "twitter:description"]);
    if (!/request for access|not acceptable|captcha/i.test(title)) {
      rawText = stripHtml(direct.text).slice(0, 4000);
    }
  } catch {
    // Fall through to proxy fetch below.
  }

  try {
    const proxyUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, "")}`;
    const proxy = await fetchText(proxyUrl, 40000);
    if (proxy.text.length > 0 && !/"code":451|"status":45102|requiring CAPTCHA/i.test(proxy.text)) {
      rawText = `${rawText}\n${proxy.text.slice(0, 16000)}`;
    }
  } catch {
    // Keep whatever we captured from the direct response.
  }

  if (!title && rawText.length === 0 && description.length === 0) {
    throw new Error(`Unable to fetch usable content from ${url}`);
  }

  return {
    finalUrl,
    title,
    description,
    text: extractFocusedLyricText(description, rawText)
  };
}

function decodeDuckDuckGoUrl(rawUrl: string): string {
  const withProtocol = rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;
  const parsed = new URL(withProtocol);
  const target = parsed.searchParams.get("uddg");
  return target ? target : withProtocol;
}

function normalizeBaseTitle(input: string): string {
  return normalizeLoose(input.replace(/\s*\([^)]*\)\s*/g, " "));
}

function significantTitleTokens(input: string): string[] {
  return normalizeBaseTitle(input)
    .split(" ")
    .filter((token) => token.length > 1 && !TITLE_NOISE_WORDS.has(token));
}

function strongTitleMatch(expectedTitle: string, candidateTitle: string): boolean {
  const expected = normalizeBaseTitle(expectedTitle);
  const candidate = normalizeBaseTitle(candidateTitle);
  if (expected === candidate) return true;

  const expectedTokens = significantTitleTokens(expectedTitle);
  const candidateTokens = new Set(significantTitleTokens(candidateTitle));
  const overlap = expectedTokens.filter((token) => candidateTokens.has(token)).length;
  return overlap >= Math.max(2, Math.ceil(expectedTokens.length * 0.75));
}

async function searchWordToWorship(query: string): Promise<SearchResult[]> {
  const url = `https://wordtoworship.com/search/node/${encodeURIComponent(query)}`;
  const response = await fetchText(`https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`, 30000);
  if (/Your search yielded no results/i.test(response.text)) {
    return [];
  }

  const results: SearchResult[] = [];
  const pattern =
    /### \[(.+?)\]\((https?:\/\/wordtoworship\.com\/song\/\d+)\)\s*(?:\r?\n)+(?:By .+?\r?\n)?(?:Keywords:\s*(.+?)\r?\n)?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(response.text)) !== null) {
    results.push({
      url: match[2],
      title: normalizeSpace(decodeHtmlEntities(match[1])),
      snippet: normalizeSpace(decodeHtmlEntities(match[3] ?? ""))
    });
  }
  return results;
}

async function searchSong(title: string, ccliNumber: string | null, writers: string[], originalArtist: string | null): Promise<SearchResult[]> {
  const surname = writers[0]?.split(/\s+/).slice(-1)[0] ?? "";
  const queryVariants = [
    [title, originalArtist ?? surname, "lyrics"],
    [title, ccliNumber ?? "", "lyrics"],
    [title, surname, "lyrics"],
    [title, "lyrics"]
  ]
    .map((parts) => parts.filter((part) => part.length > 0).join(" "))
    .filter((value, index, self) => self.indexOf(value) === index);

  const results: SearchResult[] = [];

  const wordToWorshipQueries = [
    ccliNumber,
    title,
    writers[0] ? `${title} ${writers[0]}` : null
  ].filter((value, index, self): value is string => Boolean(value) && self.indexOf(value) === index);

  for (const query of wordToWorshipQueries) {
    try {
      const matches = await searchWordToWorship(query);
      for (const match of matches) {
        if (!results.some((result) => result.url === match.url) && strongTitleMatch(title, match.title)) {
          results.push(match);
        }
      }
    } catch {
      // Fall back to search engine results below.
    }
  }

  if (results.length >= 4) {
    return results.sort((left, right) => sourcePriority(left.url) - sourcePriority(right.url));
  }

  for (const query of queryVariants) {
    const response = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      continue;
    }

    const html = await response.text();
    const pattern =
      /<a rel="nofollow" href="(.*?)" class=['"]result-link['"]>(.*?)<\/a>[\s\S]*?(?:<td class=['"]result-snippet['"]>([\s\S]*?)<\/td>)?/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const url = decodeDuckDuckGoUrl(decodeHtmlEntities(match[1]));
      if (isBlockedOrNonLyricDomain(url)) {
        continue;
      }
      const nextResult = {
        url,
        title: normalizeSpace(decodeHtmlEntities(match[2]).replace(/<[^>]+>/g, " ")),
        snippet: normalizeSpace(decodeHtmlEntities((match[3] ?? "").replace(/<[^>]+>/g, " ")))
      };
      if (!results.some((result) => result.url === nextResult.url)) {
        results.push(nextResult);
      }
      if (results.length >= 8) {
        break;
      }
    }
    if (results.length >= 4) {
      break;
    }
  }

  return results
    .filter((result, index, self) => self.findIndex((item) => item.url === result.url) === index)
    .sort((left, right) => sourcePriority(left.url) - sourcePriority(right.url));
}

function writerSignals(writers: string[]): string[] {
  return writers
    .flatMap((writer) => {
      const parts = normalizeLoose(writer).split(" ").filter(Boolean);
      return parts.length > 0 ? [parts[parts.length - 1], ...parts] : [];
    })
    .filter((value, index, self) => value.length > 2 && self.indexOf(value) === index);
}

function titleMatches(expectedTitle: string, ...candidates: string[]): boolean {
  return candidates.some((candidate) => strongTitleMatch(expectedTitle, candidate));
}

function confirmSource(
  song: SongFile,
  searchResult: SearchResult,
  snapshot: PageSnapshot
): SourceMatch | null {
  const title = typeof song.data.title === "string" ? song.data.title : path.basename(song.fileName, ".md");
  const originalArtist = typeof song.data.original_artist === "string" ? song.data.original_artist : null;
  const ccliNumber = typeof song.data.ccli_number === "string" ? song.data.ccli_number : null;
  const writers = arrayOfStrings(song.data.writers);

  const combined = `${searchResult.title}\n${searchResult.snippet}\n${snapshot.title}\n${snapshot.description}\n${snapshot.text}`;
  const exactTitleMatch = titleMatches(title, searchResult.title, snapshot.title, snapshot.finalUrl);
  if (!exactTitleMatch) {
    return null;
  }

  const lowerCombined = normalizeLoose(combined);
  const writerMatch = writerSignals(writers).some((signal) => lowerCombined.includes(signal));
  const artistMatch = originalArtist ? titleMatches(originalArtist, searchResult.title, snapshot.title, snapshot.description, snapshot.text, snapshot.finalUrl) : false;
  const ccliMatch = ccliNumber ? combined.includes(ccliNumber) : false;
  const genericTitle = isGenericTitle(title);
  const hasLyricSignal = hasLyricShape(snapshot.text || snapshot.description);

  if (!hasLyricSignal) {
    return null;
  }

  if (genericTitle && !(writerMatch || artistMatch || ccliMatch)) {
    return null;
  }

  return {
    sourceUrl: snapshot.finalUrl,
    sourceTitle: snapshot.title || searchResult.title,
    verification: writerMatch
      ? "matched title and writer metadata"
      : artistMatch
        ? "matched title and original artist metadata"
        : ccliMatch
          ? "matched title with CCLI id on source"
          : "matched exact title with lyric-bearing source",
    analysisText: snapshot.text || searchResult.snippet || combined
  };
}

function collectTaxonomy(
  text: string,
  existing: string[],
  rules: TaxonomyRule[],
  order: readonly string[],
  maxAdditions: number
): string[] {
  const normalized = normalizeLoose(text);
  const existingSet = new Set(existing);
  const additions = rules
    .map((rule) => {
      const matches = rule.keywords.filter((keyword) => normalized.includes(normalizeLoose(keyword)));
      const minimumMatches = rule.minimumMatches ?? 1;
      return {
        target: rule.target,
        count: matches.length,
        passes: matches.length >= minimumMatches
      };
    })
    .filter((item) => item.passes && !existingSet.has(item.target))
    .sort((left, right) => right.count - left.count || order.indexOf(left.target) - order.indexOf(right.target))
    .slice(0, maxAdditions)
    .map((item) => item.target);

  return uniqueOrdered([...existing, ...additions], order);
}

function detectTaxonomy(text: string, rules: TaxonomyRule[], order: readonly string[]): string[] {
  const normalized = normalizeLoose(text);
  const detected = new Set<string>();
  for (const rule of rules) {
    const matches = rule.keywords.filter((keyword) => normalized.includes(normalizeLoose(keyword)));
    const minimumMatches = rule.minimumMatches ?? 1;
    if (matches.length >= minimumMatches) {
      detected.add(rule.target);
    }
  }
  return uniqueOrdered([...detected], order);
}

function buildSummary(text: string, themes: string[], doctrines: string[]): string | null {
  const themeSet = new Set(themes);
  const doctrineSet = new Set(doctrines);

  let firstSentence = "";
  if (themeSet.has("Cross") || themeSet.has("Atonement") || doctrineSet.has("Soteriology")) {
    firstSentence = "This song centers on Christ's atoning work, presenting his death as the means by which sinners are forgiven, cleansed, and brought near to God.";
  } else if (themeSet.has("Resurrection")) {
    firstSentence = "This song celebrates the resurrection of Jesus and the living hope, victory, and confidence that flow from his triumph over sin and death.";
  } else if (themeSet.has("Creation") && doctrineSet.has("Worship")) {
    firstSentence = "This song summons creation and the gathered church to praise God's majesty, holiness, and sovereign rule.";
  } else if (themeSet.has("Mission") || doctrineSet.has("Mission")) {
    firstSentence = "This song frames the church as a sent people, calling believers to proclaim Christ faithfully and carry the gospel to the nations.";
  } else if (themeSet.has("Second Coming") || doctrineSet.has("Eschatology")) {
    firstSentence = "This song directs the church toward future hope, fixing confidence on Christ's return and the consummation of his kingdom.";
  } else if (themeSet.has("Community") || doctrineSet.has("Ecclesiology")) {
    firstSentence = "This song highlights the shared life of God's people, portraying the church as a united community gathered in worship and mutual encouragement.";
  } else if (themeSet.has("Sanctification") || doctrineSet.has("Sanctification") || themeSet.has("Holiness")) {
    firstSentence = "This song prays for holiness and transformed obedience, asking God to purify his people and conform them more fully to Christ.";
  } else if (themeSet.has("Providence") || doctrineSet.has("Providence") || themeSet.has("Assurance")) {
    firstSentence = "This song teaches trust in God's faithful care, encouraging believers to rest in his guidance, sustaining power, and covenant love.";
  } else if (doctrineSet.has("Scripture")) {
    firstSentence = "This song emphasizes God's word as truth, light, and the shaping authority for the believer's faith and obedience.";
  } else if (themeSet.has("Lament") || doctrineSet.has("Lament")) {
    firstSentence = "This song gives the church language for grief and waiting, bringing sorrow honestly before God while holding fast to his mercy and promises.";
  } else {
    firstSentence = "This song calls the congregation to worship God with reverence, gratitude, and confidence in his character and saving purposes.";
  }

  const secondParts: string[] = [];
  if (themeSet.has("Thanksgiving")) {
    secondParts.push("responds with gratitude for grace already received");
  }
  if (themeSet.has("Discipleship")) {
    secondParts.push("presses worship toward obedient discipleship");
  }
  if (themeSet.has("Hope") || doctrineSet.has("Eschatology")) {
    secondParts.push("anchors believers in durable hope");
  }
  if (themeSet.has("Kingdom of God") || themeSet.has("Sovereignty")) {
    secondParts.push("confesses the reign of Christ the King");
  }
  if (themeSet.has("Grace") && !secondParts.some((part) => part.includes("grace"))) {
    secondParts.push("emphasizes unearned grace");
  }
  if (doctrineSet.has("Trinity")) {
    secondParts.push("speaks of God's saving work in a recognizably trinitarian way");
  }

  const secondSentence = secondParts.length > 0 ? `It ${secondParts.join(" and ")}.` : "";
  const summary = normalizeSpace(`${firstSentence} ${secondSentence}`);
  return summary.length > 0 ? summary : null;
}

function capitalize(value: string): string {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function sourcePriority(url: string): number {
  const host = hostName(url);
  const index = PREFERRED_SOURCE_DOMAINS.findIndex((domain) => host === domain || host.endsWith(`.${domain}`));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function hasLyricShape(text: string): boolean {
  const expanded = text.replace(/\s+\/\s+/g, "\n");
  const lines = expanded
    .split(/\r?\n/)
    .map((line) => normalizeSpace(line))
    .filter((line) => line.length >= 5 && line.length <= 120);
  return /(?:^|\n)\s*(verse|chorus|bridge|refrain)\b/i.test(expanded) || lines.length >= 4;
}

function extractFocusedLyricText(description: string, rawText: string): string {
  const text = rawText
    .replace(/^Title:.*$/gim, "")
    .replace(/^URL Source:.*$/gim, "")
    .replace(/^Markdown Content:.*$/gim, "")
    .replace(/!\[.*?\]\(.*?\)/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\r/g, "");

  let working = text;
  const lyricStartPatterns = [
    /(?:^|\n)\s*Lyrics Verified.*$/im,
    /(?:^|\n)\s*(VERSE|CHORUS|BRIDGE|REFRAIN)\b/im,
    /(?:^|\n)\s*Lyrics\b.*$/im
  ];
  for (const pattern of lyricStartPatterns) {
    const match = working.match(pattern);
    if (match?.index !== undefined) {
      working = working.slice(match.index);
      break;
    }
  }

  const endPatterns = [
    /(?:^|\n)\s*Official Video\b/im,
    /(?:^|\n)\s*Song Details\b/im,
    /(?:^|\n)\s*More from\b/im,
    /(?:^|\n)\s*Album\b/im,
    /(?:^|\n)\s*Writers?:\b/im,
    /(?:^|\n)\s*Share\b/im
  ];
  for (const pattern of endPatterns) {
    const match = working.match(pattern);
    if (match?.index !== undefined) {
      working = working.slice(0, match.index);
      break;
    }
  }

  const lyricLines = working
    .replace(/\s+\/\s+/g, "\n")
    .split(/\n+/)
    .map((line) => normalizeSpace(line))
    .filter((line) => {
      if (line.length < 4 || line.length > 140) return false;
      if (/^(menu|search|subscribe|log in|account|close|options|notifications|performed by|category|total views|home \/)/i.test(line)) {
        return false;
      }
      if (/^image \d+/i.test(line)) return false;
      if (/^https?:\/\//i.test(line)) return false;
      return true;
    })
    .slice(0, 80);

  const focused = lyricLines.join("\n");
  return focused.length > 0 ? focused : normalizeSpace(description);
}

async function findConfirmedSource(song: SongFile, reviewOverride: ReviewOverride | null): Promise<SourceMatch | null> {
  const title = typeof song.data.title === "string" ? song.data.title : path.basename(song.fileName, ".md");
  const ccliNumber = typeof song.data.ccli_number === "string" ? song.data.ccli_number : null;
  const writers = arrayOfStrings(song.data.writers);
  const originalArtist = typeof song.data.original_artist === "string" ? song.data.original_artist : null;

  if (reviewOverride) {
    if (reviewOverride.guess_source_url) {
      try {
        const snapshot = await fetchPageSnapshot(reviewOverride.guess_source_url);
        return {
          sourceUrl: snapshot.finalUrl,
          sourceTitle: reviewOverride.guess_source_title ?? snapshot.title ?? title,
          verification: `matched confirmed review source (${reviewOverride.guess_confidence} confidence)`,
          analysisText: normalizeSpace(`${reviewOverride.opening_line_guess ?? ""}\n${snapshot.text}`) || snapshot.text
        };
      } catch {
        // Fall through to text-only override.
      }
    }

    if (reviewOverride.opening_line_guess) {
      return {
        sourceUrl: reviewOverride.guess_source_url ?? `review:${title}`,
        sourceTitle: reviewOverride.guess_source_title ?? title,
        verification: `matched confirmed review note (${reviewOverride.guess_confidence} confidence)`,
        analysisText: normalizeSpace(`${reviewOverride.opening_line_guess}\n${reviewOverride.notes ?? ""}`)
      };
    }
  }

  const searchResults = await searchSong(title, ccliNumber, writers, originalArtist);
  for (const result of searchResults) {
    try {
      const snapshot = await fetchPageSnapshot(result.url);
      const confirmed = confirmSource(song, result, snapshot);
      if (confirmed) {
        return confirmed;
      }
    } catch {
      // Skip failed sources and keep searching.
    }
  }
  return null;
}

async function writeSongFile(file: SongFile, nextData: AnyRecord, nextBody: string): Promise<void> {
  const output = matter.stringify(nextBody, nextData);
  await fs.writeFile(file.filePath, output, "utf8");
}

async function main(): Promise<void> {
  const { limit, slugs } = parseArgs();
  const songs = await listSongFiles();
  const reviewOverrides = await loadReviewOverrides();
  const audit: AuditEntry[] = [];
  let processed = 0;

  for (const song of songs) {
    const nextData: AnyRecord = { ...song.data };
    const nextBody = stripPastoralUseSection(song.body);
    const slug = typeof song.data.slug === "string" ? song.data.slug : path.basename(song.fileName, ".md");
    const reviewOverride = reviewOverrides.get(slug) ?? null;
    const manualOverride = MANUAL_METADATA_OVERRIDES[slug];

    if (manualOverride?.ccli_number !== undefined) {
      nextData.ccli_number = manualOverride.ccli_number;
    } else if (reviewOverride?.ccli_number) {
      nextData.ccli_number = reviewOverride.ccli_number;
    }
    if (manualOverride?.songselect_url !== undefined) {
      nextData.songselect_url = manualOverride.songselect_url;
    } else if (typeof nextData.ccli_number === "string" && nextData.ccli_number.length > 0) {
      const normalizedSlug = slug.replace(/\s+/g, "-");
      nextData.songselect_url = `https://songselect.ccli.com/songs/${nextData.ccli_number}/${normalizedSlug}`;
    }
    if (manualOverride?.original_artist !== undefined) {
      nextData.original_artist = manualOverride.original_artist;
    }
    if (manualOverride?.writers) {
      nextData.writers = manualOverride.writers;
    }

    const placeholderSummary = hasPlaceholderSummary(song.data.theological_summary);
    const unresolvedSummary = placeholderSummary || song.data.theological_summary === null;
    const shouldProcessSummary = slugs.size > 0 ? slugs.has(slug) : unresolvedSummary;

    let status: AuditEntry["status"] = "unchanged";
    let source: SourceMatch | null = null;

    if (shouldProcessSummary) {
      if (limit !== null && processed >= limit) {
        break;
      }
      processed += 1;
      console.log(`[${processed}] ${nextData.slug ?? song.fileName}`);

      const effectiveSong: SongFile = {
        ...song,
        data: nextData
      };
      source = await findConfirmedSource(effectiveSong, reviewOverride);
      if (source) {
        const analysisText = source.analysisText;
        const detectedThemes = detectTaxonomy(analysisText, THEME_RULES, THEME_ORDER);
        const detectedDoctrines = detectTaxonomy(analysisText, DOCTRINE_RULES, DOCTRINE_ORDER);
        const nextThemes = collectTaxonomy(
          analysisText,
          arrayOfStrings(song.data.dominant_themes),
          THEME_RULES,
          THEME_ORDER,
          3
        );
        const nextDoctrines = collectTaxonomy(
          analysisText,
          arrayOfStrings(song.data.doctrinal_categories),
          DOCTRINE_RULES,
          DOCTRINE_ORDER,
          2
        );
        const summary = buildSummary(analysisText, nextThemes, nextDoctrines);

        nextData.theological_summary = summary;
        nextData.dominant_themes = nextThemes;
        nextData.doctrinal_categories = nextDoctrines;
        status = summary ? "updated" : "unconfirmed";
        if (!summary) {
          nextData.theological_summary = null;
        }
      } else {
        nextData.theological_summary = null;
        status = "unconfirmed";
      }
    }

    if (normalizeSpace(nextBody) !== normalizeSpace(song.body) || status !== "unchanged") {
      await writeSongFile(song, nextData, nextBody);
    }

    if (shouldProcessSummary || normalizeSpace(nextBody) !== normalizeSpace(song.body)) {
      audit.push({
        slug: typeof nextData.slug === "string" ? nextData.slug : path.basename(song.fileName, ".md"),
        title: typeof nextData.title === "string" ? nextData.title : path.basename(song.fileName, ".md"),
        status,
        source_url: source?.sourceUrl ?? null,
        source_title: source?.sourceTitle ?? null,
        verification: source?.verification ?? null,
        theological_summary: nextData.theological_summary as string | null,
        dominant_themes: arrayOfStrings(nextData.dominant_themes),
        doctrinal_categories: arrayOfStrings(nextData.doctrinal_categories)
      });
    }
  }

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  console.log(`Wrote audit report to ${REPORT_PATH}`);
}

main().catch((error: unknown) => {
  console.error("Song theology curation failed.");
  console.error(error);
  process.exit(1);
});
