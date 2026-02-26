# Change: Clearable SongSelect Filters

## Why

Song filter controls currently lack a straightforward un-select/clear interaction,
which makes users manually reset state in a slower workflow.

## Scope

- Add explicit clear/unselect behavior for SongSelect filters.
- Ensure keyboard and mobile interactions are included.
- Preserve existing filtering logic semantics.

## Out of Scope

- New filter categories.
- Search UX for services/series (tracked separately).

## Success Criteria

- Users can clear each filter without page refresh.
- UX works consistently across desktop and mobile.

