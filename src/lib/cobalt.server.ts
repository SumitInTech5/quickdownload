// Cobalt API client (https://github.com/imputnet/cobalt)
// We call a public no-auth Cobalt instance. The base URL is overridable via
// the COBALT_API_URL env var so we can swap mirrors without code changes.

import { HttpError, httpError } from "./downloader.server";

// Fallback list of community-run, no-auth public Cobalt instances.
// User can override (single URL or comma-separated list) via COBALT_API_URL.
const DEFAULT_COBALT_BASES = [
  "https://dwnld.nichi.co",
  "https://cobalt-api.kwiatekmiki.com",
  "https://co.eepy.today",
  "https://capi.oak.li",
];

function cobaltBases(): string[] {
  const raw = (process.env.COBALT_API_URL || "").trim();
  if (raw) return raw.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  return DEFAULT_COBALT_BASES;
}


export type PresetId =
  | "video-best"
  | "video-1080"
  | "video-720"
  | "video-480"
  | "audio-mp3"
  | "audio-m4a"
  | "audio-wav"
  | "audio-ogg";

export const PRESETS: Array<{
  id: PresetId;
  kind: "video" | "audio";
  label: string;
  container: string;
  resolution?: string;
  bitrate?: string;
}> = [
  { id: "video-best", kind: "video", label: "Video — best quality", container: "mp4", resolution: "max" },
  { id: "video-1080", kind: "video", label: "Video — 1080p", container: "mp4", resolution: "1080p" },
  { id: "video-720", kind: "video", label: "Video — 720p", container: "mp4", resolution: "720p" },
  { id: "video-480", kind: "video", label: "Video — 480p", container: "mp4", resolution: "480p" },
  { id: "audio-mp3", kind: "audio", label: "Audio — MP3", container: "mp3", bitrate: "320kbps" },
  { id: "audio-m4a", kind: "audio", label: "Audio — M4A (AAC)", container: "m4a", bitrate: "256kbps" },
  { id: "audio-wav", kind: "audio", label: "Audio — WAV (lossless)", container: "wav" },
  { id: "audio-ogg", kind: "audio", label: "Audio — OGG", container: "ogg", bitrate: "256kbps" },
];

interface CobaltPayload {
  url: string;
  downloadMode?: "auto" | "audio" | "mute";
  audioFormat?: "best" | "mp3" | "ogg" | "wav" | "opus" | "m4a";
  videoQuality?: "144" | "240" | "360" | "480" | "720" | "1080" | "1440" | "2160" | "max";
  filenameStyle?: "classic" | "pretty" | "basic" | "nerdy";
  audioBitrate?: "320" | "256" | "128" | "96" | "64" | "8";
}

interface CobaltResponse {
  status: "tunnel" | "redirect" | "picker" | "local-processing" | "error";
  url?: string;
  filename?: string;
  picker?: Array<{ url: string; type?: string; thumb?: string }>;
  error?: { code?: string; context?: Record<string, unknown> };
}

function presetToPayload(url: string, id: PresetId): CobaltPayload {
  const base: CobaltPayload = { url, filenameStyle: "pretty" };
  switch (id) {
    case "video-best": return { ...base, downloadMode: "auto", videoQuality: "max" };
    case "video-1080": return { ...base, downloadMode: "auto", videoQuality: "1080" };
    case "video-720": return { ...base, downloadMode: "auto", videoQuality: "720" };
    case "video-480": return { ...base, downloadMode: "auto", videoQuality: "480" };
    case "audio-mp3": return { ...base, downloadMode: "audio", audioFormat: "mp3", audioBitrate: "320" };
    case "audio-m4a": return { ...base, downloadMode: "audio", audioFormat: "m4a", audioBitrate: "256" };
    case "audio-wav": return { ...base, downloadMode: "audio", audioFormat: "wav" };
    case "audio-ogg": return { ...base, downloadMode: "audio", audioFormat: "ogg", audioBitrate: "256" };
  }
}

