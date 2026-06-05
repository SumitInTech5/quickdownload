// Piped is a free, public, no-auth YouTube backend. We rotate through a list
// of community mirrors so failure of any single mirror is invisible to users.
//
// API: GET {pipedBase}/streams/{videoId}
// Docs: https://docs.piped.video/docs/api-documentation/

import { HttpError, httpError } from "./downloader.server";

const DEFAULT_PIPED_BASES = [
  "https://pipedapi.kavin.rocks",
  "https://piped-api.privacy.com.de",
  "https://pipedapi.r4fo.com",
  "https://api.piped.yt",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.leptons.xyz",
];

function pipedBases(): string[] {
  const raw = (process.env.PIPED_API_URL || "").trim();
  if (raw) return raw.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  return DEFAULT_PIPED_BASES;
}

export function isYouTubeUrl(u: URL): boolean {
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  return (
    host === "youtube.com" ||
    host === "youtu.be" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com"
  );
}

export function extractYouTubeId(u: URL): string | null {
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    return id && /^[a-zA-Z0-9_-]{6,15}$/.test(id) ? id : null;
  }
  if (host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{6,15}$/.test(v)) return v;
    // /shorts/{id} or /embed/{id} or /live/{id}
    const segs = u.pathname.split("/").filter(Boolean);
    const i = segs.findIndex((s) => ["shorts", "embed", "live", "v"].includes(s));
    if (i >= 0 && segs[i + 1] && /^[a-zA-Z0-9_-]{6,15}$/.test(segs[i + 1])) {
      return segs[i + 1];
    }
  }
  return null;
}

interface PipedStream {
  url: string;
  format?: string; // mime type like "video/mp4"
  quality?: string; // "1080p" / "128 kbps"
  mimeType?: string;
  codec?: string;
  videoOnly?: boolean;
  bitrate?: number;
  contentLength?: number;
  width?: number;
  height?: number;
}

interface PipedResponse {
  title?: string;
  thumbnailUrl?: string;
  duration?: number;
  uploader?: string;
  videoStreams?: PipedStream[];
  audioStreams?: PipedStream[];
  error?: string;
  message?: string;
}

function formatBytes(n?: number): string | undefined {
  if (!n || n <= 0) return undefined;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function extFromMime(mime?: string): string {
  if (!mime) return "mp4";
  const m = mime.split("/")[1]?.split(";")[0]?.trim().toLowerCase();
  return m || "mp4";
}

export interface NormalizedStream {
  id: string; // b64url-encoded direct URL — download just decodes it
  kind: "video" | "audio";
  container: string;
  resolution?: string;
  bitrate?: string;
  fileSize?: string;
}

export interface NormalizedMedia {
  title: string;
  thumbnail?: string;
  previewUrl?: string;
  streams: NormalizedStream[];
}

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): string | null {
  try {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const decoded = atob(padded + pad);
    if (!/^https?:\/\//i.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

async function pipedFetch(videoId: string): Promise<PipedResponse> {
  const bases = pipedBases();
  let lastErr: unknown;
  for (const base of bases) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${base}/streams/${encodeURIComponent(videoId)}`, {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": "lovable-downloader/1.0" },
        signal: controller.signal,
        cache: "no-store",
      });
      const text = await res.text();
      let json: PipedResponse | null = null;
      try { json = text ? JSON.parse(text) as PipedResponse : null; } catch { /* */ }
      if (!res.ok || !json) {
        lastErr = new HttpError(502, `Piped ${new URL(base).host} (${res.status})`, res.status);
        continue;
      }
      if (json.error || json.message) {
        lastErr = httpError(422, json.error || json.message || "Piped error");
        continue;
      }
      return json;
    } catch (err) {
      lastErr = err;
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }
  if (lastErr instanceof HttpError) throw lastErr;
  throw httpError(502, "All Piped mirrors are unreachable");
}

export async function pipedDetect(youtubeUrl: URL): Promise<NormalizedMedia> {
  const id = extractYouTubeId(youtubeUrl);
  if (!id) throw httpError(400, "Couldn't extract a YouTube video id from that URL");
  const data = await pipedFetch(id);

  const streams: NormalizedStream[] = [];
  // Best video streams (combined: has audio), then video-only top picks.
  const videos = (data.videoStreams ?? []).filter((s) => s.url);
  const audios = (data.audioStreams ?? []).filter((s) => s.url);

  // Prefer combined (videoOnly=false) first, then videoOnly fallbacks.
  const combined = videos.filter((v) => !v.videoOnly);
  const videoOnly = videos.filter((v) => v.videoOnly);

  for (const v of [...combined, ...videoOnly].slice(0, 12)) {
    streams.push({
      id: b64urlEncode(v.url),
      kind: "video",
      container: extFromMime(v.format || v.mimeType),
      resolution: v.quality || (v.height ? `${v.height}p` : undefined),
      bitrate: v.bitrate ? `${Math.round(v.bitrate / 1000)}kbps` : undefined,
      fileSize: formatBytes(v.contentLength),
    });
  }

  for (const a of audios.slice(0, 8)) {
    streams.push({
      id: b64urlEncode(a.url),
      kind: "audio",
      container: extFromMime(a.format || a.mimeType),
      bitrate: a.bitrate
        ? `${Math.round(a.bitrate / 1000)}kbps`
        : a.quality,
      fileSize: formatBytes(a.contentLength),
    });
  }

  return {
    title: data.title ?? "YouTube video",
    thumbnail: data.thumbnailUrl,
    streams,
  };
}
