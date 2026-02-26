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

Local production preview:

```bash
npm run preview
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

Deployment uses `.github/workflows/deploy.yml`.

Every push to `main` (and manual `workflow_dispatch`) runs:

1. `npm ci`
2. `npm run validate-no-lyrics --if-present`
3. `npm run validate --if-present`
4. `npm run build`
5. Upload `dist/` as a Pages artifact
6. Deploy artifact with `actions/deploy-pages`

In repository settings, set Pages source to **GitHub Actions**.

### Base path configuration

Vite base path is controlled by `VITE_BASE` (fallback: `PUBLIC_BASE`, default: `/`).

- GitHub Pages project URL (`https://<user>.github.io/<repo>/`):
  - CI defaults to `VITE_BASE=/<repo>/` when `VITE_BASE` is not set.
- Custom domain root (`https://hymnops.xyz/`):
  - Set repository variable `VITE_BASE=/` in GitHub Actions settings.

Local checks:

```bash
# Project Pages path build
VITE_BASE=/hymnops/ npm run build

# Custom-domain root build
VITE_BASE=/ npm run build
```

### SPA routing on GitHub Pages

HymnOps uses clean history routes (for example `/songs/<slug>`).

- `public/404.html` redirects GitHub Pages deep-link requests back to `index.html`.
- `index.html` restores the original path before the app bootstraps.

This prevents 404-on-refresh for deep links on GitHub Pages.

### Custom domain (`hymnops.xyz`)

This repo uses file-managed domain config via [`public/CNAME`](./public/CNAME).

GitHub Pages setup:

1. Repository Settings -> Pages -> Source: **GitHub Actions**.
2. Repository Settings -> Pages -> Custom domain: `hymnops.xyz`.
3. After certificate issuance completes, enable **Enforce HTTPS**.

Cloudflare DNS setup:

- Apex `hymnops.xyz` (`A` records):
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`
- Optional IPv6 (`AAAA` records):
  - `2606:50c0:8000::153`
  - `2606:50c0:8001::153`
  - `2606:50c0:8002::153`
  - `2606:50c0:8003::153`
- Optional `www` host:
  - `CNAME` `www` -> `<your-github-user>.github.io`

Cloudflare proxy mode:

- If SSL issuance/handshake is unstable, set records to **DNS only** first.
- After HTTPS is stable in GitHub Pages, you can switch back to **Proxied** if desired.

Go-live checklist:

- [ ] Deploy workflow on `main` is green.
- [ ] Custom domain is set to `hymnops.xyz` in GitHub Pages.
- [ ] DNS records above are configured and propagated.
- [ ] HTTPS certificate is issued; **Enforce HTTPS** enabled.
- [ ] `https://hymnops.xyz` loads homepage and a deep link (for example `/songs/<slug>`).

## Local-only optional lyrics vault

`lyrics_vault/` is intentionally gitignored and never needed for public build/deploy.
Use `npm run build:embeddings:local` only on local machines if you maintain private lyric files.
`dist/` is CI-built deployment output and should not be committed.

### Deploy safety preflight

- `npm run validate-no-lyrics` enforces no-lyrics deploy policy.
- It checks required `.gitignore` entries and fails if tracked files are found under:
  - `lyrics_vault/`
  - `dist/`
  - `node_modules/`
- It also scans markdown content for lyric-like structure heuristics.

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
