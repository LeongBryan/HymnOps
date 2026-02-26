# Change: GitHub Pages CI/CD

## Summary
Add a production deployment pipeline for HymnOps using GitHub Actions and GitHub Pages so every push to `main` can build and publish the static site from `dist/`.

## User Story
As a maintainer, I want a repeatable CI/CD deployment to GitHub Pages so releases are automatic, auditable, and not dependent on local machine artifacts.

## Motivation
- Remove manual deployment steps.
- Ensure deploys are built in clean CI (`npm ci`) instead of from local `dist/`.
- Standardize deploy permissions, artifact handling, and concurrency.

## Scope
- Create `.github/workflows/deploy.yml` for Pages deployment.
- Build with Node 20 and npm.
- Run validation before build.
- Upload `dist/` as Pages artifact and deploy with `actions/deploy-pages`.
- Update docs with quickstart and deployment instructions.

## Out of Scope
- Custom domain DNS setup details (tracked separately).
- Routing behavior fixes for deep-link refresh (tracked separately).
- App code feature work.

## Design
- Trigger: `push` to `main` and `workflow_dispatch`.
- Permissions: `contents: read`, `pages: write`, `id-token: write`.
- Concurrency: single in-flight deploy group (cancel older runs).
- Build job:
  - `actions/checkout`
  - `actions/setup-node@v4` (`node-version: 20`, npm cache)
  - `npm ci`
  - `npm run validate --if-present`
  - `npm run build`
  - `actions/upload-pages-artifact` with `path: dist`
- Deploy job:
  - `needs: build`
  - `actions/deploy-pages`
  - environment `github-pages`

## File List (Planned Implementation Targets)
- Create: `.github/workflows/deploy.yml`
- Edit: `README.md` (quickstart and deployment sections)

## Implementation Steps
1. Add the Pages deployment workflow at `.github/workflows/deploy.yml`.
2. Configure job permissions, concurrency, and `pages` deployment environment.
3. Add build steps with Node 20, `npm ci`, `npm run validate --if-present`, and `npm run build`.
4. Upload `dist/` with `actions/upload-pages-artifact`.
5. Deploy the artifact via `actions/deploy-pages`.
6. Update `README.md` with:
   - local build/test quickstart
   - GitHub Pages CI/CD overview
   - expected branch trigger (`main`)

## Acceptance Criteria
- A push to `main` starts the deployment workflow automatically.
- Workflow completes with both build and deploy jobs green.
- GitHub Pages publishes the uploaded `dist/` artifact.
- Site is reachable at the configured Pages URL.
- No deployment step reads from local-only folders (`node_modules/`, `lyrics_vault/`).

## Rollback
1. Disable GitHub Pages in repository settings or revert `.github/workflows/deploy.yml`.
2. Revert README deployment instructions if needed.
3. Re-run from previous known-good commit/tag.

## Notes
- CI should be the only deployment path.
- Any future deploy gates (lint, tests, policy checks) can be appended before `npm run build`.
