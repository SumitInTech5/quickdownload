import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  callRapidApi,
  copyrightFlag,
  corsResponse,
  handle,
  urlInput,
  validatePublicUrl,
} from "@/lib/downloader.server";

const schema = z.object({
  url: urlInput,
  copyright_confirmed: copyrightFlag,
});

interface UpstreamFormat {
  url?: string;
  ext?: string;
  format?: string;
  format_id?: string;
  format_note?: string;
  quality?: string | number;
  resolution?: string;
  width?: number;
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

interface UpstreamDetect {
  title?: string;
  thumbnail?: string;
  preview?: string;
  formats?: UpstreamFormat[];
  // Some ytjar endpoints nest under data/result
  data?: { title?: string; thumbnail?: string; formats?: UpstreamFormat[] };
  result?: { title?: string; thumbnail?: string; formats?: UpstreamFormat[] };
}

function b64urlEncode(s: string) {
  // btoa is available in workerd
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function classify(f: UpstreamFormat): "video" | "audio" {
  if (f.has_video) return "video";
  if (f.has_audio && !f.has_video) return "audio";
  const v = (f.vcodec ?? "").toLowerCase();
  const a = (f.acodec ?? "").toLowerCase();
  if (v && v !== "none") return "video";
  if (a && a !== "none") return "audio";
  // Fall back to extension
  const ext = (f.ext ?? "").toLowerCase();
  if (["mp3", "m4a", "aac", "ogg", "opus", "wav", "flac"].includes(ext)) return "audio";
  return "video";
}

function formatBytes(n?: number) {
  if (!n || n <= 0) return undefined;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export const Route = createFileRoute("/api/detect")({
  server: {
    handlers: {
      OPTIONS: async () => corsResponse(),
      POST: async ({ request }) =>
        handle("detect", request, async (body) => {
          const input = schema.parse(body);
          const u = validatePublicUrl(input.url);
          const upstream = await callRapidApi<UpstreamDetect>("/v2/misc/info", {
            method: "GET",
            query: { url: u.toString() },
          });
          const root = upstream.data ?? upstream.result ?? upstream;
          const title = root.title ?? "Untitled";
          const thumbnail = root.thumbnail ?? upstream.thumbnail;
          const formats = root.formats ?? upstream.formats ?? [];

          const streams = formats
            .filter((f) => f.url)
            .slice(0, 80)
            .map((f, i) => {
              const kind = classify(f);
              const resolution =
                f.resolution ??
                (f.height ? `${f.height}p` : undefined) ??
                (typeof f.quality === "string" ? f.quality : undefined);
              const bitrate = f.abr
                ? `${f.abr}kbps`
                : f.vbr
                  ? `${f.vbr}kbps`
                  : f.tbr
                    ? `${f.tbr}kbps`
                    : undefined;
              return {
                id: b64urlEncode(f.url ?? `${i}`),
                kind,
                container: (f.ext ?? "mp4").toLowerCase(),
                resolution,
                bitrate,
                fileSize: formatBytes(f.filesize ?? f.filesize_approx),
              };
            });

          return {
            url: u.toString(),
            data: {
              title,
              thumbnail,
              previewUrl: upstream.preview,
              streams,
            },
          };
        }),
    },
  },
});
