# Add Song to HymnOps Database

You are helping Bryan log a new song into the HymnOps Supabase database. The song should go into the `songs` table along with its related rows in `song_aliases`, `song_writers`, `song_themes`, and `song_scriptures`.

## Step 1 — Gather the details

Ask Bryan for the following. Group them into one question so it's not tedious:

**Required:**
- Title
- Default key (e.g. G, A, Bb)

**Optional but common:**
- Original artist / band
- CCLI number
- Writers / composers (can be multiple)
- Themes (e.g. "grace", "resurrection", "mission")
- Scripture references (e.g. "Romans 8:1", "Psalm 23")
- Aliases / alternate names (AKA)
- Congregational fit (1–5 scale: 1 = very familiar, 5 = challenging/unfamiliar)
- Tempo BPM
- Status: active (default) or archive

If $ARGUMENTS is non-empty, treat it as the song title and skip asking for that.

## Step 2 — Derive the slug

Slugify the title: lowercase, spaces → hyphens, strip non-alphanumeric chars.
Example: "10,000 Reasons" → "10-000-reasons"

## Step 3 — Insert via script

Write a self-contained tsx script to a temp file `/tmp/add-song.ts` and run it with:

```
npx tsx --env-file .env.local /tmp/add-song.ts
```

The script should:
1. Use `SUPABASE_URL` (fallback `VITE_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` from env
2. Upsert into `songs` on conflict `slug`
3. Delete + reinsert rows in `song_aliases`, `song_writers`, `song_themes`, `song_scriptures`
4. Print "✓ Saved: <title>" on success or the error message on failure

Use `@supabase/supabase-js` (already in node_modules). Do NOT import from `src/` — write the Supabase client inline in the script.

## Step 4 — Confirm

After running, tell Bryan what was saved and offer to add another song or adjust anything.
