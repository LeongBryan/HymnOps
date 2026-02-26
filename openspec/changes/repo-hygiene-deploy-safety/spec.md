# Change: Repo Hygiene and Deploy Safety

## Summary
Harden repository and CI deployment safety to ensure local-only or restricted content is never deployed and contributor workflows stay clean.

## User Story
As a maintainer, I want deployment safety checks and repository hygiene rules so that copyrighted lyrics content and local artifacts never leak into published output.

## Motivation
- This repo must remain "no lyrics" for deployment.
- CI builds should not depend on or publish local-only folders.
- Contributors need a predictable, clean repository state.

## Scope
- Verify and enforce ignore rules for generated/local folders.
- Add a deploy preflight validation gate for "no lyrics".
- Define CNAME handling strategy and documentation.
- Ensure CI deploy artifact scope is limited to `dist/`.

## Out of Scope
- Content migration of existing song metadata.
- DNS/provider changes (tracked separately).

## Design
- Keep/confirm `.gitignore` entries:
  - `dist/`
  - `node_modules/`
  - `lyrics_vault/`
- Add preflight script contract: `validate-no-lyrics`.
- Run preflight in CI before build/deploy.
- CNAME handling strategy:
  - preferred: `public/CNAME` committed with `hymnops.xyz`
  - alternative: Pages settings managed manually (documented tradeoff)

## File List (Planned Implementation Targets)
- Edit: `.gitignore`
- Create: `scripts/validate-no-lyrics.ts` (or `.js`)
- Edit: `package.json` (script entry and/or build hook)
- Edit: `.github/workflows/deploy.yml` (preflight execution)
- Create/Edit: `public/CNAME` (if file-based CNAME strategy selected)
- Edit: `README.md` (deploy safety + no-lyrics policy)

## Implementation Steps
1. Confirm `.gitignore` includes `dist/`, `node_modules/`, and `lyrics_vault/`.
2. Add `validate-no-lyrics` script that fails if forbidden content/folders are included in deploy scope.
3. Wire `validate-no-lyrics` into CI before `npm run build`.
4. Confirm workflow uploads only `dist/` via Pages artifact action.
5. Implement CNAME strategy (`public/CNAME` preferred) and document it.
6. Update README with contributor hygiene guidance and deployment safety checks.

## Acceptance Criteria
- Fresh build does not require committing `dist/` or `node_modules/`.
- `lyrics_vault/` is ignored and never part of deployment artifact.
- CI fails when preflight detects forbidden lyrics content in deploy scope.
- GitHub Pages artifact includes only intended static build output.
- Repository remains clean after typical local build (`git status` unaffected by ignored artifacts).

## Rollback
1. Remove preflight gate from workflow and scripts.
2. Revert `.gitignore`/README changes if required.
3. Revert CNAME file strategy to manual Pages setting-only mode.

## Notes
- This change is policy-focused and should be completed before domain go-live.
