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
  data?: { url?: string; download_url?: string; link?: string; expires_at?: string };
}

function b64urlDecode(s: string): string | null {
  try {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const decoded = atob(padded + pad);
    if (!/^https?:\/\//i.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/download")({
  server: {
    handlers: {
      OPTIONS: async () => corsResponse(),
      POST: async ({ request }) =>
        handle("download", request, async (body) => {
          const input = schema.parse(body);
          const u = validatePublicUrl(input.url);

          // Preferred path: the format_id is a base64url-encoded direct upstream
          // URL from /api/detect. Validate it's public and return it directly
          // — no second upstream call, no buffering, no storage.
          const decoded = b64urlDecode(input.format_id);
          if (decoded) {
            const direct = validatePublicUrl(decoded);
            return {
              url: u.toString(),
              data: { download_url: direct.toString(), expires_at: null },
            };
          }

          // Fallback: ask upstream to resolve the format id.
          const upstream = await callRapidApi<UpstreamDownload>("/v2/video/download", {
            method: "GET",
            query: { url: u.toString(), format: input.format_id },
          });
          const root = upstream.data ?? upstream;
          const link = root.url ?? root.download_url ?? root.link;
          if (!link) throw new Error("Upstream returned no download link");
          return {
            url: u.toString(),
            data: { download_url: link, expires_at: root.expires_at ?? null },
          };
        }),
    },
  },
});
