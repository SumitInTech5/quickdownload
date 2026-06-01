// Thin client for the in-app proxy backend (see src/routes/api/*).
// All requests require copyright confirmation. No media is stored server-side;
// download/convert return a direct upstream link the browser fetches.

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

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok) {
    const msg = (json && typeof json === "object" && "error" in (json as Record<string, unknown>))
      ? String((json as Record<string, unknown>).error)
      : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

export const api = {
  detect: (url: string) =>
    post<DetectResponse>("/api/detect", { url, copyright_confirmed: true }),
  download: (url: string, streamId: string) =>
    post<MediaLink>("/api/download", { url, format_id: streamId, copyright_confirmed: true }),
  convert: (url: string, target_format: string, bitrate?: string, sample_rate?: string) =>
    post<MediaLink>("/api/convert", {
      url,
      target_format,
      bitrate,
      sample_rate,
      copyright_confirmed: true,
    }),
};
