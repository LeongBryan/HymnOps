# Change: Vite Base and Pages Pathing

## Summary
Make asset and route pathing configurable so HymnOps can run correctly on both GitHub Pages project URLs and custom-domain root URLs.

## User Story
As a maintainer, I want one build configuration strategy that supports both `https://<user>.github.io/<repo>/` and `https://hymnops.xyz/` so we can deploy safely across environments without broken assets.

## Motivation
- Vite asset links depend on `base`.
- Wrong `base` causes blank pages or missing JS/CSS after deploy.
- We need predictable behavior in CI and on custom domain.

## Scope
- Introduce environment-driven Vite `base` setting with safe defaults.
- Document how CI sets base for project Pages path.
- Document custom-domain root deployment base (`/`).

## Out of Scope
- Router deep-link refresh mechanics (tracked separately).
- DNS/domain provisioning steps (tracked separately).

## Design
- Use `VITE_BASE` (or `PUBLIC_BASE`) to set Vite `base`.
- Safe default: `"/"` when env var is unset.
- Normalize `base` format during config evaluation (leading and trailing slash).
- CI behavior:
  - project Pages deploy: set `VITE_BASE=/<repo>/`
  - custom domain deploy: set `VITE_BASE=/`

## File List (Planned Implementation Targets)
- Edit: `vite.config.ts`
- Edit: `.github/workflows/deploy.yml`
- Edit: `README.md` (base/pathing notes)

## Implementation Steps
1. Update `vite.config.ts` to read `VITE_BASE` (or `PUBLIC_BASE`) from env with default `/`.
2. Add base normalization logic to avoid malformed paths.
3. Update deployment workflow to pass `VITE_BASE` explicitly for Pages project-path builds.
4. Add README section documenting:
   - default base behavior
   - project Pages base value format
   - custom domain base value
5. Validate both build modes locally/CI with `npm run build`.

## Acceptance Criteria
- With `VITE_BASE=/<repo>/`, the built app loads assets and styles correctly from project Pages URL.
- With `VITE_BASE=/`, the built app loads assets and styles correctly at root custom domain URL.
- No broken network requests for JS/CSS due to base mismatch.
- No blank page after deployment caused by incorrect asset prefix.

## Rollback
1. Revert `vite.config.ts` base-env changes.
2. Remove workflow/env changes for `VITE_BASE`.
3. Revert README instructions to previous deployment assumptions.

## Notes
- Keep default behavior safe for local development (`/`).
- Use one env variable consistently across docs and workflow.
