import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  callRapidApi,
  copyrightFlag,
  corsResponse,
  formatIdInput,
  handle,
  urlInput,
  validatePublicUrl,
} from "@/lib/downloader.server";

const schema = z.object({
  url: urlInput,
  format_id: formatIdInput,
  copyright_confirmed: copyrightFlag,
});

interface UpstreamDownload {
  url?: string;
  download_url?: string;
  link?: string;
  expires_at?: string;
  expires?: number;
}

export const Route = createFileRoute("/api/download")({
  server: {
    handlers: {
      OPTIONS: async () => corsResponse(),
      POST: async ({ request }) =>
        handle("download", request, async (body) => {
          const input = schema.parse(body);
          const u = validatePublicUrl(input.url);
          const upstream = await callRapidApi<UpstreamDownload>("/v2/download", {
            method: "GET",
            query: { url: u.toString(), format: input.format_id },
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
