import { createLovableAiGatewayProvider, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type ChatRequestBody = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Basic anti-abuse: only allow requests initiated by our own site.
        // Blocks anonymous cross-origin scripts and most automated clients
        // from burning AI credits, without requiring a full auth layer.
        const origin = request.headers.get("origin");
        const referer = request.headers.get("referer");
        const host = request.headers.get("host") ?? "";
        const sameOrigin = (value: string | null) => {
          if (!value) return false;
          try {
            return new URL(value).host === host;
          } catch {
            return false;
          }
        };
        if (!sameOrigin(origin) && !sameOrigin(referer)) {
          return new Response("Forbidden", { status: 403 });
        }

        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(key, initialRunId);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system:
            "You are the All Video Downloader support assistant. You help users with questions about downloading and converting video/audio files, using the tool, troubleshooting, copyright compliance, and privacy. Be concise, friendly, and accurate. You do not provide instructions for bypassing DRM or platform protections. If asked about backend configuration, direct users to the API contract documentation.",
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        const response = result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });

        return withLovableAiGatewayRunIdHeader(response, gateway);
      },
    },
  },
});
