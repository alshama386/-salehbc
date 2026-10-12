SALEHBC NICE continuous indicator update

Changed only index.html, miner.js, and ltc-miner.js.
NICE appears red next to SALEHBC when a hash has >=16 leading zero bits. It remains visible while qualifying hashes keep arriving, and hides 5 seconds after the last qualifying hash or immediately on Stop. The personal-best display is unchanged.

This is a recent-hash-quality/activity indicator, not evidence that a block is near. Hashes are independent.

Upload the three updated files to GitHub Pages (or upload the full project); no Cloudflare worker.js changes are required. Hard-refresh the page after publishing.

Mining connections and pool payouts remain unchanged.
