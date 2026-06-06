// tikwm.com is a free, no-auth public TikTok extractor.
// API: POST https://www.tikwm.com/api/ body=url=<url>&hd=1

import { HttpError, httpError } from "./downloader.server";
import type { NormalizedMedia, NormalizedStream } from "./piped.server";

const TIKWM_BASE = "https://www.tikwm.com";

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isTikTokUrl(u: URL): boolean {
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  return (
    host === "tiktok.com" ||
    host.endsWith(".tiktok.com") ||
    host === "vm.tiktok.com" ||
    host === "vt.tiktok.com" ||
    host === "m.tiktok.com"
  );
}

interface TikwmResponse {
  code?: number;
  msg?: string;
  data?: {
    title?: string;
    cover?: string;
    origin_cover?: string;
    play?: string;
    hdplay?: string;
    wmplay?: string;
    music?: string;
    duration?: number;
    size?: number;
    hd_size?: number;
  };
}

function formatBytes(n?: number): string | undefined {
  if (!n || n <= 0) return undefined;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function tikwmCall(url: string): Promise<TikwmResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const body = new URLSearchParams({ url, hd: "1" });
    const res = await fetch(`${TIKWM_BASE}/api/`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "lovable-downloader/1.0",
      },
      body: body.toString(),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let json: TikwmResponse | null = null;
    try { json = text ? JSON.parse(text) as TikwmResponse : null; } catch { /* */ }
    if (!res.ok || !json) {
      throw new HttpError(502, `tikwm error (${res.status})`, res.status);
    }
    if (json.code !== 0) {
      throw httpError(422, json.msg || "TikTok extractor couldn't process this URL.");
    }
    return json;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if ((err as Error).name === "AbortError") throw httpError(504, "tikwm timed out");
    throw httpError(502, "Couldn't reach the TikTok extractor");
  } finally {
    clearTimeout(timeout);
  }
}

export async function tikwmDetect(tiktokUrl: URL): Promise<NormalizedMedia> {
  const r = await tikwmCall(tiktokUrl.toString());
  const d = r.data || {};
  const streams: NormalizedStream[] = [];

  if (d.hdplay) {
    streams.push({
      id: b64urlEncode(d.hdplay),
      kind: "video",
      container: "mp4",
      resolution: "HD",
      fileSize: formatBytes(d.hd_size),
    });
  }
  if (d.play) {
    streams.push({
      id: b64urlEncode(d.play),
      kind: "video",
      container: "mp4",
      resolution: "SD (no watermark)",
      fileSize: formatBytes(d.size),
    });
  }
  if (d.wmplay) {
    streams.push({
      id: b64urlEncode(d.wmplay),
      kind: "video",
      container: "mp4",
      resolution: "SD (watermarked)",
    });
  }
  if (d.music) {
    streams.push({
      id: b64urlEncode(d.music),
      kind: "audio",
      container: "mp3",
    });
  }

  return {
    title: d.title || "TikTok video",
    thumbnail: d.cover || d.origin_cover,
    previewUrl: d.play,
    streams,
  };
}

export async function tikwmResolveAudio(tiktokUrl: URL): Promise<{ download_url: string; filename?: string }> {
  const r = await tikwmCall(tiktokUrl.toString());
  const link = r.data?.music;
  if (!link) throw httpError(422, "No audio track found on this TikTok post.");
  return { download_url: link, filename: `${(r.data?.title || "tiktok").slice(0, 80)}.mp3` };
}

export async function tikwmResolveBest(tiktokUrl: URL): Promise<{ download_url: string; filename?: string }> {
  const r = await tikwmCall(tiktokUrl.toString());
  const link = r.data?.hdplay || r.data?.play || r.data?.wmplay;
  if (!link) throw httpError(422, "No video found for this TikTok post.");
  return { download_url: link, filename: `${(r.data?.title || "tiktok").slice(0, 80)}.mp4` };
}
