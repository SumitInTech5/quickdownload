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

interface UpstreamDetect {
  title?: string;
  thumbnail?: string;
  preview?: string;
  formats?: Array<{
    format_id?: string;
    ext?: string;
    resolution?: string;
    quality?: string;
    abr?: string | number;
    vbr?: string | number;
    filesize?: number;
    vcodec?: string;
    acodec?: string;
  }>;
}

export const Route = createFileRoute("/api/detect")({
  server: {
    handlers: {
      OPTIONS: async () => corsResponse(),
      POST: async ({ request }) =>
        handle("detect", request, async (body) => {
          const input = schema.parse(body);
          const u = validatePublicUrl(input.url);
          const upstream = await callRapidApi<UpstreamDetect>("/v2/info", {
            method: "GET",
            query: { url: u.toString() },
          });
          const streams = (upstream.formats ?? []).slice(0, 60).map((f, i) => ({
            id: f.format_id ?? String(i),
            kind: f.vcodec && f.vcodec !== "none" ? ("video" as const) : ("audio" as const),
            container: (f.ext ?? "mp4").toLowerCase(),
            resolution: f.resolution ?? f.quality,
            bitrate: f.abr ? `${f.abr}kbps` : f.vbr ? `${f.vbr}kbps` : undefined,
            fileSize: f.filesize ? formatBytes(f.filesize) : undefined,
          }));
          return {
            url: u.toString(),
            data: {
              title: upstream.title ?? "Untitled",
              thumbnail: upstream.thumbnail,
              previewUrl: upstream.preview,
              streams,
            },
          };
        }),
    },
  },
});

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
