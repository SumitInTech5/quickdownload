import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  bitrateInput,
  callRapidApi,
  copyrightFlag,
  corsResponse,
  handle,
  sampleRateInput,
  targetFormatInput,
  urlInput,
  validatePublicUrl,
} from "@/lib/downloader.server";

const schema = z.object({
  url: urlInput,
  target_format: targetFormatInput,
  bitrate: bitrateInput,
  sample_rate: sampleRateInput,
  copyright_confirmed: copyrightFlag,
});

interface UpstreamConvert {
  url?: string;
  download_url?: string;
  link?: string;
  expires_at?: string;
}

export const Route = createFileRoute("/api/convert")({
  server: {
    handlers: {
      OPTIONS: async () => corsResponse(),
      POST: async ({ request }) =>
        handle("convert", request, async (body) => {
          const input = schema.parse(body);
          const u = validatePublicUrl(input.url);
          const query: Record<string, string> = {
            url: u.toString(),
            format: input.target_format,
          };
          if (input.bitrate) query.bitrate = input.bitrate;
          if (input.sample_rate) query.sample_rate = input.sample_rate;
          const upstream = await callRapidApi<UpstreamConvert>("/v2/convert", {
            method: "GET",
            query,
          });
          const link = upstream.url ?? upstream.download_url ?? upstream.link;
          if (!link) throw new Error("Upstream returned no download link");
          return {
            url: u.toString(),
            data: {
              download_url: link,
              expires_at: upstream.expires_at ?? null,
            },
          };
        }),
    },
  },
});
