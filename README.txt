SALEHBC v2 — verified local SHA-256 benchmark and status API

WHAT IS INCLUDED
- index.html: standalone iPhone-friendly local SHA-256 test page with known-answer self-test.
- worker.js: Cloudflare status API only (not a mining gateway).
- wrangler.jsonc: Cloudflare Worker deployment config.

INSTALL (existing GitHub repo -salehbc)
1. Replace index.html in the repository with the index.html in this ZIP.
2. Keep worker.js and wrangler.jsonc as-is if already present; included here for completeness.
3. Wait for GitHub Pages to publish, open the page and press START HASHING.
4. Look for "SHA-256 self-test passed" in TEST LOG.

IMPORTANT LIMITATIONS
This is NOT Bitcoin block mining and cannot win Bitcoin rewards. It hashes synthetic
32-byte test data with SHA-256, not live Bitcoin 80-byte headers/double-SHA256.
The Worker is a status API only. Actual solo mining requires a Stratum-compatible
persistent TCP gateway, valid block templates and submission, plus a mining engine.
Cloudflare Workers alone do not provide a persistent Stratum TCP gateway.
The public GitHub Pages website is not private. Do not put secrets in source code.
Using an exchange deposit address for mining rewards should be confirmed with the exchange.
