SALEHBC — Start-button correction (frontend-only)

Problem: If SOLO + POOL is selected while the two POOL targets are unconfigured, start was blocked completely.

Fix: If SOLO targets are configured, the user is offered an EXPLICIT confirmation to run SOLO only for the selected coin(s). No silent fallback. POOL is NOT running and no POOL payouts are claimed. Selecting SOLO directly works normally.

INSTALL: Upload index.html (or all ZIP files) to GitHub Pages. The Cloudflare worker.js in this archive is the SAME 5.3.1 code as previously deployed. There is no need to re-deploy it if /status shows version 5.3.1 and SOLO targets configured:true.

POOL still requires verified pool host/port/account credentials and compatible Stratum transport. BTC/LTC browser mining has an extraordinarily low chance of finding a block.
