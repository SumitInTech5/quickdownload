// Orchestrator: tries Piped (YouTube) → yt-dlp service → Cobalt presets.
// Each downstream returns our common NormalizedMedia shape.

import { HttpError, httpError } from "./downloader.server";
import {
  b64urlDecode,
  isYouTubeUrl,
  pipedDetect,
  type NormalizedMedia,
} from "./piped.server";
import {
  isYtdlpConfigured,
  ytdlpDetect,
  ytdlpResolveAudio,
  ytdlpResolveBest,
} from "./ytdlp.server";
import { cobaltConvertAudio, cobaltResolve, PRESETS, type PresetId } from "./cobalt.server";

export interface DetectResult extends NormalizedMedia {
  source: "piped" | "ytdlp" | "cobalt";
}

function cobaltPresetMedia(): NormalizedMedia {
  return {
    title: "Available formats",
    streams: PRESETS.map((p) => ({
      // Prefix the id so download knows to call Cobalt and not decode a URL.
      id: `cobalt:${p.id}`,
      kind: p.kind,
      container: p.container,
      resolution: p.resolution,
      bitrate: p.bitrate,
    })),
  };
}

function isCobaltConfigured(): boolean {
  return !!(process.env.COBALT_API_URL || "").trim();
}

/**
 * Try every configured backend in order and return whichever succeeds first.
 * The resulting stream `id`s are either:
 *   - a base64url-encoded direct URL (Piped / yt-dlp) — download just decodes it
 *   - `cobalt:<presetId>` — download routes to Cobalt
 */
export async function detectAny(u: URL): Promise<DetectResult> {
  const errors: Array<{ src: string; message: string; status?: number }> = [];

  if (isYouTubeUrl(u)) {
    try {
      const data = await pipedDetect(u);
      if (data.streams.length > 0) return { ...data, source: "piped" };
      errors.push({ src: "piped", message: "No streams returned" });
    } catch (err) {
      const e = err as HttpError;
      errors.push({ src: "piped", message: e.message, status: e.status });
    }
  }

  if (isYtdlpConfigured()) {
    try {
      const data = await ytdlpDetect(u.toString());
      if (data.streams.length > 0) return { ...data, source: "ytdlp" };
      errors.push({ src: "ytdlp", message: "No streams returned" });
    } catch (err) {
      const e = err as HttpError;
      errors.push({ src: "ytdlp", message: e.message, status: e.status });
      // 422 from yt-dlp is authoritative ("private / unsupported / DRM") —
      // don't bother trying Cobalt, surface the real reason.
      if (e.status === 422) throw e;
    }
  }

  if (isCobaltConfigured()) {
    return { ...cobaltPresetMedia(), source: "cobalt" };
  }

  // Nothing succeeded and nothing else to try.
  if (errors.length === 0) {
    throw httpError(
      503,
      "No downloader backend is configured. Add YTDLP_SERVICE_URL (recommended) or COBALT_API_URL.",
    );
  }
  // Surface the most specific upstream error.
  const best = errors.find((e) => e.status && e.status >= 400 && e.status < 500) ?? errors[0];
  throw httpError(best.status ?? 502, `${best.src}: ${best.message}`);
}

/**
 * Resolve a chosen stream id into a direct download URL.
 */
export async function resolveAny(
  u: URL,
  formatId: string,
): Promise<{ download_url: string; filename?: string }> {
  // Cobalt preset path.
  if (formatId.startsWith("cobalt:")) {
    const preset = formatId.slice("cobalt:".length) as PresetId;
    const link = await cobaltResolve(u.toString(), preset);
    return { download_url: link.download_url, filename: link.filename };
  }
  // Piped / yt-dlp — id is just a base64url-encoded direct URL.
  const decoded = b64urlDecode(formatId);
  if (decoded) {
    return { download_url: decoded };
  }
  throw httpError(400, "Invalid format id");
}

/**
 * Audio convert: prefer yt-dlp service (clean extraction), then Cobalt.
 * Video convert (mp4): resolve via yt-dlp "best" then fall back to Cobalt video preset.
 */
export async function convertAny(
  u: URL,
  targetFormat: "mp3" | "aac" | "wav" | "ogg" | "m4a" | "mp4",
  bitrate?: string,
): Promise<{ download_url: string; filename?: string }> {
  const errors: Array<{ src: string; message: string; status?: number }> = [];

  if (targetFormat === "mp4") {
    if (isYtdlpConfigured()) {
      try {
        return await ytdlpResolveBest(u.toString());
      } catch (err) {
        const e = err as HttpError;
        errors.push({ src: "ytdlp", message: e.message, status: e.status });
        if (e.status === 422) throw e;
      }
    }
    if (isCobaltConfigured()) {
      const link = await cobaltResolve(u.toString(), "video-best");
      return link;
    }
  } else {
    // Audio
    if (isYtdlpConfigured()) {
      try {
        const audioFormat = targetFormat === "aac" ? "m4a" : targetFormat;
        return await ytdlpResolveAudio(u.toString(), audioFormat, bitrate);
      } catch (err) {
        const e = err as HttpError;
        errors.push({ src: "ytdlp", message: e.message, status: e.status });
        if (e.status === 422) throw e;
      }
    }
    if (isCobaltConfigured()) {
      return await cobaltConvertAudio(u.toString(), targetFormat, bitrate);
    }
  }

  if (errors.length > 0) {
    const best = errors[0];
    throw httpError(best.status ?? 502, `${best.src}: ${best.message}`);
  }
  throw httpError(503, "No downloader backend is configured. Add YTDLP_SERVICE_URL or COBALT_API_URL.");
}

export function backendStatus(): { ytdlp: boolean; cobalt: boolean; piped: true } {
  return { ytdlp: isYtdlpConfigured(), cobalt: isCobaltConfigured(), piped: true };
}
