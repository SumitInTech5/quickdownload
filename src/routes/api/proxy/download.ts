import { createFileRoute } from "@tanstack/react-router";
import { forwardToBackend } from "@/lib/backend-proxy.server";

export const Route = createFileRoute("/api/proxy/download")({
  server: {
    handlers: {
      POST: async ({ request }) => forwardToBackend("/api/download/", request),
    },
  },
});
