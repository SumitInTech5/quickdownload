import { createFileRoute } from "@tanstack/react-router";
import { forwardToBackend } from "@/lib/backend-proxy.server";

export const Route = createFileRoute("/api/proxy/convert")({
  server: {
    handlers: {
      POST: async ({ request }) => forwardToBackend("/api/convert/", request),
    },
  },
});
