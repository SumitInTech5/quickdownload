import { createFileRoute } from "@tanstack/react-router";
import { checkBackendSettings } from "@/lib/backend-proxy.server";

export const Route = createFileRoute("/api/proxy/settings")({
  server: {
    handlers: {
      GET: async () => checkBackendSettings(),
    },
  },
});