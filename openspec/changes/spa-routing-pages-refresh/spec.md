# Change: SPA Routing Refresh on GitHub Pages

## Summary
Ensure deep links refresh correctly on GitHub Pages (no 404 on browser refresh or direct open), while supporting clean URLs like `/songs/<slug>`.

## User Story
As a user, I want to open and refresh deep links directly (for example `/songs/<slug>`) without seeing a GitHub Pages 404.

## Motivation
- GitHub Pages serves static files and does not natively rewrite all SPA routes to `index.html`.
- Deep links can fail on refresh unless routing strategy is adapted.

## Scope
- Compare and document two supported approaches.
- Choose one implementation approach for HymnOps.
- Define exact implementation targets for routing and fallback files.

## Out of Scope
- Visual redesign or page feature changes.
- Domain/DNS configuration.

## Design
### Approach A: Hash Routing (`/#/songs/<slug>`)
- Pros: simplest operationally on static hosting; no fallback file required.
- Cons: URL format includes `#`; does not satisfy clean `/songs/<slug>` requirement.

### Approach B: 404 Fallback Redirect for History Routing (Selected)
- Pros: supports clean paths (`/songs/<slug>`) on Pages.
- Cons: requires extra static redirect plumbing.

### Selected Approach
Use **Approach B** so direct navigation and refresh on clean URLs work on GitHub Pages.

## File List (Planned Implementation Targets)
- Edit: `src/router.ts` (switch from hash-driven routing to history/pathname routing)
- Edit: `src/main.ts` (navigation integration updates if required)
- Add: `public/404.html` (Pages fallback redirect logic)
- Edit: `index.html` (small bootstrap snippet to restore redirected path before app init)
- Edit: `README.md` (routing/deployment caveats)

## Implementation Steps
1. Refactor router path normalization in `src/router.ts` from `window.location.hash` to `window.location.pathname + search`.
2. Update navigation method to use `history.pushState` and route rendering on `popstate`.
3. Add `public/404.html` fallback page that rewrites unknown route requests into a query format understood by `index.html`.
4. Add a pre-app-init script in `index.html` to decode the redirected path and call `history.replaceState` to restore clean URL.
5. Verify route matching for key pages (songs, services, series detail).
6. Document behavior and constraints in README deployment docs.

## Acceptance Criteria
- Directly opening `/songs/<slug>` on GitHub Pages loads the song detail page.
- Refreshing `/songs/<slug>` on GitHub Pages does not show 404.
- SPA in-app navigation continues to work.
- Root path (`/`) still loads normally.

## Rollback
1. Revert router/history changes in `src/router.ts` and `src/main.ts`.
2. Remove `public/404.html` fallback logic.
3. Remove `index.html` bootstrap redirect script.
4. Revert README routing guidance.

## Notes
- Current codebase is hash-router based; this change intentionally moves routing model.
- If clean URLs become non-requirement, fallback option is to keep hash routing only.
