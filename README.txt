SALEHBC SOLO - Experimental Bitcoin solo mining on iPhone

FILES: index.html, miner.js, worker.js, wrangler.jsonc

DEPLOYMENT (existing GitHub repo alshama386/-salehbc):
1. Replace/add all four files at repo ROOT on branch main in ONE commit.
2. GitHub Pages serves index.html and miner.js. Cloudflare's existing GitHub deployment uses wrangler.jsonc and worker.js.
3. Wait for both deployments. Open https://alshama386.github.io/-salehbc/ and press START SOLO MINING.
4. A genuine pool connection is confirmed ONLY if screen shows POOL CONNECTED, and log says SOLO authorization ACCEPTED and New live Bitcoin block template.
5. If Cloudflare build fails, inspect deployment logs; don't assume connected.

SOLO CKPOOL: stratum.ckpool.org:3333, fee 2% (per pool website).
FIXED PAYOUT ADDRESS: 14c6FYanugodb4unhbXWrb2S6as4JbL4E5
CAUTION: This is a Binance exchange deposit address. Binance acceptance of direct mining rewards is UNVERIFIED. For safety, verify first with Binance or use a self-custody wallet instead.

IMPORTANT LIMITATIONS:
- This code has NOT been end-to-end tested against live CKPool or on the user's iPhone.
- This is an experimental reference implementation, not guaranteed reliable mining software.
- Browser SubtleCrypto is very slow; Safari may throttle/stop background tabs or lock screen.
- A high-difficulty share may take years or longer on phone; zero accepted shares is expected.
- A real block payout is extremely unlikely; no rewards are promised.
- Public GitHub Pages and workers.dev URLs are NOT PRIVATE. Authentication is not included.
- The Cloudflare bridge is fixed to one pool and one wallet, and accepts WebSocket connections from any origin. It is publicly accessible; consider Cloudflare Access / rate limiting before public use.
- This release does NOT alter q8quiz.com or the existing quiz site.
- If this is to be used seriously, perform live integration tests and security review first.
