import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  bitrateInput,
  copyrightFlag,
  corsResponse,
  handle,
  targetFormatInput,
  urlInput,
  validatePublicUrl,
} from "@/lib/downloader.server";
import { cobaltConvertAudio, cobaltResolve } from "@/lib/cobalt.server";

const schema = z.object({
  url: urlInput,
  target_format: targetFormatInput,
  bitrate: bitrateInput,
  copyright_confirmed: copyrightFlag,
});

export const Route = createFileRoute("/api/convert")({
  server: {
    handlers: {
      OPTIONS: async () => corsResponse(),
      POST: async ({ request }) =>
        handle("convert", request, async (body) => {
          const input = schema.parse(body);
          const u = validatePublicUrl(input.url);
          const fmt = input.target_format;
          let link;
          if (fmt === "mp4") {
            link = await cobaltResolve(u.toString(), "video-best");
          } else {
            link = await cobaltConvertAudio(u.toString(), fmt as "mp3" | "aac" | "wav" | "ogg" | "m4a", input.bitrate);
          }
          return {
            url: u.toString(),
            data: { download_url: link.download_url, expires_at: null as string | null },
          };
        }),
    },
  },
});
