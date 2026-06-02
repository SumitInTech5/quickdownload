// Thin client for the in-app proxy backend (see src/routes/api/*).
// Adds retry with exponential backoff and typed errors so the UI can show
// friendly progress states. No media bytes transit the client beyond the
// final browser-initiated download of the upstream direct link.

export interface MediaStream {
  id: string;
  kind: "video" | "audio";
  container: string;
  resolution?: string;
  bitrate?: string;
  fileSize?: string;
}

export interface DetectResponse {
  title: string;
  thumbnail?: string;
  previewUrl?: string;
  streams: MediaStream[];
}

export interface MediaLink {
  download_url: string;
  expires_at?: string | null;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  providers: Array<{ name: string; ok: boolean; latencyMs: number; status?: number; message?: string }>;
  checkedAt: string;
}

export class ApiError extends Error {
  status: number;
  retriable: boolean;
  constructor(status: number, message: string, retriable: boolean) {
    super(message);
    this.status = status;
    this.retriable = retriable;
  }
}

const FRIENDLY_BY_STATUS: Record<number, string> = {
  400: "That URL doesn't look right. Please check it and try again.",
  401: "The downloader provider rejected this request. Try a different URL.",
  403: "This source is blocked or restricted right now. We tried a fallback automatically — please try again or use a different URL.",
  404: "We couldn't find that media. Make sure the link is public and complete.",
  408: "The upstream took too long to respond. Please try again.",
  422: "That URL isn't a media page we can read.",
  429: "Too many requests right now. Please wait a moment and retry.",
  500: "Something went wrong on our side. Please try again.",
  501: "This operation isn't supported for this source.",
  502: "Upstream had trouble responding. Please try again in a moment.",
  503: "The downloader backend isn't fully configured yet. Please try again shortly.",
  504: "Upstream timed out. Please try again.",
};

function isRetriable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function rawPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Network error — check your connection and try again.", true);
  }
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok) {
    const upstreamMsg =
      json && typeof json === "object" && "error" in (json as Record<string, unknown>)
        ? String((json as Record<string, unknown>).error)
        : "";
    const friendly = FRIENDLY_BY_STATUS[res.status] ?? `Request failed (${res.status})`;
    const msg = friendly + (upstreamMsg && res.status >= 500 ? "" : "");
    throw new ApiError(res.status, msg, isRetriable(res.status));
  }
  return json as T;
}

export interface RetryHooks {
  onAttempt?: (attempt: number, total: number) => void;
  onRetry?: (attempt: number, total: number, nextInMs: number, error: ApiError) => void;
  signal?: AbortSignal;
}

export interface RetryOptions extends RetryHooks {
  attempts?: number;
  baseMs?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 1000;
  let lastErr: ApiError | undefined;
  for (let i = 0; i < attempts; i++) {
    if (opts.signal?.aborted) throw new ApiError(0, "Cancelled", false);
    opts.onAttempt?.(i + 1, attempts);
    try {
      return await fn();
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError(0, (err as Error).message, true);
      lastErr = e;
      if (!e.retriable || i === attempts - 1) throw e;
      const delay = baseMs * Math.pow(2, i);
      opts.onRetry?.(i + 1, attempts, delay, e);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr ?? new ApiError(500, "Unknown error", false);
}

export const api = {
  detect: (url: string, hooks?: RetryHooks) =>
    withRetry(
      () => rawPost<DetectResponse>("/api/detect", { url, copyright_confirmed: true }),
      hooks,
    ),
  download: (url: string, streamId: string, hooks?: RetryHooks) =>
    withRetry(
      () =>
        rawPost<MediaLink>("/api/download", {
          url,
          format_id: streamId,
          copyright_confirmed: true,
        }),
      hooks,
    ),
  convert: (
    url: string,
    target_format: string,
    bitrate?: string,
    sample_rate?: string,
    hooks?: RetryHooks,
  ) =>
    withRetry(
      () =>
        rawPost<MediaLink>("/api/convert", {
          url,
          target_format,
          bitrate,
          sample_rate,
          copyright_confirmed: true,
        }),
      hooks,
    ),
  health: async (): Promise<HealthResponse> => {
    const res = await fetch("/api/health");
    if (!res.ok) throw new ApiError(res.status, "Health check failed", false);
    return (await res.json()) as HealthResponse;
  },
};
