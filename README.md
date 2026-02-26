# HymnOps

HymnOps is a static worship song library, setlist planner, and analytics dashboard built for GitHub Pages.

## Why not Google Sheets

- Markdown-first workflow keeps song/service history reviewable in Git.
- Rich song metadata enables better planning and analytics than a flat sheet.
- Static JSON build output keeps the app fast and serverless.
- Copyright-safe model avoids storing full lyrics in a public repo.

## Core principle

This project stores **metadata and planning notes**, not copyrighted lyric content.
If you use `lyrics_hint`, keep it empty by default and avoid lyric excerpts.

## Quick start

```bash
npm install
npm run validate
npm run dev
```

Production build:

```bash
npm run build
```

## Weekly workflow

1. Add/edit songs in `songs/*.md` using `songs/_template.md`.
2. Add each service in `services/YYYY-MM-DD.md` using `services/_template.md`.
3. Optionally add/update teaching series in `series/*.md`.
4. Run `npm run validate`.
5. Commit and push.

## Data build

- `npm run validate` checks schema, references, and no-lyrics heuristics.
- `npm run build:index` generates:
  - `public/data/songs.json`
  - `public/data/services.json`
  - `public/data/series.json`
  - `public/data/derived.json`
  - `dist/data/*.json` (for direct static hosting)

## GitHub Pages deployment

Deployment uses `.github/workflows/deploy.yml` and runs:

1. `npm ci`
2. `npm run validate`
3. `npm run build`

For project pages, the workflow sets `VITE_BASE_PATH=/<repo-name>/`.

## Local-only optional lyrics vault

`lyrics_vault/` is intentionally gitignored and never needed for public build/deploy.
Use `npm run build:embeddings:local` only on local machines if you maintain private lyric files.

## Adding content quickly

- Song: copy `songs/_template.md` -> `songs/<slug>.md`
- Service: copy `services/_template.md` -> `services/YYYY-MM-DD.md`
- Series: copy `series/_template.md` -> `series/<slug>.md`

## TODO

- Go over songs to ensure correct song version chosen.
- Song-select filters need a way to un-select.
- Add search bar for `services` and `series`.

See:

- [DATA_MODEL.md](./DATA_MODEL.md)
- [TAXONOMY.md](./TAXONOMY.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [COPYRIGHT.md](./COPYRIGHT.md)
