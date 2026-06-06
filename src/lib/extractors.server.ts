// Orchestrator: rotates through free public extractors.
//
// Chain:
//   1. YouTube  → Piped mirrors → Invidious mirrors
//   2. TikTok   → tikwm.com
//   3. Anything → public Cobalt mirrors (1800+ sites)

import { HttpError, httpError } from "./downloader.server";
import {
  b64urlDecode,
  isYouTubeUrl,
  pipedDetect,
  type NormalizedMedia,
} from "./piped.server";
import { invidiousDetect } from "./invidious.server";
import { isTikTokUrl, tikwmDetect, tikwmResolveAudio, tikwmResolveBest } from "./tikwm.server";
import { cobaltConvertAudio, cobaltResolve, PRESETS, type PresetId } from "./cobalt.server";

export interface DetectResult extends NormalizedMedia {
  source: "piped" | "invidious" | "tikwm" | "cobalt";
}

type ProviderError = { src: string; message: string; status?: number };

function captureErr(errors: ProviderError[], src: string, err: unknown): void {
  const e = err as HttpError;
  errors.push({ src, message: e.message ?? "Unknown error", status: e.status });
}

function cobaltPresetMedia(): NormalizedMedia {
  return {
    title: "Available formats",
    streams: PRESETS.map((p) => ({
      id: `cobalt:${p.id}`,
      kind: p.kind,
      container: p.container,
      resolution: p.resolution,
      bitrate: p.bitrate,
    })),
  };
}

export async function detectAny(u: URL): Promise<DetectResult> {
  const errors: ProviderError[] = [];

  if (isYouTubeUrl(u)) {
    try {
      const data = await pipedDetect(u);
      if (data.streams.length > 0) return { ...data, source: "piped" };
      errors.push({ src: "piped", message: "No streams returned" });
    } catch (err) {
      captureErr(errors, "piped", err);
    }
    try {
      const data = await invidiousDetect(u);
      if (data.streams.length > 0) return { ...data, source: "invidious" };
      errors.push({ src: "invidious", message: "No streams returned" });
    } catch (err) {
      captureErr(errors, "invidious", err);
    }
    // Even if both YouTube backends fail, Cobalt can still try.
  }

  if (isTikTokUrl(u)) {
    try {
      const data = await tikwmDetect(u);
      if (data.streams.length > 0) return { ...data, source: "tikwm" };
      errors.push({ src: "tikwm", message: "No streams returned" });
    } catch (err) {
      captureErr(errors, "tikwm", err);
    }
  }

  // Cobalt covers everything else (and acts as a backstop for YouTube/TikTok).
  return { ...cobaltPresetMedia(), source: "cobalt" };
}

export async function resolveAny(
  u: URL,
  formatId: string,
): Promise<{ download_url: string; filename?: string }> {
  if (formatId.startsWith("cobalt:")) {
    const preset = formatId.slice("cobalt:".length) as PresetId;
    return await cobaltResolve(u.toString(), preset);
  }
  const decoded = b64urlDecode(formatId);
  if (decoded) return { download_url: decoded };
  throw httpError(400, "Invalid format id");
}

export async function convertAny(
  u: URL,
  targetFormat: "mp3" | "aac" | "wav" | "ogg" | "m4a" | "mp4",
  bitrate?: string,
): Promise<{ download_url: string; filename?: string }> {
  if (isTikTokUrl(u)) {
    if (targetFormat === "mp4") {
      try { return await tikwmResolveBest(u); } catch { /* fall through to Cobalt */ }
    } else if (targetFormat === "mp3") {
      try { return await tikwmResolveAudio(u); } catch { /* fall through to Cobalt */ }
    }
  }

  if (targetFormat === "mp4") {
    return await cobaltResolve(u.toString(), "video-best");
  }
  return await cobaltConvertAudio(u.toString(), targetFormat, bitrate);
}

export function backendStatus(): { piped: true; invidious: true; tikwm: true; cobalt: true } {
  return { piped: true, invidious: true, tikwm: true, cobalt: true };
}
