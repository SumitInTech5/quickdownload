import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, Phone, Send, Loader2 } from "lucide-react";
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
      { name: "description", content: "Get in touch with the All Video Downloader team." },
      { property: "og:title", content: "Contact" },
      { property: "og:description", content: "Get in touch with the All Video Downloader team." },
    ],
  }),
  component: Contact,
});

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  message: z.string().trim().min(10, "Please give a bit more detail").max(2000),
});

function Contact() {
  return (
    <PageShell>
      <PageHeader eyebrow="Contact" title="Get in touch" description="We read every message and reply within one business day." />
      <section className="container mx-auto grid gap-6 px-4 py-12 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardContent className="space-y-3 p-6 text-sm">
            <a href="mailto:hello@allvideodownloader.example" className="flex items-center gap-2 font-medium">
              <Mail className="size-4 text-primary" aria-hidden /> hello@allvideodownloader.example
            </a>
            <a href="tel:+15550102040" className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4 text-primary" aria-hidden /> +1 (555) 010-2040
            </a>
            <p className="pt-3 text-muted-foreground">
              For copyright matters, please use the takedown form on the{" "}
              <a className="underline hover:text-foreground" href="/help">Help</a> page.
            </p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardContent className="p-6">
            <ContactForm />
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}

function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ name, email, message });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
    setLoading(true);
    // No contact backend wired; integrate with your provider of choice.
    await new Promise((r) => setTimeout(r, 600));
    toast.success("Message sent", { description: "We'll be in touch soon." });
    setName(""); setEmail(""); setMessage("");
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="c-name">Name</Label>
          <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
        </div>
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
