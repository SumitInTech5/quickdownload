import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Shuffle, ShieldCheck, Zap, ListChecks, Eye, Headphones, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "All Video Downloader — Download & convert video and audio" },
      {
        name: "description",
        content:
          "Paste any public URL to download original-quality video or extract audio. Batch downloads, MP4↔MP3 conversion, in-browser preview.",
      },
      { property: "og:title", content: "All Video Downloader" },
      { property: "og:description", content: "Download and convert media from public web pages, responsibly." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Download, title: "Original-quality download", desc: "We list every available stream with size and bitrate so you pick the source you want." },
  { icon: Shuffle, title: "Format conversion", desc: "MP4 → MP3, AAC, WAV and MP3 → MP4 (with cover art). Choose bitrate and sample rate." },
  { icon: ListChecks, title: "Batch queue", desc: "Add multiple URLs; we process them sequentially with progress and resume." },
  { icon: Eye, title: "Safe preview", desc: "Play a short preview of detected media before you commit to a download." },
  { icon: ShieldCheck, title: "Copyright-first", desc: "Every download requires confirmation. We honor takedowns and never circumvent DRM." },
  { icon: Zap, title: "Fast & private", desc: "Workers process jobs in isolation. Files are auto-purged shortly after delivery." },
];

function Index() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/60 to-background">
        <div className="container mx-auto grid items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden />
              Copyright-aware. Privacy-first.
            </div>
            <h1 className="font-display text-4xl font-bold leading-[1.1] md:text-6xl">
              Download and convert media
              <span className="block text-primary">from any public URL.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Paste a link, pick the quality, get the file. All Video Downloader detects every
              available stream and converts between video and audio formats — responsibly and
              without DRM circumvention.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/tool">
                  <Download className="size-5" />
                  Start downloading
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/how-it-works">
                  How it works
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              By using the service you agree to our{" "}
              <Link to="/terms" className="underline hover:text-foreground">Terms</Link>.
            </p>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-3xl bg-primary/10 blur-3xl" aria-hidden />
            <img
              src={heroImg}
              alt="Illustration of media cards, play buttons and download arrows"
              width={1536}
              height={1024}
              className="relative rounded-2xl border border-border shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Features</div>
          <h2 className="font-display text-3xl font-bold md:text-4xl">Built for clarity and control</h2>
          <p className="mt-3 text-muted-foreground">
            Every option you need — and nothing you shouldn't have.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="border-border">
              <CardContent className="p-6">
                <div className="mb-4 grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="size-5" aria-hidden />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works teaser */}
      <section className="border-y border-border bg-secondary/40">
        <div className="container mx-auto grid gap-8 px-4 py-16 md:grid-cols-3 md:py-20">
          {[
            { n: "01", t: "Paste a URL", d: "Drop in any public page link — articles, social posts, video pages." },
            { n: "02", t: "Pick a stream", d: "We list every available quality with size and format up front." },
            { n: "03", t: "Download or convert", d: "Get the original file or transcode to MP3, AAC, WAV, MP4." },
          ].map((s) => (
            <div key={s.n} className="rounded-xl border border-border bg-card p-6">
              <div className="font-display text-3xl font-bold text-primary">{s.n}</div>
              <h3 className="mt-2 font-display text-lg font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Helpline CTA */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid items-center gap-8 rounded-2xl border border-border bg-card p-8 md:grid-cols-[auto_1fr_auto] md:p-10">
          <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Headphones className="size-8" aria-hidden />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold">Need a hand? Our helpline is open.</h2>
            <p className="mt-1 text-muted-foreground">
              Real support, every job ID logged. We respond to takedowns and abuse reports promptly.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/help">
              Get help
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