const FRIENDLY_COBALT_ERRORS: Record<string, string> = {
  "error.api.link.invalid": "That link isn't supported or isn't a recognizable media URL.",
  "error.api.link.unsupported": "This source isn't supported by the downloader.",
  "error.api.content.video.unavailable": "This video is private, age-restricted, or unavailable.",
  "error.api.content.video.private": "This video is private.",
  "error.api.content.video.age": "This video is age-restricted and can't be fetched anonymously.",
  "error.api.content.video.region": "This video is region-blocked.",
  "error.api.content.post.private": "That post is private.",
  "error.api.content.post.unavailable": "That post isn't available.",
  "error.api.rate_exceeded": "The downloader is rate-limited right now. Please try again shortly.",
  "error.api.capacity": "The downloader is at capacity. Please try again shortly.",
  "error.api.generic": "The downloader couldn't process this URL.",
  "error.api.fetch.empty": "The source returned no media.",
  "error.api.fetch.fail": "Couldn't reach the source.",
  "error.api.timed_out": "The source took too long to respond.",
};

function mapCobaltError(code: string | undefined, fallback: string): HttpError {
  if (code && FRIENDLY_COBALT_ERRORS[code]) return httpError(422, FRIENDLY_COBALT_ERRORS[code]);
  if (code?.includes("rate")) return httpError(429, FRIENDLY_COBALT_ERRORS["error.api.rate_exceeded"]);
  if (code?.includes("unsupported") || code?.includes("invalid"))
    return httpError(422, "This URL isn't supported by the downloader.");
  return httpError(502, fallback);
}

async function cobaltCall(payload: CobaltPayload): Promise<CobaltResponse> {
  const base = cobaltBase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(base + "/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "lovable-downloader/1.0",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let json: CobaltResponse | null = null;
    try { json = text ? JSON.parse(text) as CobaltResponse : null; } catch { /* */ }
    if (!res.ok) {
      const snippet = text.slice(0, 200);
      if (res.status === 429) throw httpError(429, "The downloader is rate-limited. Please try again shortly.");
      throw new HttpError(502, `Downloader backend error (${res.status})${snippet ? `: ${snippet}` : ""}`, res.status);
    }
    if (!json) throw httpError(502, "Downloader backend returned an invalid response");
    return json;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if ((err as Error).name === "AbortError") throw httpError(504, "Downloader backend timed out");
    throw httpError(502, "Couldn't reach the downloader backend");
  } finally {
    clearTimeout(timeout);
  }
}

export interface CobaltLink {
  download_url: string;
  filename?: string;
}

export async function cobaltResolve(url: string, presetId: PresetId): Promise<CobaltLink> {
  const valid = PRESETS.find((p) => p.id === presetId);
  if (!valid) throw httpError(400, "Unknown stream selection");
  const payload = presetToPayload(url, presetId);
  const r = await cobaltCall(payload);

  if (r.status === "error") {
    throw mapCobaltError(r.error?.code, "The downloader couldn't process this URL.");
  }
  if (r.status === "picker" && r.picker?.length) {
    return { download_url: r.picker[0].url, filename: r.filename };
  }
  if ((r.status === "tunnel" || r.status === "redirect" || r.status === "local-processing") && r.url) {
    return { download_url: r.url, filename: r.filename };
  }
  throw httpError(502, "Downloader backend returned no link");
}

export async function cobaltConvertAudio(
  url: string,
  format: "mp3" | "aac" | "wav" | "ogg" | "m4a",
  bitrate?: string,
): Promise<CobaltLink> {
  const audioFormat = format === "aac" ? "m4a" : format;
  const audioBitrate = bitrate?.replace(/k$/i, "") as CobaltPayload["audioBitrate"] | undefined;
  const r = await cobaltCall({
    url,
    downloadMode: "audio",
    audioFormat: audioFormat as CobaltPayload["audioFormat"],
    audioBitrate,
    filenameStyle: "pretty",
  });
  if (r.status === "error") throw mapCobaltError(r.error?.code, "Conversion failed.");
  if (r.status === "picker" && r.picker?.length) return { download_url: r.picker[0].url, filename: r.filename };
  if (r.url) return { download_url: r.url, filename: r.filename };
  throw httpError(502, "Downloader returned no link");
}
