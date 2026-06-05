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
import { convertAny } from "@/lib/extractors.server";

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
          const link = await convertAny(u, input.target_format, input.bitrate);
          const direct = validatePublicUrl(link.download_url);
          return {
            url: u.toString(),
            data: {
              download_url: direct.toString(),
              expires_at: null as string | null,
              filename: link.filename,
            },
          };
        }),
    },
  },
});
