SALEHBC v5.2 experimental diagnostics

Added LTC Scrypt(1024,1,1) offline vector check (80 zero bytes), independent BTC genesis check, separate BTC/LTC local hash rates.
The existing Litecoin Scrypt calculation matched the independent Python hashlib.scrypt reference vector; no unverified claim of a repaired algorithm.
IMPORTANT: 0 submitted/accepted shares still means no proof of valid mining shares. The offline tests do not verify live Stratum share submission or pool acceptance. The 50 workers share one phone CPU.

GITHUB: upload index.html, miner.js, ltc-miner.js, portrait.jpg, and README as usual.
CLOUDFLARE: worker.js is included for reference, but unchanged from the uploaded project. Do not deploy it unless you are intentionally updating the existing Cloudflare Worker.
