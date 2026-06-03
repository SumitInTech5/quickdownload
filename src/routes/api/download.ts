import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  copyrightFlag,
  corsResponse,
  handle,
  urlInput,
  validatePublicUrl,
} from "@/lib/downloader.server";
import { cobaltResolve, PRESETS, type PresetId } from "@/lib/cobalt.server";

const presetIds = PRESETS.map((p) => p.id) as [PresetId, ...PresetId[]];

const schema = z.object({
  url: urlInput,
  format_id: z.enum(presetIds),
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
          const link = await cobaltResolve(u.toString(), input.format_id);
          return {
            url: u.toString(),
            data: { download_url: link.download_url, expires_at: null as string | null },
          };
        }),
    },
  },
});
