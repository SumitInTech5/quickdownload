// Invidious is another free, public YouTube backend. We use it as a fallback
// when every Piped mirror fails.
// API: GET {base}/api/v1/videos/{id}

import { HttpError, httpError } from "./downloader.server";
import {
  extractYouTubeId,
  type NormalizedMedia,
  type NormalizedStream,
} from "./piped.server";

const DEFAULT_INVIDIOUS_BASES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://iv.ggtyler.dev",
  "https://invidious.jing.rocks",
  "https://invidious.privacyredirect.com",
  "https://yewtu.be",
];

function invidiousBases(): string[] {
  const raw = (process.env.INVIDIOUS_API_URL || "").trim();
  if (raw) return raw.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  return DEFAULT_INVIDIOUS_BASES;
}

interface InvFormatStream {
  url?: string;
  type?: string;
  quality?: string;
  qualityLabel?: string;
  bitrate?: string | number;
  size?: string;
  container?: string;
  resolution?: string;
}

interface InvAdaptiveStream extends InvFormatStream {
  audioQuality?: string;
}

interface InvResponse {
  title?: string;
  videoThumbnails?: Array<{ url?: string; quality?: string }>;
  formatStreams?: InvFormatStream[];
  adaptiveFormats?: InvAdaptiveStream[];
  error?: string;
}

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function formatBytesFromString(s?: string): string | undefined {
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function extFromType(type?: string, fallback = "mp4"): string {
  if (!type) return fallback;
  const m = type.split("/")[1]?.split(";")[0]?.trim().toLowerCase();
  return m || fallback;
}

function parseBitrate(b?: string | number): string | undefined {
  if (b == null) return undefined;
  const n = typeof b === "string" ? Number(b) : b;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return `${Math.round(n / 1000)}kbps`;
}

async function invidiousFetch(videoId: string): Promise<InvResponse> {
  const bases = invidiousBases();
  let lastErr: unknown;
  for (const base of bases) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${base}/api/v1/videos/${encodeURIComponent(videoId)}`, {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": "lovable-downloader/1.0" },
        signal: controller.signal,
        cache: "no-store",
      });
      const text = await res.text();
      let json: InvResponse | null = null;
      try { json = text ? JSON.parse(text) as InvResponse : null; } catch { /* */ }
      if (!res.ok || !json) {
        lastErr = new HttpError(502, `Invidious ${new URL(base).host} (${res.status})`, res.status);
        continue;
      }
      if (json.error) {
        lastErr = httpError(422, json.error);
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
  throw httpError(502, "All Invidious mirrors are unreachable");
}

export async function invidiousDetect(youtubeUrl: URL): Promise<NormalizedMedia> {
  const id = extractYouTubeId(youtubeUrl);
  if (!id) throw httpError(400, "Couldn't extract a YouTube video id from that URL");
  const data = await invidiousFetch(id);

  const streams: NormalizedStream[] = [];

  const combined = (data.formatStreams ?? []).filter((s) => s.url);
  for (const s of combined.slice(0, 6)) {
    streams.push({
      id: b64urlEncode(s.url!),
      kind: "video",
      container: extFromType(s.type, s.container || "mp4"),
      resolution: s.qualityLabel || s.resolution || s.quality,
      bitrate: parseBitrate(s.bitrate),
      fileSize: formatBytesFromString(s.size),
    });
  }

  const adaptive = (data.adaptiveFormats ?? []).filter((s) => s.url);
  const videoOnly = adaptive.filter((s) => s.type?.startsWith("video/"));
  const audioOnly = adaptive.filter((s) => s.type?.startsWith("audio/"));

  for (const s of videoOnly.slice(0, 8)) {
    streams.push({
      id: b64urlEncode(s.url!),
      kind: "video",
      container: extFromType(s.type, "mp4"),
      resolution: s.qualityLabel || s.resolution || s.quality,
      bitrate: parseBitrate(s.bitrate),
      fileSize: formatBytesFromString(s.size),
    });
  }

  for (const s of audioOnly.slice(0, 6)) {
    streams.push({
      id: b64urlEncode(s.url!),
      kind: "audio",
      container: extFromType(s.type, "m4a"),
      bitrate: parseBitrate(s.bitrate) || s.audioQuality,
      fileSize: formatBytesFromString(s.size),
    });
  }

  const thumb =
    data.videoThumbnails?.find((t) => t.quality === "maxresdefault")?.url ||
    data.videoThumbnails?.[0]?.url;

  return {
    title: data.title ?? "YouTube video",
    thumbnail: thumb,
    streams,
  };
}
