import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/PageShell";
import { AiHelpChat } from "@/components/AiHelpChat";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help — All Video Downloader" },
      { name: "description", content: "Chat with our AI assistant for help." },
      { property: "og:title", content: "Help" },
      { property: "og:description", content: "Chat with our AI assistant for help." },
    ],
  }),
  component: Help,
});

function Help() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Support"
        title="AI Assistance"
        description="Ask our AI assistant anything about downloading, converting, or using the tool."
      />
      <section className="container mx-auto px-4 py-10">
        <AiHelpChat />
      </section>
    </PageShell>
  );
}
