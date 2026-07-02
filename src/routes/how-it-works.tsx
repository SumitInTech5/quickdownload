import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, ListChecks, Download, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — All Video Downloader" },
      { name: "description", content: "Three simple steps: paste a URL, pick a stream, download or convert with full control and copyright compliance." },
      { property: "og:title", content: "How it works — All Video Downloader" },
      { property: "og:description", content: "Three steps from URL to file: paste, pick a stream, download or convert." },
      { property: "og:url", content: "https://quickdownload.lovable.app/how-it-works" },
    ],
    links: [
      { rel: "canonical", href: "https://quickdownload.lovable.app/how-it-works" },
    ],
  }),
  component: HowItWorks,
});

const steps = [
  { icon: Link2, title: "Paste a public URL", desc: "Drop any link from a public web page. We never touch DRM-protected content or bypass platform protections." },
  { icon: ListChecks, title: "Pick a stream or format", desc: "We list every available resolution, bitrate, and container with file size up front so you choose with eyes open." },
  { icon: Download, title: "Download or convert", desc: "Pull the original file, or transcode to MP3, AAC, WAV, or MP4 with bitrate and sample-rate control." },
];

function HowItWorks() {
  return (
    <PageShell>
      <PageHeader eyebrow="Process" title="How it works" description="Three steps. Full transparency at every stage." />
      <section className="container mx-auto grid gap-6 px-4 py-12 md:grid-cols-3 md:py-16">
        {steps.map((s, i) => (
          <Card key={s.title}>
            <CardContent className="p-7">
              <div className="font-display text-3xl font-bold text-primary">{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-4 grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="size-5" aria-hidden />
              </div>
              <h2 className="mt-4 font-display text-xl font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="container mx-auto px-4 pb-16">
        <div className="rounded-2xl border border-border bg-secondary/40 p-8 md:p-12">
          <h2 className="font-display text-2xl font-bold">What happens behind the scenes</h2>
          <ul className="mt-5 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <li className="rounded-lg border border-border bg-card p-4"><strong className="block text-foreground">Isolated workers.</strong> Each job runs in a sandboxed container with strict resource limits.</li>
            <li className="rounded-lg border border-border bg-card p-4"><strong className="block text-foreground">FFmpeg-powered.</strong> Audio extraction preserves the best available bitrate; transcoding only re-encodes when you ask.</li>
            <li className="rounded-lg border border-border bg-card p-4"><strong className="block text-foreground">No retained media.</strong> Detect and direct-download jobs do not store user media; conversions use temporary backend files only for immediate delivery.</li>
            <li className="rounded-lg border border-border bg-card p-4"><strong className="block text-foreground">Rate-limited.</strong> Per-IP and per-account quotas keep the service fast and prevent abuse.</li>
          </ul>
          <Button asChild className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/tool">Try the tool <ArrowRight className="size-4" /></Link>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
