import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/PageShell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — All Video Downloader" },
      { name: "description", content: "The terms that govern your use of All Video Downloader, including acceptable use, copyright, liability, and rate limits." },
      { property: "og:title", content: "Terms of Service — All Video Downloader" },
      { property: "og:description", content: "Acceptable use, copyright compliance, liability and rate limits — the terms governing your use of the service." },
      { property: "og:url", content: "https://quickdownload.lovable.app/terms" },
    ],
    links: [
      { rel: "canonical", href: "https://quickdownload.lovable.app/terms" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <PageShell>
      <PageHeader eyebrow="Legal" title="Terms of Service" description="Effective date: [Insert date]" />
      <article className="container mx-auto max-w-3xl space-y-8 px-4 py-12 prose-headings:font-display">
        <Section n="1" title="Acceptance">
          By using All Video Downloader you agree to these Terms of Service. If you do not agree, do not use the service.
        </Section>
        <Section n="2" title="Acceptable Use">
          You must only download or convert content you own or have explicit permission to use. You must not use the service to
          infringe copyrights, bypass DRM, or violate any third-party terms. We do not provide and will not assist with circumventing
          platform protections.
        </Section>
        <Section n="3" title="User Representations">
          You represent and warrant that you have the legal right to download or convert any content you submit and that your use
          complies with all applicable laws. Each request requires you to actively confirm copyright compliance; submissions without
          this confirmation are rejected by the service.
        </Section>
        <Section n="4" title="Copyright and Takedown">
          We respect copyright. If a rights holder submits a valid takedown request, we will remove the content and may suspend
          accounts that repeatedly violate rights. Reports may be submitted on the Help & Support page.
        </Section>
        <Section n="5" title="Liability">
          The service is provided "as is" and "as available." We make no warranties, express or implied. We are not liable for user
          misuse, copyright infringement, or third-party claims arising from your use of the service.
        </Section>
        <Section n="6" title="Privacy">
          We collect minimal data necessary to operate the service. See the Privacy Policy for details on what we collect and how we
          use it.
        </Section>
        <Section n="7" title="Rate Limits and Abuse">
          We enforce per-IP and per-account rate limits and may temporarily or permanently suspend access for abusive behavior,
          repeated infringement, or attempts to bypass protections.
        </Section>
        <Section n="8" title="Governing Law">
          Governed by the Laws.
        </Section>
        <Section n="9" title="Changes">
          We may update these Terms from time to time. We will post changes on this page. Continued use after changes
          constitutes acceptance.
        </Section>

      </article>
    </PageShell>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold">
        <span className="text-primary">{n}.</span> {title}
      </h2>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </section>
  );
}
