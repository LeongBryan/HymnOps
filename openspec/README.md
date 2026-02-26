# OpenSpec Workspace

This directory tracks planning and change execution for HymnOps in a durable format
that survives folder renames and chat resets.

## Structure

- `progress.md`: high-level log of completed work and current backlog.
- `changes/`: one folder per planned change.
- `changes/README.md`: index of all active changes and status.

## Deployment-Readiness Changes

- [`github-pages-cicd`](changes/github-pages-cicd/spec.md): GitHub Actions workflow to build and deploy `dist/` to GitHub Pages.
- [`vite-base-and-pages-pathing`](changes/vite-base-and-pages-pathing/spec.md): Environment-driven Vite `base` strategy for project Pages URLs and custom domain root.
- [`spa-routing-pages-refresh`](changes/spa-routing-pages-refresh/spec.md): Deep-link refresh strategy on Pages, with selected approach for clean route support.
- [`repo-hygiene-deploy-safety`](changes/repo-hygiene-deploy-safety/spec.md): Guardrails for ignored artifacts, no-lyrics deploy policy, and preflight validation.
- [`custom-domain-hymnops-xyz`](changes/custom-domain-hymnops-xyz/spec.md): GitHub Pages + Cloudflare domain setup and go-live checklist for `hymnops.xyz`.

## UX Changes

- [`services-series-layout-refresh`](changes/services-series-layout-refresh/spec.md): Reorganize Services and Series listing pages into responsive card/tile layouts for better scanability.

## Change Workflow

1. Pick a change from `changes/README.md`.
2. Refine `proposal.md` if scope shifts.
3. Execute and tick off `tasks.md`.
4. Mark the change status in `changes/README.md`.
