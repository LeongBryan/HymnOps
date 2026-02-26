# Go-Live Checklist: hymnops.xyz

- [ ] GitHub Pages deployment workflow is green on `main`.
- [ ] GitHub Pages custom domain is set to `hymnops.xyz`.
- [ ] `public/CNAME` (or Pages setting-only strategy) matches `hymnops.xyz`.
- [ ] Cloudflare apex DNS records point to GitHub Pages IPs.
- [ ] Optional `www` CNAME points to `<user>.github.io` (if using `www`).
- [ ] DNS propagation verified (`dig`/`nslookup` from at least two resolvers).
- [ ] GitHub Pages certificate issued and "Enforce HTTPS" enabled.
- [ ] `https://hymnops.xyz` loads homepage successfully.
- [ ] At least one deep link (for example `/songs/<slug>`) loads as expected.
- [ ] Rollback owner and rollback steps confirmed before final cutover.
