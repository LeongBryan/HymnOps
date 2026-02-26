# Change: Song Version Audit

## Why

Song entries currently include many titles that can map to multiple CCLI versions.
A deliberate audit is needed to ensure the intended congregational version is selected.

## Scope

- Review all `songs/*.md` entries for version correctness.
- Confirm or correct `ccli_number`, `songselect_url`, and key metadata fields.
- Update aliases (`aka`) where useful for disambiguation.

## Out of Scope

- Changing unrelated service history.
- Lyrics storage in repo.

## Success Criteria

- Every active song has the intended CCLI version.
- Known ambiguous songs are explicitly documented or resolved.

