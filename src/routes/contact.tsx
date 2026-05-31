import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { PageShell, PageHeader } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — All Video Downloader" },
      { name: "description", content: "Send a message to the All Video Downloader team." },
      { property: "og:title", content: "Contact" },
      { property: "og:description", content: "Send a message to the All Video Downloader team." },
    ],
  }),
  component: Contact,
});

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(100),
  message: z.string().trim().min(10, "Please give a bit more detail").max(2000),
});

function Contact() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Contact"
        title="Send us a message"
        description="For quick answers, try the AI assistant on the Help page."
      />
      <section className="container mx-auto max-w-2xl px-4 py-12">
        <Card>
          <CardContent className="p-6">
            <p className="mb-6 text-sm text-muted-foreground">
              Need help right away? Use our{" "}
              <Link to="/help" className="underline hover:text-foreground">AI assistant</Link>.
            </p>
            <ContactForm />
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}

function ContactForm() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ name, message });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    toast.success("Message received", { description: "Thanks for reaching out." });
    setName(""); setMessage("");
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="c-name">Name</Label>
        <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-msg">Message</Label>
        <Textarea id="c-msg" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={2000} />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Send message
      </Button>
    </form>
  );
}
