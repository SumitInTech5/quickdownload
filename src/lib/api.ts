// Thin client for the in-app proxy backend (see src/routes/api/*).
// Single-attempt calls; the UI surfaces upstream errors directly.

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

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const FRIENDLY_BY_STATUS: Record<number, string> = {
  400: "That URL doesn't look right. Please check it and try again.",
  401: "The downloader rejected this request.",
  403: "This source is blocked or restricted.",
  404: "We couldn't find that media. Make sure the link is public and complete.",
  408: "The source took too long to respond. Please try again.",
  422: "That URL isn't a media page we can read.",
  429: "Too many requests right now. Please wait a moment and retry.",
  500: "Something went wrong on our side. Please try again.",
  501: "This operation isn't supported for this source.",
  502: "The downloader backend had trouble. Please try again in a moment.",
  503: "The downloader backend isn't configured. Please try again shortly.",
  504: "The downloader backend timed out. Please try again.",
};

async function rawPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Network error — check your connection and try again.");
  }
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* */ }
  if (!res.ok) {
    const upstreamMsg =
      json && typeof json === "object" && "error" in (json as Record<string, unknown>)
        ? String((json as Record<string, unknown>).error)
        : "";
    const friendly = FRIENDLY_BY_STATUS[res.status] ?? `Request failed (${res.status})`;
    // Prefer the server's specific message (Cobalt errors are descriptive); fall back to friendly.
    const msg = upstreamMsg && upstreamMsg !== "Internal error" ? upstreamMsg : friendly;
    throw new ApiError(res.status, msg);
  }
  return json as T;
}

export const api = {
  detect: (url: string) =>
    rawPost<DetectResponse>("/api/detect", { url, copyright_confirmed: true }),
  download: (url: string, streamId: string) =>
    rawPost<MediaLink>("/api/download", { url, format_id: streamId, copyright_confirmed: true }),
  convert: (url: string, target_format: string, bitrate?: string) =>
    rawPost<MediaLink>("/api/convert", { url, target_format, bitrate, copyright_confirmed: true }),
};
