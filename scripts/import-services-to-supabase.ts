/**
 * import-services-to-supabase.ts
 *
 * Reads every services/YYYY-MM-DD.md file and upserts into:
 *   services, service_songs
 *
 * Run AFTER import-songs-to-supabase.ts and import-series-to-supabase.ts
 * so that all referenced slugs already exist.
 *
 * Usage:
 *   npx tsx --env-file .env.local scripts/import-services-to-supabase.ts
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

const SUPABASE_URL     = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function normalizeStr(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

interface RawSong { slug: string; usage?: string[]; key?: string | null; notes?: string | null }

// ─── Prefetch lookup tables ──────────────────────────────────────────────────

async function buildLookups(): Promise<{
  songIdBySlug:   Map<string, string>;
  seriesIdBySlug: Map<string, string>;
}> {
  const [songsRes, seriesRes] = await Promise.all([
    supabase.from("songs").select("id, slug"),
    supabase.from("series").select("id, slug")
  ]);

  if (songsRes.error)  throw new Error(`Could not load songs from DB: ${songsRes.error.message}\nHave you run 'npx supabase db push'?`);
  if (seriesRes.error) throw new Error(`Could not load series from DB: ${seriesRes.error.message}\nHave you run 'npx supabase db push'?`);

  const songIdBySlug   = new Map<string, string>();
  const seriesIdBySlug = new Map<string, string>();

  for (const s of songsRes.data ?? [])  songIdBySlug.set(s.slug, s.id);
  for (const s of seriesRes.data ?? []) seriesIdBySlug.set(s.slug, s.id);

  return { songIdBySlug, seriesIdBySlug };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SERVICES_DIR = path.resolve(process.cwd(), "services");

async function importServices(): Promise<void> {
  const { songIdBySlug, seriesIdBySlug } = await buildLookups();
  console.log(`Loaded ${songIdBySlug.size} songs and ${seriesIdBySlug.size} series from DB.`);

  const files = (await fs.readdir(SERVICES_DIR))
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort();

  console.log(`Found ${files.length} service files.`);

  let imported = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const file of files) {
    const filePath = path.join(SERVICES_DIR, file);
    const raw = await fs.readFile(filePath, "utf-8");

    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(raw);
    } catch (err) {
      errors.push(`${file}: parse error — ${err}`);
      skipped++;
      continue;
    }

    const fm = parsed.data;

    // Service date from filename (YYYY-MM-DD.md) or frontmatter
    const dateFromFile = path.basename(file, ".md");
    const serviceDate  = normalizeStr(fm.date) ?? dateFromFile;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      console.warn(`  SKIP ${file}: invalid date "${serviceDate}"`);
      skipped++;
      continue;
    }

    // Resolve series — auto-create if referenced but not yet imported
    const seriesSlug = normalizeStr(fm.series_slug);
    let seriesId: string | null = null;
    if (seriesSlug) {
      seriesId = seriesIdBySlug.get(seriesSlug) ?? null;
      if (!seriesId) {
        // Derive a readable title from the slug (e.g. "the-lamb-wins" → "The Lamb Wins")
        const derivedTitle = seriesSlug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        const { data: newSeries, error: autoErr } = await supabase
          .from("series")
          .upsert({ slug: seriesSlug, title: derivedTitle }, { onConflict: "slug" })
          .select("id")
          .single();
        if (autoErr || !newSeries) {
          console.warn(`  WARN ${file}: could not auto-create series "${seriesSlug}" — linking to null`);
        } else {
          seriesId = newSeries.id;
          seriesIdBySlug.set(seriesSlug, newSeries.id);
          console.log(`  NEW series auto-created: ${seriesSlug}`);
        }
      }
    }

    // Upsert the service row
    const { data: service, error: svcErr } = await supabase
      .from("services")
      .upsert(
        {
          service_date:         serviceDate,
          series_id:            seriesId,
          sermon_title:         normalizeStr(fm.sermon_title),
          speaker:              normalizeStr(fm.preacher),
          sermon_scripture_ref: normalizeStr(fm.sermon_text),
          sermon_notes:         null // body notes not stored to avoid copyright concerns
        },
        { onConflict: "service_date" }
      )
      .select("id")
      .single();

    if (svcErr || !service) {
      errors.push(`${file}: service upsert failed — ${svcErr?.message ?? "no data"}`);
      skipped++;
      continue;
    }

    const serviceId = service.id;

    // Delete existing service_songs and re-insert
    await supabase.from("service_songs").delete().eq("service_id", serviceId);

    const songs: RawSong[] = Array.isArray(fm.songs) ? fm.songs as RawSong[] : [];
    const songRows: {
      service_id:   string;
      song_id:      string;
      position:     number;
      usage:        string | null;
      key_override: string | null;
      notes:        string | null;
    }[] = [];

    let position = 1;
    const warnedSlugs: string[] = [];

    for (const entry of songs) {
      const slug = typeof entry.slug === "string" ? entry.slug.trim() : "";
      if (!slug) continue;

      const songId = songIdBySlug.get(slug);
      if (!songId) {
        warnedSlugs.push(slug);
        continue;
      }

      const usage = Array.isArray(entry.usage) && entry.usage.length > 0
        ? String(entry.usage[0])
        : null;

      songRows.push({
        service_id:   serviceId,
        song_id:      songId,
        position:     position++,
        usage,
        key_override: normalizeStr(entry.key),
        notes:        normalizeStr(entry.notes)
      });
    }

    if (warnedSlugs.length > 0) {
      console.warn(`  WARN ${file}: unknown song slugs skipped: ${warnedSlugs.join(", ")}`);
    }

    if (songRows.length > 0) {
      const { error: ssErr } = await supabase.from("service_songs").insert(songRows);
      if (ssErr) {
        errors.push(`${file}: service_songs insert failed — ${ssErr.message}`);
      }
    }

    console.log(`  OK  ${serviceDate}  (${songRows.length} songs)`);
    imported++;
  }

  console.log(`\nDone. Imported: ${imported}  Skipped: ${skipped}  Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.error("\nErrors:");
    errors.forEach((e) => console.error("  " + e));
  }
}

importServices().catch((err) => { console.error(err); process.exit(1); });
