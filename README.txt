SALEHBC SOLO AUTO v3.3 — COMPLETE FILES
Upload ALL files to the ROOT of GitHub Pages repository -salehbc (branch main), replacing matching existing files.
Files: index.html, miner.js, portrait.jpg, worker.js, wrangler.jsonc.
AUTO status is displayed in the AUTO SOLO WORKERS card. It starts benchmark after receiving the first mining.notify job; it tries 1, 2, 4, 8 workers up to browser hardwareConcurrency and selects best measured aggregate hashrate.
Keep your existing Cloudflare Worker deployment settings. The bridge URL is hardcoded in index.html.
WARNING: Experimental. Pool-side acceptance and correct share submissions are NOT independently verified. Never assume BTC payouts or discovered blocks based on local hashrate. Binance may not accept mining pool payouts to exchange deposit addresses.
