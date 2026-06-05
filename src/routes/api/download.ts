import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  copyrightFlag,
  corsResponse,
  formatIdInput,
  handle,
  urlInput,
  validatePublicUrl,
} from "@/lib/downloader.server";
import { resolveAny } from "@/lib/extractors.server";

const schema = z.object({
  url: urlInput,
  format_id: formatIdInput,
  copyright_confirmed: copyrightFlag,
});

export const Route = createFileRoute("/api/download")({
  server: {
    handlers: {
      OPTIONS: async () => corsResponse(),
      POST: async ({ request }) =>
        handle("download", request, async (body) => {
          const input = schema.parse(body);
          const u = validatePublicUrl(input.url);
          const link = await resolveAny(u, input.format_id);
          // Validate the resolved URL too (don't allow ssrf via a malicious id).
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
