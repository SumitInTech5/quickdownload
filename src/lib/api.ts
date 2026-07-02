// Thin client. Calls same-origin server proxy routes so the backend API key
// is never shipped to the browser bundle.

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
  filename?: string;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const FRIENDLY_BY_STATUS: Record<number, string> = {
  0: "Can't reach the downloader service. Please try again.",
  400: "That URL doesn't look right. Please check it and try again.",
  401: "The downloader rejected this request.",
  403: "This source is blocked or restricted.",
  404: "We couldn't find that media. Make sure the link is public and complete.",
  408: "The source took too long to respond. Please try again.",
  422: "That URL isn't a media page we can read.",
  429: "Too many requests right now. Please wait a moment and retry.",
  500: "Something went wrong. Please try again.",
  501: "This operation isn't supported for this source.",
  502: "The downloader backend had trouble. Please try again in a moment.",
  503: "The downloader backend isn't reachable. Please try again shortly.",
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
    throw new ApiError(0, FRIENDLY_BY_STATUS[0]);
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
    throw new ApiError(res.status, upstreamMsg || friendly);
  }
  return json as T;
}

export const api = {
  detect: (url: string) =>
    rawPost<DetectResponse>("/api/proxy/detect", { url }),
  download: (url: string, streamId: string) =>
    rawPost<MediaLink>("/api/proxy/download", { url, format_id: streamId }),
  convert: (url: string, target_format: string, bitrate?: string) =>
    rawPost<MediaLink>("/api/proxy/convert", { url, target_format, bitrate }),
};
