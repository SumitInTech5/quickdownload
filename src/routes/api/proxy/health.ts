import { createFileRoute } from "@tanstack/react-router";
import { checkBackendHealth } from "@/lib/backend-proxy.server";

export const Route = createFileRoute("/api/proxy/health")({
  server: {
    handlers: {
      GET: async () => checkBackendHealth(),
    },
  },
});