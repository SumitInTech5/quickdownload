import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/PageShell";
import { AiHelpChat } from "@/components/AiHelpChat";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & Support — All Video Downloader" },
      { name: "description", content: "Chat with our AI assistant for help with downloading, format conversion, troubleshooting, copyright questions, and privacy concerns." },
      { property: "og:title", content: "Help & Support — All Video Downloader" },
      { property: "og:description", content: "Get instant answers from our AI assistant on downloads, conversion, copyright, and privacy." },
      { property: "og:url", content: "https://quickdownload.lovable.app/help" },
    ],
    links: [
      { rel: "canonical", href: "https://quickdownload.lovable.app/help" },
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
