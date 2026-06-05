import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  copyrightFlag,
  corsResponse,
  handle,
  urlInput,
  validatePublicUrl,
} from "@/lib/downloader.server";
import { detectAny } from "@/lib/extractors.server";

const schema = z.object({
  url: urlInput,
  copyright_confirmed: copyrightFlag,
});

export const Route = createFileRoute("/api/detect")({
  server: {
    handlers: {
      OPTIONS: async () => corsResponse(),
      POST: async ({ request }) =>
        handle("detect", request, async (body) => {
          const input = schema.parse(body);
          const u = validatePublicUrl(input.url);
          const result = await detectAny(u);
          return {
            url: u.toString(),
            data: {
              title: result.title,
              thumbnail: result.thumbnail,
              previewUrl: result.previewUrl,
              streams: result.streams,
              source: result.source,
            },
          };
        }),
    },
  },
});
