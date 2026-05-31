import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Headphones, Mail, Phone, MessageSquareWarning, Loader2 } from "lucide-react";
import { PageShell, PageHeader } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api, isBackendConfigured } from "@/lib/api";
import { AiHelpChat } from "@/components/AiHelpChat";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & Helpline — All Video Downloader" },
      { name: "description", content: "Talk to support, report a problem, or submit a copyright takedown request." },
      { property: "og:title", content: "Help & Helpline" },
      { property: "og:description", content: "Real humans, job IDs logged. We respond to abuse reports promptly." },
    ],
  }),
  component: Help,
});

const reportSchema = z.object({
  url: z.string().url("Enter a valid URL").max(2048),
  reason: z.string().trim().min(10, "Please give a bit more detail").max(2000),
  contact: z.string().trim().email("Enter a valid email").max(255),
});

function Help() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Support"
        title="Help & Helpline"
        description="We log every job with an ID, so support can find what happened in seconds."
      />

      <section className="container mx-auto grid gap-6 px-4 py-12 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardContent className="p-6">
            <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Headphones className="size-6" aria-hidden />
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold">Helpline</h2>
            <p className="mt-1 text-sm text-muted-foreground">Mon–Fri, 9am–6pm (local time).</p>
            <a href="tel:+15550102040" className="mt-3 flex items-center gap-2 text-base font-medium text-foreground">
              <Phone className="size-4" aria-hidden /> +1 (555) 010-2040
            </a>
            <a href="mailto:support@allvideodownloader.example" className="mt-1 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Mail className="size-4" aria-hidden /> support@allvideodownloader.example
            </a>
            <p className="mt-4 text-xs text-muted-foreground">
              Have a job ID? Include it in your email so we can investigate immediately.
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareWarning className="size-5 text-accent-foreground" aria-hidden />
              Report content or request takedown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReportForm />
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto px-4 py-8">
        <AiHelpChat />
      </section>
    </PageShell>
  );
}

function ReportForm() {
  const [url, setUrl] = useState("");
  const [reason, setReason] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = reportSchema.safeParse({ url, reason, contact });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    if (!isBackendConfigured()) {
      toast.error("Backend not configured", { description: "Set VITE_API_BASE_URL to enable submissions." });
      return;
    }
    setLoading(true);
    try {
      await api.report(parsed.data);
      toast.success("Report submitted", { description: "We'll review and respond by email." });
      setUrl(""); setReason(""); setContact("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="r-url">URL of the content</Label>
        <Input id="r-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-reason">Reason for report</Label>
        <Textarea id="r-reason" rows={5} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={2000} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-contact">Your email</Label>
        <Input id="r-contact" type="email" value={contact} onChange={(e) => setContact(e.target.value)} required />
      </div>
      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="size-4 animate-spin" />}
        Submit report
      </Button>
    </form>
  );
}
