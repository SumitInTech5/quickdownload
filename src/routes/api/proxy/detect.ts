import { createFileRoute } from "@tanstack/react-router";
import { forwardToBackend } from "@/lib/backend-proxy.server";

export const Route = createFileRoute("/api/proxy/detect")({
  server: {
    handlers: {
      POST: async ({ request }) => forwardToBackend("/api/detect/", request),
    },
  },
});
