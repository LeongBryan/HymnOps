/**
 * import-series-to-supabase.ts
 *
 * Reads every series/*.md file and upserts into the series table.
 *
 * Usage:
 *   npx tsx --env-file .env.local scripts/import-series-to-supabase.ts
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

const SERIES_DIR = path.resolve(process.cwd(), "series");

async function importSeries(): Promise<void> {
  const files = (await fs.readdir(SERIES_DIR))
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"));

  console.log(`Found ${files.length} series files.`);

  let imported = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const file of files) {
    const filePath = path.join(SERIES_DIR, file);
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
    const slug  = normalizeStr(fm.slug) ?? path.basename(file, ".md");
    const title = normalizeStr(fm.title);

    if (!title) {
      console.warn(`  SKIP ${file}: missing title`);
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from("series")
      .upsert(
        { slug, title, description: normalizeStr(fm.description) },
        { onConflict: "slug" }
      );

    if (error) {
      errors.push(`${file}: upsert failed — ${error.message}`);
      skipped++;
      continue;
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

importSeries().catch((err) => { console.error(err); process.exit(1); });
