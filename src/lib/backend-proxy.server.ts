// Server-only proxy helper. Forwards requests to the Django backend with the
// server-side API key so the key never enters the client bundle.

const FRIENDLY_MESSAGES: Record<number, string> = {
  502: "The downloader backend had trouble. Please try again.",
  503: "The downloader backend isn't reachable.",
  504: "The downloader backend timed out.",
};

const SETUP_MESSAGE =
  "Downloader backend is not connected yet. Deploy the Django backend and set BACKEND_URL and BACKEND_API_KEY in project secrets.";

const PROXY_TIMEOUT_MS = 55_000;

function getBackendConfig() {
  const base = (process.env.BACKEND_URL ?? "").replace(/\/+$/, "");
  const key = process.env.BACKEND_API_KEY ?? "";
  return { base, key };
}

export async function checkBackendHealth(): Promise<Response> {
  const { base, key } = getBackendConfig();
  if (!base || !key) {
    return Response.json(
      {
        ok: false,
        configured: false,
        message: SETUP_MESSAGE,
        missing: [!base ? "BACKEND_URL" : null, !key ? "BACKEND_API_KEY" : null].filter(Boolean),
      },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetch(`${base}/api/health/`, {
      method: "GET",
      headers: { "X-API-Key": key },
    });
    const text = await upstream.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch {
      payload = {};
    }

    if (!upstream.ok) {
      return Response.json(
        {
          ok: false,
          configured: true,
          message: "Downloader backend responded, but it is not ready for jobs yet.",
          status: upstream.status,
        },
        { status: upstream.status },
      );
    }

    return Response.json({
      ok: true,
      configured: true,
      message: "Downloader backend is connected and ready.",
      ...payload,
    });
  } catch {
    return Response.json(
      {
        ok: false,
        configured: true,
        message: "Downloader backend isn't reachable. Check the Render service URL and redeploy if it is sleeping.",
      },
      { status: 503 },
    );
  }
}

function backendErrorResponse(error: string, status: number): Response {
  return Response.json({ error, status }, { status: 200 });
}

export async function forwardToBackend(path: string, request: Request): Promise<Response> {
  const { base, key } = getBackendConfig();
  if (!base || !key) {
    return Response.json(
      { error: SETUP_MESSAGE },
      { status: 503 },
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  headers["X-API-Key"] = key;

  let upstream: Response;
  try {
    upstream = await fetch(`${base}${path}`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = (err as { name?: string } | null)?.name === "TimeoutError";
    return backendErrorResponse(
      timedOut
        ? "The downloader backend took too long to respond. Conversions can exceed the request window on long media or a waking Render service; try a shorter clip, retry after the backend is awake, or use Detect to download a source stream directly."
        : "The downloader backend isn't reachable.",
      timedOut ? 504 : 503,
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

  // Always try to surface the backend's actual error message (4xx or 5xx),
  // so users see e.g. "Sign in to confirm you're not a bot" instead of a
  // generic "backend had trouble" hint.
  let clientError: string | undefined;
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error.length > 0) {
      clientError = parsed.error.slice(0, 500);
    }
  } catch { /* ignore */ }
  clientError = clientError ?? FRIENDLY_MESSAGES[upstream.status] ?? "Request failed.";
  return backendErrorResponse(clientError, upstream.status);
}
