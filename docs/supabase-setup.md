# HymnOps v2 — Supabase Setup Guide

HymnOps v2 adds a Postgres-backed layer (via Supabase) alongside the existing static site.
The static site at `hymnops.xyz` is untouched — v2 lives at `/v2/*` in the same app.

---

## 1. Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | `nvm install 20` |
| Supabase CLI | latest | `npm i -g supabase` |
| tsx | (already in devDeps) | — |

---

## 2. Environment variables

Add these to `.env.local` (already in `.gitignore`):

```env
# Supabase project URL — find it in: Supabase dashboard → Project Settings → API
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co

# Publishable (anon) key — safe to expose in the browser
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# Service-role key — NEVER expose in the browser; only used by import scripts
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> **Where to find these values:**  
> Supabase Dashboard → your project → Project Settings → API

---

## 3. Link to your hosted Supabase project

```bash
# From the repo root:
npx supabase link --project-ref <your-project-ref>
```

Find your project ref in the URL: `https://supabase.com/dashboard/project/<project-ref>`

---

## 4. Run migrations

Push the two migration files to your hosted project:

```bash
npx supabase db push
```

This applies:
- `supabase/migrations/20260417000000_initial_schema.sql` — 8 tables + indexes + triggers
- `supabase/migrations/20260417000001_rls_policies.sql` — RLS + auth policies

To verify: open the Supabase dashboard → Table Editor — you should see all 8 tables.

---

## 5. Generate TypeScript types (after schema changes)

The hand-written `src/lib/database.types.ts` must match the live schema.  
After any migration, regenerate it with:

```bash
# Against the hosted project:
npx supabase gen types typescript --project-id <your-project-ref> \
  > src/lib/database.types.ts

# OR against the local stack (if running `supabase start`):
npx supabase gen types typescript --local > src/lib/database.types.ts
```

---

## 6. Import markdown data into Supabase

Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` first, then:

```bash
# Run all three in order (series must exist before services reference them)
npm run import:all

# Or individually:
npm run import:series    # series/*.md → series table
npm run import:songs     # songs/*.md  → songs + related tables
npm run import:services  # services/*.md → services + service_songs
```

All scripts are **idempotent** — re-running them will upsert without duplicating data.

What is imported:
- Songs: title, slug, CCLI, SongSelect URL, original artist, theological summary, key, BPM, congregational fit, status, aliases, writers, themes, scriptures
- Series: slug, title, description
- Services: date, series link, sermon title, speaker, scripture ref; per-song position, key, usage

What is **not** imported:
- Lyric content of any kind (theological_summary is a prose description, not lyrics)
- Arrangement notes, slides paths, internal notes (kept in markdown only)

---

## 7. Auth setup (magic link)

HymnOps v2 uses **email magic links** — no password.

### In the Supabase Dashboard:

1. Go to **Authentication → Providers → Email**
2. Ensure **Enable Email provider** is on
3. Optionally turn off **Confirm email** (magic links auto-confirm)
4. Go to **Authentication → URL Configuration**
5. Set **Site URL** to `https://hymnops.xyz` (or `http://localhost:5173` for dev)
6. Add redirect URL: `https://hymnops.xyz/v2`

### No public signup

The login page exists but **there is no signup form**. To invite yourself:

```bash
# Using Supabase CLI (requires service-role key):
npx supabase --project-ref <ref> users create \
  --email bryan.leong.e@thalesdigital.io
```

Or create the user directly in the Supabase dashboard → Authentication → Users → Invite user.

---

## 8. RLS policy summary

All tables have **public SELECT** (songs and service history are readable without login).  
All **INSERT / UPDATE / DELETE** require `auth.role() = 'authenticated'`.

| Table | Public read | Auth write |
|-------|-------------|-----------|
| songs | ✓ | ✓ |
| song_aliases / writers / themes / scriptures | ✓ | ✓ |
| series | ✓ | ✓ |
| services | ✓ | ✓ |
| service_songs | ✓ | ✓ |

---

## 9. Local development

```bash
# Install dependencies (first time)
npm install

# Start Supabase local stack (optional — you can also point to hosted)
npx supabase start

# Start the Vite dev server
npm run dev

# Navigate to http://localhost:5173/v2
```

To use the local stack instead of hosted, update `.env.local`:
```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from `supabase status`>
```

---

## 10. v2 routes cheat-sheet

| Route | Description |
|-------|-------------|
| `/v2` | v2 home hub |
| `/v2/login` | Magic-link sign-in |
| `/v2/songs` | Song library (search + list) |
| `/v2/songs/new` | Add a song |
| `/v2/songs/:slug/edit` | Edit a song |
| `/v2/log` | Log a service (main Sunday workflow) |
| `/v2/analytics` | DB-backed analytics |

---

## 11. Full first-run checklist

```
[ ] Add VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY to .env.local
[ ] Add SUPABASE_SERVICE_ROLE_KEY to .env.local
[ ] npx supabase link --project-ref <ref>
[ ] npx supabase db push
[ ] npm install
[ ] npm run import:all
[ ] Create your user in Supabase dashboard (Authentication → Users → Invite)
[ ] npm run dev   →   open http://localhost:5173/v2/login
[ ] Enter your email, click the magic link, land on /v2
```
