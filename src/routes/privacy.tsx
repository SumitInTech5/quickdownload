import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/PageShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — All Video Downloader" },
      { name: "description", content: "How All Video Downloader collects, uses, and retains data." },
      { property: "og:title", content: "Privacy Policy" },
      { property: "og:description", content: "How All Video Downloader collects, uses, and retains data." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <PageShell>
      <PageHeader eyebrow="Legal" title="Privacy Policy" description="Effective date: [Insert date]" />
      <article className="container mx-auto max-w-3xl space-y-8 px-4 py-12">
        <Block title="Data we collect">
          We collect only what's needed to operate the service: the URL you submit, technical job metadata
          (timestamps, status, errors), and the IP address making the request.
        </Block>
        <Block title="How we use data">
          To process your downloads and conversions, enforce rate limits, prevent abuse, and investigate
          copyright reports. We do not sell your personal data.
        </Block>
        <Block title="Retention">
          Output files are stored temporarily and auto-purged shortly after delivery. Job metadata is
          retained briefly for support and abuse-prevention purposes, then deleted.
        </Block>
        <Block title="Cookies">
          We use only the cookies necessary for session management and security. No third-party advertising trackers.
        </Block>
        <Block title="Your rights">
          You may request access to, correction of, or deletion of personal data we hold about you via the
          in-app AI assistant on the Help page.
        </Block>
        <Block title="Changes">
          We may update this Policy from time to time and will post changes on this page.
        </Block>

      </article>
    </PageShell>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </section>
  );
}
