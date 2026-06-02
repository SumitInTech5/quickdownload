// Provider abstraction for the downloader proxy.
// Primary: ytjar all-in-one. Fallback: DataFanatic SMVD.
// No media bytes are stored — we only forward upstream JSON and return direct links.

import { HttpError, callRapidApi, hashUrl, httpError } from "./downloader.server";

export interface NormalizedStream {
  id: string;
  kind: "video" | "audio";
  container: string;
  resolution?: string;
  bitrate?: string;
  fileSize?: string;
}

export interface NormalizedDetect {
  title: string;
  thumbnail?: string;
  previewUrl?: string;
  streams: NormalizedStream[];
}

export interface NormalizedLink {
  download_url: string;
  expires_at: string | null;
}

export interface Provider {
  name: string;
  host: string;
  detect(url: string): Promise<NormalizedDetect>;
  download(url: string, formatId: string): Promise<NormalizedLink>;
  convert(url: string, format: string, bitrate?: string, sampleRate?: string): Promise<NormalizedLink>;
  ping(): Promise<void>;
}

// ---------- shared helpers ----------

function b64urlEncode(s: string) {
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

function formatBytes(n?: number) {
  if (!n || n <= 0) return undefined;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ---------- ytjar (primary) ----------

const YTJAR_HOST = "all-media-downloader1.p.rapidapi.com";

interface YtjarFormat {
  url?: string;
  ext?: string;
  format_id?: string;
  quality?: string | number;
  resolution?: string;
  height?: number;
  abr?: number | string;
  vbr?: number | string;
  tbr?: number | string;
  filesize?: number;
  filesize_approx?: number;
  vcodec?: string;
  acodec?: string;
  has_audio?: boolean;
  has_video?: boolean;
}

interface YtjarDetect {
  title?: string;
  thumbnail?: string;
  preview?: string;
  formats?: YtjarFormat[];
  data?: { title?: string; thumbnail?: string; formats?: YtjarFormat[] };
  result?: { title?: string; thumbnail?: string; formats?: YtjarFormat[] };
}

function classifyYtjar(f: YtjarFormat): "video" | "audio" {
  if (f.has_video) return "video";
  if (f.has_audio && !f.has_video) return "audio";
  const v = (f.vcodec ?? "").toLowerCase();
  const a = (f.acodec ?? "").toLowerCase();
  if (v && v !== "none") return "video";
  if (a && a !== "none") return "audio";
  const ext = (f.ext ?? "").toLowerCase();
  if (["mp3", "m4a", "aac", "ogg", "opus", "wav", "flac"].includes(ext)) return "audio";
  return "video";
}

export const ytjar: Provider = {
  name: "ytjar",
  host: YTJAR_HOST,
  async detect(url) {
    const upstream = await callRapidApi<YtjarDetect>("/v2/misc/info", {
      host: YTJAR_HOST,
      method: "GET",
      query: { url },
    });
    const root = upstream.data ?? upstream.result ?? upstream;
    const formats = root.formats ?? upstream.formats ?? [];
    const streams: NormalizedStream[] = formats
      .filter((f) => f.url)
      .slice(0, 80)
      .map((f, i) => ({
        id: b64urlEncode(f.url ?? `${i}`),
        kind: classifyYtjar(f),
        container: (f.ext ?? "mp4").toLowerCase(),
        resolution:
          f.resolution ??
          (f.height ? `${f.height}p` : undefined) ??
          (typeof f.quality === "string" ? f.quality : undefined),
        bitrate: f.abr
          ? `${f.abr}kbps`
          : f.vbr
            ? `${f.vbr}kbps`
            : f.tbr
              ? `${f.tbr}kbps`
              : undefined,
        fileSize: formatBytes(f.filesize ?? f.filesize_approx),
      }));
    return {
      title: root.title ?? "Untitled",
      thumbnail: root.thumbnail ?? upstream.thumbnail,
      previewUrl: upstream.preview,
      streams,
    };
  },
  async download(url, formatId) {
    const decoded = b64urlDecode(formatId);
    if (decoded) return { download_url: decoded, expires_at: null };
    const upstream = await callRapidApi<{
      url?: string;
      download_url?: string;
      link?: string;
      expires_at?: string;
      data?: { url?: string; download_url?: string; link?: string; expires_at?: string };
    }>("/v2/video/download", {
      host: YTJAR_HOST,
      method: "GET",
      query: { url, format: formatId },
    });
    const root = upstream.data ?? upstream;
    const link = root.url ?? root.download_url ?? root.link;
    if (!link) throw httpError(502, "Upstream returned no download link");
    return { download_url: link, expires_at: root.expires_at ?? null };
  },
  async convert(url, format, bitrate, sampleRate) {
    const query: Record<string, string> = { url, format };
    if (bitrate) query.bitrate = bitrate;
    if (sampleRate) query.sample_rate = sampleRate;
    const upstream = await callRapidApi<{
      url?: string;
      download_url?: string;
      link?: string;
      expires_at?: string;
    }>("/v2/misc/convert", { host: YTJAR_HOST, method: "GET", query });
    const link = upstream.url ?? upstream.download_url ?? upstream.link;
    if (!link) throw httpError(502, "Upstream returned no download link");
    return { download_url: link, expires_at: upstream.expires_at ?? null };
  },
  async ping() {
    await callRapidApi("/v2/misc/info", {
      host: YTJAR_HOST,
      method: "GET",
      query: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      timeoutMs: 5000,
    });
  },
};

// ---------- DataFanatic SMVD (fallback) ----------

const SMVD_HOST = "social-media-video-downloader.p.rapidapi.com";

interface SmvdLink {
  link?: string;
  url?: string;
  quality?: string;
  type?: string; // "video" | "audio" | "mp4" | etc
  ext?: string;
  bitrate?: string | number;
  size?: string;
  filesize?: number;
}

interface SmvdResponse {
  success?: boolean;
  title?: string;
  picture?: string;
  thumbnail?: string;
  preview?: string;
  links?: SmvdLink[];
  videos?: SmvdLink[];
  audios?: SmvdLink[];
}

function classifySmvd(l: SmvdLink): "video" | "audio" {
  const t = (l.type ?? "").toLowerCase();
  if (t.includes("audio")) return "audio";
  if (t.includes("video") || t === "mp4" || t === "webm") return "video";
  const ext = (l.ext ?? "").toLowerCase();
  if (["mp3", "m4a", "aac", "ogg", "opus", "wav", "flac"].includes(ext)) return "audio";
  return "video";
}

export const dataFanatic: Provider = {
  name: "dataFanatic",
  host: SMVD_HOST,
  async detect(url) {
    const upstream = await callRapidApi<SmvdResponse>("/smvd/get/all", {
      host: SMVD_HOST,
      method: "GET",
      query: { url },
    });
    const all: SmvdLink[] = [
      ...(upstream.links ?? []),
      ...(upstream.videos ?? []),
      ...(upstream.audios ?? []),
    ];
    const streams: NormalizedStream[] = all
      .map((l) => ({ ...l, link: l.link ?? l.url }))
      .filter((l) => !!l.link)
      .slice(0, 80)
      .map((l, i) => ({
        id: b64urlEncode(l.link ?? `${i}`),
        kind: classifySmvd(l),
        container: (l.ext ?? l.type ?? "mp4").toLowerCase(),
        resolution: l.quality,
        bitrate: l.bitrate ? `${l.bitrate}kbps` : undefined,
        fileSize: l.size ?? formatBytes(l.filesize),
      }));
    return {
      title: upstream.title ?? "Untitled",
      thumbnail: upstream.thumbnail ?? upstream.picture,
      previewUrl: upstream.preview,
      streams,
    };
  },
  async download(_url, formatId) {
    const decoded = b64urlDecode(formatId);
    if (!decoded) throw httpError(400, "Invalid format id for fallback provider");
    return { download_url: decoded, expires_at: null };
  },
  async convert(_url, _format, _bitrate, _sampleRate) {
    // SMVD does not expose a generic transcoder.
    throw httpError(501, "Conversion is not available on the fallback provider");
  },
  async ping() {
    await callRapidApi("/smvd/get/all", {
      host: SMVD_HOST,
      method: "GET",
      query: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      timeoutMs: 5000,
    });
  },
};

// ---------- orchestration ----------

const PROVIDERS = [ytjar, dataFanatic];

function shouldFallback(err: unknown): boolean {
  if (!(err instanceof HttpError)) return false;
  const us = err.upstreamStatus;
  // Fall back when upstream rejects auth/permission or claims the resource is gone.
  return us === 401 || us === 403 || us === 404 || us === 410 || us === 451;
}

export async function tryProviders<R>(
  op: (p: Provider) => Promise<R>,
  routeLabel: string,
  urlForLog: string,
): Promise<R> {
  let lastErr: unknown;
  for (let i = 0; i < PROVIDERS.length; i++) {
    const p = PROVIDERS[i];
    try {
      const r = await op(p);
      if (i > 0) {
        const h = await hashUrl(urlForLog).catch(() => "n/a");
        console.log(JSON.stringify({ t: new Date().toISOString(), r: routeLabel, url_h: h, fallback: p.name }));
      }
      return r;
    } catch (err) {
      lastErr = err;
      if (i < PROVIDERS.length - 1 && shouldFallback(err)) continue;
      throw err;
    }
  }
  throw lastErr ?? httpError(502, "All providers failed");
}

// ---------- health ----------

interface ProviderHealth {
  name: string;
  ok: boolean;
  latencyMs: number;
  status?: number;
  message?: string;
}

let healthCache: { at: number; payload: HealthPayload } | null = null;
const HEALTH_TTL_MS = 30_000;

export interface HealthPayload {
  status: "ok" | "degraded" | "down";
  providers: ProviderHealth[];
  checkedAt: string;
}

export async function getHealth(force = false): Promise<HealthPayload> {
  if (!force && healthCache && Date.now() - healthCache.at < HEALTH_TTL_MS) {
    return healthCache.payload;
  }
  if (!process.env.RAPIDAPI_KEY) {
    const payload: HealthPayload = {
      status: "down",
      providers: PROVIDERS.map((p) => ({
        name: p.name,
        ok: false,
        latencyMs: 0,
        message: "RAPIDAPI_KEY not configured",
      })),
      checkedAt: new Date().toISOString(),
    };
    healthCache = { at: Date.now(), payload };
    return payload;
  }
  const results = await Promise.all(
    PROVIDERS.map(async (p) => {
      const t0 = Date.now();
      try {
        await p.ping();
        return { name: p.name, ok: true, latencyMs: Date.now() - t0 };
      } catch (err) {
        const e = err as HttpError;
        return {
          name: p.name,
          ok: false,
          latencyMs: Date.now() - t0,
          status: e.upstreamStatus,
          message: e.message,
        };
      }
    }),
  );
  const primary = results[0]?.ok ?? false;
  const fallback = results[1]?.ok ?? false;
  const status: HealthPayload["status"] = primary ? "ok" : fallback ? "degraded" : "down";
  const payload: HealthPayload = { status, providers: results, checkedAt: new Date().toISOString() };
  healthCache = { at: Date.now(), payload };
  return payload;
}
