// Client for the user-hosted yt-dlp microservice (see yt-dlp-service/ folder).
// Returns null when not configured so the orchestrator can fall through.

import { HttpError, httpError } from "./downloader.server";
import { type NormalizedMedia, type NormalizedStream } from "./piped.server";

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function formatBytes(n?: number | null): string | undefined {
  if (!n || n <= 0) return undefined;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function ytdlpBase(): string | null {
  const raw = (process.env.YTDLP_SERVICE_URL || "").trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function authHeaders(): Record<string, string> {
  const key = (process.env.YTDLP_SERVICE_API_KEY || "").trim();
  return key ? { "X-API-Key": key } : {};
}

interface YtdlpFormat {
  format_id?: string;
  ext?: string;
  resolution?: string | null;
  height?: number | null;
  abr?: number | null;
  vbr?: number | null;
  tbr?: number | null;
  filesize?: number | null;
  vcodec?: string | null;
  acodec?: string | null;
  has_audio?: boolean;
  has_video?: boolean;
  url?: string;
}

interface YtdlpInfo {
  title?: string;
  thumbnail?: string;
  duration?: number;
  formats?: YtdlpFormat[];
}

interface YtdlpResolve {
  download_url?: string;
  filename?: string;
  ext?: string;
}

async function ytdlpPost<T>(path: string, body: unknown, timeoutMs = 30000): Promise<T> {
  const base = ytdlpBase();
  if (!base) throw httpError(503, "yt-dlp service is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(base + path, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* */ }
    if (!res.ok) {
      const detail =
        json && typeof json === "object" && "detail" in (json as Record<string, unknown>)
          ? String((json as Record<string, unknown>).detail)
          : (text || `HTTP ${res.status}`);
      // 422 from yt-dlp usually means an unsupported / private / geoblocked URL.
      const status = res.status === 401 ? 503 : res.status === 422 ? 422 : 502;
      throw httpError(status, status === 422 ? snippetFriendly(detail) : `yt-dlp service error: ${snippetFriendly(detail)}`);
    }
    if (!json) throw httpError(502, "yt-dlp service returned an empty response");
    return json as T;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if ((err as Error).name === "AbortError") {
      throw httpError(504, "yt-dlp service timed out (free-tier services can take ~30s to wake up — please try again)");
    }
    throw httpError(502, "Couldn't reach the yt-dlp service");
  } finally {
    clearTimeout(timeout);
  }
}

function snippetFriendly(detail: string): string {
  const d = detail.toLowerCase();
  if (d.includes("private") || d.includes("login required")) return "That video is private or requires login.";
  if (d.includes("unavailable")) return "That video is unavailable.";
  if (d.includes("age")) return "That video is age-restricted.";
  if (d.includes("geoblock") || d.includes("not available in your country")) return "That video is region-blocked.";
  if (d.includes("unsupported url") || d.includes("no video found")) return "That source isn't supported.";
  if (d.includes("drm")) return "DRM-protected content can't be downloaded.";
  return detail.slice(0, 200);
}

export function isYtdlpConfigured(): boolean {
  return !!ytdlpBase();
}

export async function ytdlpDetect(url: string): Promise<NormalizedMedia> {
  const data = await ytdlpPost<YtdlpInfo>("/info", { url });
  const formats = (data.formats ?? []).filter((f) => f.url);
  const streams: NormalizedStream[] = formats
    .slice(0, 80)
    .map((f) => {
      const kind: "video" | "audio" = f.has_video
        ? "video"
        : f.has_audio
          ? "audio"
          : "video";
      return {
        id: b64urlEncode(f.url!),
        kind,
        container: (f.ext || "mp4").toLowerCase(),
        resolution: f.resolution || (f.height ? `${f.height}p` : undefined),
        bitrate: f.abr
          ? `${Math.round(f.abr)}kbps`
          : f.vbr
            ? `${Math.round(f.vbr)}kbps`
            : f.tbr
              ? `${Math.round(f.tbr)}kbps`
              : undefined,
        fileSize: formatBytes(f.filesize ?? undefined),
      };
    });
  return {
    title: data.title || "Untitled",
    thumbnail: data.thumbnail,
    streams,
  };
}

/**
 * Used by /api/convert. yt-dlp picks the best audio matching the requested format.
 */
export async function ytdlpResolveAudio(
  url: string,
  audioFormat: string,
  audioBitrate?: string,
): Promise<{ download_url: string; filename?: string }> {
  const data = await ytdlpPost<YtdlpResolve>("/resolve", {
    url,
    audio_format: audioFormat,
    audio_bitrate: audioBitrate?.replace(/k$/i, ""),
  });
  if (!data.download_url) throw httpError(502, "yt-dlp returned no link");
  return { download_url: data.download_url, filename: data.filename };
}

export async function ytdlpResolveBest(url: string): Promise<{ download_url: string; filename?: string }> {
  const data = await ytdlpPost<YtdlpResolve>("/resolve", { url });
  if (!data.download_url) throw httpError(502, "yt-dlp returned no link");
  return { download_url: data.download_url, filename: data.filename };
}
