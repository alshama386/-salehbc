SALEHBC v5.3 — BTC / LTC × SOLO / POOL

Replace the GitHub site files with this ZIP contents. Keep all files at the repository root.
IMPORTANT: update/deploy worker.js to your existing Cloudflare Worker; otherwise v5.3 connections will NOT work (old routes use solo/pool, new routes use btc_solo/ltc_solo/btc_pool/ltc_pool).

The existing BTC SOLO (CKPool) and LTC SOLO (LiteSolo) are configured as before, subject to real network connectivity and acceptance.
POOL is NOT ready by default. To enable actual reward-sharing pool mining, choose a pool that accepts SHA256d BTC or Scrypt LTC mining with browser-level hashrates and pays to your wallet; verify its payout terms, minimum threshold, and whether exchange deposit addresses are allowed. Set these Cloudflare Worker environment variables:
BTC_POOL_HOST, BTC_POOL_PORT, BTC_POOL_USER
LTC_POOL_HOST, LTC_POOL_PORT, LTC_POOL_USER
Only configure a coin for which you have verified pool details. A password of x is sent by the bridge, which may not work for pools requiring another password or TLS-only ports. This bridge uses raw TCP, not TLS.

The interface refuses to start modes with unconfigured pool targets instead of pretending they mine. Even if a pool connection authorizes, accepted shares and payout verification remain necessary.

NICE flashes red for 5 seconds when a NEW personal best hash reaches >=16 leading zero bits. This is NOT a prediction of an imminent block. On-chain BTC incoming totals are displayed, but they do NOT prove mining earnings. LTC and POOL earnings/withdrawals display 'unavailable' until a verifiable pool-specific payment API is integrated; do not interpret them as zero.

Using 50 workers on an iPhone shares the same CPU; it does not increase computational power 50x. Phone browser mining has negligible earning potential.
