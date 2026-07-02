// Server-only proxy helper. Forwards requests to the Django backend with the
// server-side API key so the key never enters the client bundle.

const FRIENDLY_MESSAGES: Record<number, string> = {
  502: "The downloader backend had trouble. Please try again.",
  503: "The downloader backend isn't reachable.",
  504: "The downloader backend timed out.",
};

export async function forwardToBackend(path: string, request: Request): Promise<Response> {
  const base = (process.env.BACKEND_URL ?? "").replace(/\/+$/, "");
  if (!base) {
    return Response.json(
      { error: "Downloader backend not configured." },
      { status: 503 },
    );
  }
  const key = process.env.BACKEND_API_KEY ?? "";

  let body: string;
  try {
    body = await request.text();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["X-API-Key"] = key;

  let upstream: Response;
  try {
    upstream = await fetch(`${base}${path}`, { method: "POST", headers, body });
  } catch {
    return Response.json(
      { error: "The downloader backend isn't reachable." },
      { status: 503 },
    );
  }

  const text = await upstream.text();
  if (upstream.ok) {
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  }

  let clientError = FRIENDLY_MESSAGES[upstream.status];
  if (!clientError) {
    if (upstream.status >= 400 && upstream.status < 500) {
      try {
        const parsed = JSON.parse(text) as { error?: unknown };
        if (typeof parsed.error === "string" && parsed.error.length < 200) {
          clientError = parsed.error;
        }
      } catch { /* ignore */ }
    }
    clientError = clientError ?? "Request failed.";
  }
  return Response.json({ error: clientError }, { status: upstream.status });
}
