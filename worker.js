// SALEHBC status endpoint only. No Stratum gateway and no mining.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    };
    if (url.pathname === "/status") {
      return new Response(JSON.stringify({
        project: "SALEHBC", version: "2.0", server: "ONLINE",
        mining: "NOT_CONNECTED", pool: "NOT_CONFIGURED",
        acceptedShares: 0, message: "Status API only; no pool connection"
      }), {headers});
    }
    return new Response(JSON.stringify({project: "SALEHBC", server: "ONLINE", mining: "NOT_CONNECTED"}), {headers});
  }
};
