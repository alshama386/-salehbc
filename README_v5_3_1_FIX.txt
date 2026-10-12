SALEHBC v5.3.1 — FIXES AND DEPLOYMENT

FIXES:
- Correct LTC worker selection for ltc_solo and ltc_pool (previously used BTC SHA256d worker for all four channels).
- Accepted share total now sums ALL four selected channels.
- Force /status refresh and require matching Cloudflare Worker version 5.3.1.
- Explicit error if Worker is not updated; do not falsely report mining.

DEPLOY TWO SEPARATE PARTS:
A) GitHub Pages: replace repository root files with ZIP contents.
B) Cloudflare: open salehbc-mining Worker > Edit code > replace current worker.js with this ZIP's worker.js > Deploy. Merely uploading worker.js to GitHub does NOT update the running Cloudflare Worker.

TEST: visit https://salehbc-mining.alshama386.workers.dev/status in Safari. It MUST show version 5.3.1 and btc_solo/ltc_solo configured:true. btc_pool/ltc_pool will be configured:false until real pool details are supplied. If it shows another version, the Cloudflare deploy did not take effect.

REAL POOL MINING NOT YET CONFIGURED: Set BTC_POOL_HOST/PORT/USER and LTC_POOL_HOST/PORT/USER in Cloudflare Worker settings after choosing and verifying suitable pool providers, their payouts and exchange-address policies. Current bridge uses plain TCP and password x; not compatible with TLS-only pools or different password requirements. No real pool earnings can be claimed until this is done.

WARNING: CPU browser mining is extremely unlikely to produce useful BTC/LTC income. AUTH ACCEPTED is not an accepted share. NICE is only a 5-second personal-best hash alert, not a prediction of block discovery.
