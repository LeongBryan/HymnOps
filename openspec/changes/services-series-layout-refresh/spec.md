# Change: Services and Series Layout Refresh

## Summary
Redesign the Services and Series listing pages from long single-column rows into a more scannable, responsive card/tile-based layout (similar to Songs), while preserving current search/filter behavior.

## User Story
As a worship planner, I want Services and Series pages to be easier to browse at a glance so I can find items faster without scrolling through hundreds of plain rows.

## Motivation
- Current one-column lists become hard to scan as data grows.
- Services and Series visual hierarchy is weaker than Songs.
- Mobile and desktop both need better density and readability.

## Scope
- Rework Services listing UI into responsive tiles/cards.
- Rework Series listing UI into responsive tiles/cards.
- Keep existing search/filter/sort behavior compatible.
- Ensure layout works well on desktop and mobile.

## Out of Scope
- Changing data schema for services or series.
- Adding new backend/indexing features.
- Detail page redesign.

## Design
- Services view:
  - Card per service with key metadata (date, sermon title/text, preacher, series).
  - Compact song summary (count and/or top songs) instead of long inline rows.
  - Optional grouped sections by year/month if needed for scanning.
- Series view:
  - Card per series with title, date range, item count, and a small recommended-song preview.
  - Clear entry affordance to series detail page.
- Responsive behavior:
  - 1 column on narrow mobile, 2-4 columns on wider screens depending on viewport.
  - Keep keyboard focus states and accessible semantics.
- Visual consistency:
  - Reuse existing card/search/filter styling patterns from Songs where practical.

## File List (Planned Implementation Targets)
- Edit: `src/pages/Services.ts`
- Edit: `src/pages/SeriesList.ts`
- Edit: `src/components/Table.ts` (only if currently shared and needs extraction/refactor)
- Edit: `src/components/SearchBar.ts` (only if layout integration changes spacing/behavior)
- Edit: `src/styles/main.css`
- Edit: `README.md` (optional screenshots/UX notes if maintained there)

## Implementation Steps
1. Audit current Services and Series list rendering paths and shared components.
2. Define card/tile information hierarchy for each list page.
3. Implement responsive grid/card layout in `Services.ts` with preserved controls.
4. Implement responsive grid/card layout in `SeriesList.ts` with preserved controls.
5. Update CSS for consistent spacing, breakpoints, and hover/focus states.
6. Verify search/filter/sort interactions still produce correct results.
7. Smoke-test desktop/mobile rendering and keyboard navigation.

## Acceptance Criteria
- Services page no longer renders as a single long plain-column list.
- Series page no longer renders as a single long plain-column list.
- Both pages render responsive tiles/cards with readable hierarchy.
- Existing search/filter/sort behavior still works as before.
- Layout is usable on mobile (no horizontal overflow, tappable controls).
- Performance remains acceptable with current dataset size.

## Rollback
1. Revert `Services.ts`, `SeriesList.ts`, and related style changes.
2. Restore prior list/table rendering components and CSS rules.
3. Re-run smoke checks to confirm old behavior is intact.

## Notes
- If list size continues to grow, consider follow-up change for pagination or virtualization.
