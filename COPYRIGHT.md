# Copyright and Lyrics Policy

HymnOps is designed for public repositories and static hosting. To reduce copyright risk:

- Do not store full song lyrics in this repository.
- Do not store substantial lyric excerpts.
- Store metadata only: CCLI number, source links, themes, scripture anchors, arrangement notes, and pastoral notes.
- Keep `lyrics_hint` empty by default and treat it as avoid-use.

## Allowed metadata patterns

- `ccli_number`
- `songselect_url`
- `lyrics_source`
- theological and planning summaries written in your own words
- reference links to licensed sources

## Disallowed content

- Full verses, choruses, bridges, tags, or lyric-like line blocks
- Large contiguous excerpts from copyrighted songs

## Private local workflow (optional)

You may keep private lyric text in a local-only folder:

- `lyrics_vault/` (gitignored)

This is optional and never required for:

- `npm run validate`
- `npm run build`
- GitHub Pages deployment

## Enforcement

`scripts/validate-data.ts` includes heuristic checks to flag lyric-like content in markdown bodies. Validation fails on these flags.
