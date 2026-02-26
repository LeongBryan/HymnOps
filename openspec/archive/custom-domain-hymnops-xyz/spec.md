# Change: Custom Domain `hymnops.xyz`

## Summary
Define and document the production custom-domain setup for GitHub Pages behind Cloudflare DNS, including SSL and go-live checks.

## User Story
As a maintainer, I want a clear domain cutover procedure so `https://hymnops.xyz` serves HymnOps reliably over HTTPS with minimal downtime.

## Motivation
- Domain setup spans GitHub settings + DNS provider config.
- Incorrect DNS/proxy settings can cause SSL and reachability failures.
- A repeatable checklist reduces release risk.

## Scope
- Document GitHub Pages custom-domain settings.
- Document Cloudflare DNS records for apex and optional `www`.
- Define SSL/proxy troubleshooting guidance.
- Provide a go-live checklist.

## Out of Scope
- CI workflow implementation details (tracked separately).
- App routing/base-path code changes (tracked separately).

## Design
- GitHub Pages:
  - set custom domain to `hymnops.xyz`
  - enable "Enforce HTTPS" after certificate is issued
- Cloudflare DNS:
  - Apex `hymnops.xyz`:
    - `A` records to GitHub Pages IPs:
      - `185.199.108.153`
      - `185.199.109.153`
      - `185.199.110.153`
      - `185.199.111.153`
    - optional `AAAA` records to GitHub Pages IPv6 endpoints
  - Optional `www`:
    - `CNAME` `www` -> `<user>.github.io`
- Cloudflare proxy mode:
  - Start with DNS-only if SSL/provisioning issues appear.
  - Re-enable proxied mode after HTTPS is stable.

## File List (Planned Implementation Targets)
- Edit: `README.md` (domain and DNS setup section)
- Create/Edit: `public/CNAME` (if file-managed custom domain is selected)
- Optional: `openspec/archive/custom-domain-hymnops-xyz/go-live-checklist.md`

## Implementation Steps
1. Configure GitHub Pages source to Actions-deployed artifact.
2. Set GitHub custom domain to `hymnops.xyz`.
3. Add/update DNS records in Cloudflare for apex and optional `www`.
4. Wait for DNS and certificate issuance, then enable HTTPS enforcement.
5. Validate both apex and optional `www` behavior (redirect strategy documented).
6. Execute go-live checklist and capture final verification timestamps.

## Acceptance Criteria
- `https://hymnops.xyz` serves the production site.
- HTTPS certificate is valid and enforced in GitHub Pages settings.
- DNS resolution for apex points to GitHub Pages endpoints.
- If `www` is used, it resolves correctly and follows chosen redirect policy.

## Rollback
1. Remove/adjust custom domain in GitHub Pages settings.
2. Revert Cloudflare DNS records to prior state.
3. Disable proxy if TLS handshake issues occur during rollback.

## Notes
- Use exact DNS records from GitHub Pages documentation during implementation to avoid stale values.
