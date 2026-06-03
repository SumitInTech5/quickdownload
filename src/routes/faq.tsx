import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/PageShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — All Video Downloader" },
      { name: "description", content: "Answers about supported sites, quality, conversion, privacy and copyright." },
      { property: "og:title", content: "Frequently asked questions — All Video Downloader" },
      { property: "og:description", content: "Short, honest answers about supported sites, quality, conversion, privacy and copyright." },
      { property: "og:url", content: "https://quickdownload.lovable.app/faq" },
    ],
    links: [
      { rel: "canonical", href: "https://quickdownload.lovable.app/faq" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: FAQ,
});

const faqs = [
  { q: "Which sites are supported?", a: "The tool supports public web pages that expose direct media streams. Some sites with DRM or strict protections may not be supported." },
  { q: "Can I download YouTube or social media videos?", a: "You may download content only if you own the rights or have permission from the copyright holder. The site enforces a user confirmation and reserves the right to block downloads that violate terms." },
  { q: "Will downloads be original quality?", a: "The site lists available source qualities and lets you download the highest available stream. If the source provides multiple bitrates, you can choose the original stream." },
  { q: "Is conversion safe and lossless?", a: "Conversions use FFmpeg. Audio extraction preserves the best available bitrate; transcoding may re-encode depending on chosen settings." },
  { q: "What about privacy?", a: "We do not sell personal data. We retain only the minimum information needed to operate the service. See the Privacy Policy for details." },
  { q: "How do I report copyright infringement?", a: "Use the takedown form on the Help & Support page. Provide the URL and a brief reason; we respond promptly and may suspend repeat infringers." },
  { q: "Are there limits to how much I can download?", a: "Yes. Per-IP and per-account rate limits keep the service fast and abuse-free. If you hit a limit, wait a moment and try again." },
];

function FAQ() {
  return (
    <PageShell>
      <PageHeader eyebrow="Help" title="Frequently asked questions" description="Short, honest answers about what the service does — and doesn't — do." />
      <section className="container mx-auto max-w-3xl px-4 py-12">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </PageShell>
  );
}
