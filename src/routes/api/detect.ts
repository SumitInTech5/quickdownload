import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  copyrightFlag,
  corsResponse,
  handle,
  urlInput,
  validatePublicUrl,
} from "@/lib/downloader.server";
import { PRESETS } from "@/lib/cobalt.server";

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
          // Cobalt doesn't expose a metadata index — we present a stable set of
          // quality/format presets that work across every supported source.
          const streams = PRESETS.map((p) => ({
            id: p.id,
            kind: p.kind,
            container: p.container,
            resolution: p.resolution,
            bitrate: p.bitrate,
          }));
          let title = u.hostname.replace(/^www\./, "");
          try {
            const seg = u.pathname.split("/").filter(Boolean).pop();
            if (seg) title = `${title} — ${decodeURIComponent(seg).slice(0, 80)}`;
          } catch { /* */ }
          return {
            url: u.toString(),
            data: { title, streams },
          };
        }),
    },
  },
});
