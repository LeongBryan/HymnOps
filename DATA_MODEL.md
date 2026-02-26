# Data Model

## A) Song file: `songs/<slug>.md`

Frontmatter required:

- `title: string`
- `slug: string` (must equal filename without `.md`)
- `aka: string[]`
- `ccli_number: string | null`
- `songselect_url: string | null`
- `lyrics_source: "SongSelect" | "Other" | "Unknown"`
- `original_artist: string | null`
- `writers: string[]`
- `publisher: string | null`
- `year: number | null`
- `tempo_bpm: number | null`
- `key: string | null`
- `time_signature: string | null`
- `congregational_fit: number | null` (1-5)
- `vocal_range: string | null`
- `dominant_themes: string[]`
- `doctrinal_categories: string[]`
- `emotional_tone: string[]`
- `scriptural_anchors: string[]`
- `theological_summary: string`
- `arrangement_notes: string | null`
- `slides_path: string | null`
- `tags: string[]`
- `last_sung_override: string | null` (`YYYY-MM-DD`)
- `status: "active" | "archive"`

Optional:

- `licensing_notes: string | null`
- `language: string | null`
- `meter: string | null`
- `lyrics_hint: string | null` (avoid; keep empty by default)

Body sections:

- `## Notes`
- `## Pastoral Use`

No lyrics.

## B) Service file: `services/YYYY-MM-DD.md`

Frontmatter required:

- `date: string` (must equal filename)
- `series_slug: string | null`
- `sermon_title: string | null`
- `sermon_text: string | null`
- `preacher: string | null`
- `songs:`
  - `slug: string`
  - `usage: string[]`
  - `key: string | null`
  - `notes: string | null`

Body: freeform service notes.

## C) Series file: `series/<slug>.md`

Frontmatter required:

- `title: string`
- `slug: string` (must equal filename)
- `date_range: [string|null, string|null]`
- `description: string | null`
- `recommended: string[]` (song slugs)

Body: freeform notes.

## Example song

```md
---
title: "Example Song"
slug: "example-song"
aka: []
ccli_number: null
songselect_url: null
lyrics_source: "Unknown"
original_artist: null
writers: []
publisher: null
year: null
tempo_bpm: null
key: null
time_signature: null
congregational_fit: null
vocal_range: null
dominant_themes: ["Grace"]
doctrinal_categories: ["Soteriology"]
emotional_tone: ["Reflective"]
scriptural_anchors: ["Ephesians 2:8-10"]
theological_summary: "A short non-lyrical summary."
arrangement_notes: null
slides_path: null
tags: []
last_sung_override: null
status: "active"
---

## Notes

Arrangement and ministry notes only.

## Pastoral Use

Context-specific guidance.
```
