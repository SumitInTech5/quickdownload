import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  bitrateInput,
  copyrightFlag,
  corsResponse,
  handle,
  sampleRateInput,
  targetFormatInput,
  urlInput,
  validatePublicUrl,
} from "@/lib/downloader.server";
import { tryProviders } from "@/lib/providers.server";

const schema = z.object({
  url: urlInput,
  target_format: targetFormatInput,
  bitrate: bitrateInput,
  sample_rate: sampleRateInput,
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
          const data = await tryProviders(
            (p) => p.convert(u.toString(), input.target_format, input.bitrate, input.sample_rate),
            "convert",
            u.toString(),
          );
          return { url: u.toString(), data };
        }),
    },
  },
});
