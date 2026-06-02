import { createFileRoute } from "@tanstack/react-router";
import { corsResponse, jsonResponse } from "@/lib/downloader.server";
import { getHealth } from "@/lib/providers.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      OPTIONS: async () => corsResponse(),
      GET: async ({ request }) => {
        const force = new URL(request.url).searchParams.get("force") === "1";
        const payload = await getHealth(force);
        return jsonResponse(payload, 200);
      },
    },
  },
});
