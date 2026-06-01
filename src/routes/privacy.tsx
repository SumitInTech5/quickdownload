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
          We process the URL you submit only in memory to fulfil the request. We keep minimal anonymized
          logs (a one-way hash of the URL, route, timestamp, and status code) for diagnostics and abuse prevention.
        </Block>
        <Block title="How we use data">
          To proxy detection, download and conversion requests to our media provider, and to investigate
          copyright reports. We do not sell your personal data.
        </Block>
        <Block title="No media storage">
          We never store your downloaded media. Downloads and conversions return a direct, time-limited link
          from the upstream provider that your browser fetches directly — no media bytes are buffered or
          persisted on our servers, temporarily or permanently.
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
