# OpenSpec Workspace

This directory tracks planning and change execution for HymnOps in a durable format
that survives folder renames and chat resets.

## Structure

- `progress.md`: high-level log of completed work and current backlog.
- `changes/`: one folder per planned change.
- `changes/README.md`: index of all active changes and status.
- `archive/`: completed change folders moved out of active planning.
- `archive/README.md`: index of archived/completed changes.

## Archived Deployment-Readiness Changes

- [`github-pages-cicd`](archive/github-pages-cicd/spec.md): GitHub Actions workflow to build and deploy `dist/` to GitHub Pages.
- [`vite-base-and-pages-pathing`](archive/vite-base-and-pages-pathing/spec.md): Environment-driven Vite `base` strategy for project Pages URLs and custom domain root.
- [`spa-routing-pages-refresh`](archive/spa-routing-pages-refresh/spec.md): Deep-link refresh strategy on Pages, with selected approach for clean route support.
- [`repo-hygiene-deploy-safety`](archive/repo-hygiene-deploy-safety/spec.md): Guardrails for ignored artifacts, no-lyrics deploy policy, and preflight validation.
- [`custom-domain-hymnops-xyz`](archive/custom-domain-hymnops-xyz/spec.md): GitHub Pages + Cloudflare domain setup and go-live checklist for `hymnops.xyz`.

## Archived UX Changes

- [`services-series-search`](archive/services-series-search/proposal.md): Added search bars and text filtering for Services and Series listing views.
- [`services-series-layout-refresh`](archive/services-series-layout-refresh/spec.md): Reorganized Services and Series listing pages into responsive card/tile layouts for better scanability.
- [`clearable-songselect-filters`](archive/clearable-songselect-filters/proposal.md): Added per-filter clear buttons and a global clear-all action for Song filters.
- [`create-setlist-planner-bcc-context`](archive/create-setlist-planner-bcc-context/proposal.md): Added WhatsApp setlist export and standardized planner/service usage categories for BCC context.

## Change Workflow

1. Pick a change from `changes/README.md`.
2. Refine `proposal.md` if scope shifts.
3. Execute and tick off `tasks.md`.
4. Mark the change status in `changes/README.md`.
