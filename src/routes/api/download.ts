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
import { tryProviders, b64urlDecode } from "@/lib/providers.server";

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

          // Fast path: stream id is a base64url direct URL from /api/detect.
          // Validate and return without any upstream call — no buffering, no storage.
          const decoded = b64urlDecode(input.format_id);
          if (decoded) {
            const direct = validatePublicUrl(decoded);
            return {
              url: u.toString(),
              data: { download_url: direct.toString(), expires_at: null as string | null },
            };
          }

          const data = await tryProviders(
            (p) => p.download(u.toString(), input.format_id),
            "download",
            u.toString(),
          );
          return { url: u.toString(), data };
        }),
    },
  },
});
