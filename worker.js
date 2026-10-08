export default {
  async fetch(request) {
    const url = new URL(request.url);

    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    };

    if (url.pathname === "/status") {
      return new Response(
        JSON.stringify({
          project: "SALEHBC",
          version: "2.0",
          server: "ONLINE",
          mining: "NOT_CONNECTED",
          pool: "NOT_CONFIGURED",
          acceptedShares: 0,
          message: "SALEHBC server is ready"
        }),
        { status: 200, headers }
      );
    }

    return new Response(
      JSON.stringify({
        project: "SALEHBC",
        server: "ONLINE",
        mining: "NOT_CONNECTED",
        message: "Welcome to SALEHBC Mining Server"
      }),
      { status: 200, headers }
    );
  }
};
