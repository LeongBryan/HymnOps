# Progress Snapshot

Last updated: 2026-02-26

## Completed (Retrospective)

- Imported and normalized `imports/2024.csv` into `songs/`, `services/`, and `series/`.
- Imported and normalized `imports/2025.csv` into `songs/`, `services/`, and `series/`.
- Enriched songs from CCLI/SongSelect metadata (`ccli_number`, URLs, writers, and available performance fields).
- Corrected known song mapping issue: `hes-able.md` -> CCLI `57636` (Paul E. Paino).
- Applied taxonomy pass for `dominant_themes` and `doctrinal_categories` across `songs/*.md`.
- Updated all service files so the last song usage is `["response"]`.
- Added series entry: `series/return-of-the-king.md`.
- Added/maintained README TODO backlog.
- Implemented and committed deployment-readiness changes:
  - `github-pages-cicd`
  - `vite-base-and-pages-pathing`
  - `spa-routing-pages-refresh`
  - `repo-hygiene-deploy-safety`
  - `custom-domain-hymnops-xyz`
- Implemented `services-series-search` with search bars and list filtering for Services and Series pages.
- Implemented `services-series-layout-refresh` with responsive card/tile layouts for Services and Series pages.
- Implemented `clearable-songselect-filters` with per-filter clear actions and a global clear-all control.
- Implemented `create-setlist-planner-bcc-context` with WhatsApp-friendly planner export and BCC usage-category normalization.

## Backlog (Tracked as OpenSpec Changes)

- `song-version-audit`
- `google-sheets-service-import`
- `series-renaming-cleanup`
- `collapse-annual-series`
