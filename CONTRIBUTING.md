# Contributing to HymnOps

## Content conventions

- Keep all files UTF-8 markdown with YAML frontmatter.
- Never include full lyrics or substantial lyric excerpts.
- Keep `lyrics_hint` empty by default (avoid lyric snippets).
- Keep `theological_summary` to 2-5 sentences.
- Use concise, clear `arrangement_notes`.

## Slug rules

- Lowercase
- Kebab-case
- Stable once created
- Song filename must equal `slug`.

## Naming rules

- `writers`: canonical songwriter names (not band names unless legally credited)
- `original_artist`: recording/popularized artist
- Keep punctuation and spacing consistent across files

## Song entry checklist

1. Frontmatter validates by type.
2. `slug` equals filename.
3. `dominant_themes` and doctrine tags are intentional.
4. No lyric-like body formatting.
5. Use `## Notes` and `## Pastoral Use` sections only for non-lyrical guidance.

## Service entry checklist

1. Filename is `YYYY-MM-DD.md`.
2. `date` in frontmatter matches filename.
3. Every `songs[].slug` exists.
4. Use `usage` tags from taxonomy when possible.

## Series entry checklist

1. `slug` equals filename.
2. `recommended` references valid song slugs.

## Local quality gates

Run before committing:

```bash
npm run validate
npm run build
```
