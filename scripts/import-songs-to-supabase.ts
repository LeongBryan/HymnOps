/**
 * import-songs-to-supabase.ts
 *
 * Reads every songs/*.md file and upserts into Supabase:
 *   songs, song_aliases, song_writers, song_themes, song_scriptures
 *
 * Usage:
 *   npx tsx --env-file .env.local scripts/import-songs-to-supabase.ts
 *
 * Required env vars (add to .env.local):
 *   SUPABASE_URL            (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";
import { createClient } from "@supabase/supabase-js";

// ─── Env ─────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  console.error("  Add them to .env.local and run with --env-file .env.local");
  process.exit(1);
}

console.log(`Connecting to: ${SUPABASE_URL}`);
console.log(`Key starts with: ${SERVICE_ROLE_KEY.slice(0, 12)}…`);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeStr(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

function normalizeInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function normalizeStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim());
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SONGS_DIR = path.resolve(process.cwd(), "songs");

async function importSongs(): Promise<void> {
  const files = (await fs.readdir(SONGS_DIR))
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"));

  console.log(`Found ${files.length} song files.`);

  let imported = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const file of files) {
    const filePath = path.join(SONGS_DIR, file);
    const raw = await fs.readFile(filePath, "utf-8");

    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(raw);
    } catch (err) {
      errors.push(`${file}: failed to parse frontmatter — ${err}`);
      skipped++;
      continue;
    }

    const fm = parsed.data;

    const slug = normalizeStr(fm.slug) ?? path.basename(file, ".md");
    const title = normalizeStr(fm.title);
    if (!title) {
      console.warn(`  SKIP ${file}: missing title`);
      skipped++;
      continue;
    }

    const status = fm.status === "archive" ? "archive" : "active";

    const songPayload = {
      slug,
      title,
      ccli_number:          normalizeStr(fm.ccli_number),
      songselect_url:       normalizeStr(fm.songselect_url),
      original_artist_name: normalizeStr(fm.original_artist),
      theological_summary:  normalizeStr(fm.theological_summary) ?? "",
      congregational_fit:   normalizeInt(fm.congregational_fit),
      tempo_bpm:            normalizeInt(fm.tempo_bpm),
      default_key:          normalizeStr(fm.key),
      status
    };

    // Upsert the song
    const { data: song, error: songErr } = await supabase
      .from("songs")
      .upsert(songPayload, { onConflict: "slug" })
      .select("id")
      .single();

    if (songErr || !song) {
      errors.push(`${file}: upsert failed — ${songErr?.message ?? "no data returned"}`);
      skipped++;
      continue;
    }

    const songId = song.id;

    // Replace related rows
    await supabase.from("song_aliases").delete().eq("song_id", songId);
    await supabase.from("song_writers").delete().eq("song_id", songId);
    await supabase.from("song_themes").delete().eq("song_id", songId);
    await supabase.from("song_scriptures").delete().eq("song_id", songId);

    const aliases = normalizeStrArray(fm.aka);
    if (aliases.length > 0) {
      const { error: e } = await supabase.from("song_aliases").insert(aliases.map((alias) => ({ song_id: songId, alias })));
      if (e) errors.push(`${file}: aliases insert failed — ${e.message}`);
    }

    const writers = normalizeStrArray(fm.writers);
    if (writers.length > 0) {
      const { error: e } = await supabase.from("song_writers").insert(writers.map((writer_name) => ({ song_id: songId, writer_name })));
      if (e) errors.push(`${file}: writers insert failed — ${e.message}`);
    }

    const themes = normalizeStrArray(fm.dominant_themes);
    if (themes.length > 0) {
      const { error: e } = await supabase.from("song_themes").insert(themes.map((theme) => ({ song_id: songId, theme })));
      if (e) errors.push(`${file}: themes insert failed — ${e.message}`);
    }

    const scriptures = normalizeStrArray(fm.scriptural_anchors);
    if (scriptures.length > 0) {
      const { error: e } = await supabase.from("song_scriptures").insert(scriptures.map((scripture_ref) => ({ song_id: songId, scripture_ref })));
      if (e) errors.push(`${file}: scriptures insert failed — ${e.message}`);
    }

    console.log(`  OK  ${slug}`);
    imported++;
  }

  console.log(`\nDone. Imported: ${imported}  Skipped: ${skipped}  Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.error("\nErrors:");
    errors.forEach((e) => console.error("  " + e));
  }
}

importSongs().catch((err) => { console.error(err); process.exit(1); });
