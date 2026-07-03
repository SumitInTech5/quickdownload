import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Copy, ExternalLink, KeyRound, Rocket, Server } from "lucide-react";
import { PageShell, PageHeader } from "@/components/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/deploy")({
  head: () => ({
    meta: [
      { title: "Deploy Backend — All Video Downloader" },
      { name: "description", content: "Step-by-step Render deployment checklist for connecting the Django yt-dlp backend to All Video Downloader." },
      { property: "og:title", content: "Deploy Backend — All Video Downloader" },
      { property: "og:description", content: "Deploy the Django yt-dlp backend on Render and connect it with secure project secrets." },
      { property: "og:url", content: "https://quickdownload.lovable.app/deploy" },
    ],
    links: [
      { rel: "canonical", href: "https://quickdownload.lovable.app/deploy" },
    ],
  }),
  component: DeployPage,
});

const renderVars = [
  { name: "DJANGO_DEBUG", value: "0", note: "Keeps Django in production mode." },
  { name: "DJANGO_SECRET_KEY", value: "Render generated value", note: "Render can generate this automatically from render.yaml." },
  { name: "API_KEY", value: "Render generated value", note: "Copy this exact value into Lovable as BACKEND_API_KEY." },
  { name: "ALLOWED_HOSTS", value: "your-service.onrender.com", note: "Use the host from your Render service URL." },
  { name: "CORS_ALLOWED_ORIGINS", value: "https://quickdownload.lovable.app", note: "Add preview URL too when testing from preview." },
  { name: "PUBLIC_BASE_URL", value: "https://your-service.onrender.com", note: "Full public URL of the Render service." },
  { name: "YTDLP_COOKIES_FILE", value: "/app/cookies.txt", note: "Optional. Enables yt-dlp cookies for YouTube bot checks when the file exists." },
];

const steps = [
  "Push this Lovable project to GitHub so Render can read the backend folder.",
  "Open Render, choose New +, then Blueprint, and select the GitHub repository.",
  "Render will read render.yaml and create the Docker service from backend/.",
  "After creation, update ALLOWED_HOSTS and PUBLIC_BASE_URL to match the real Render URL.",
  "Copy Render's API_KEY value into Lovable as BACKEND_API_KEY.",
  "Set BACKEND_URL in Lovable to the Render service URL, then publish/update the frontend.",
];

function CodePill({ children }: { children: string }) {
  return (
    <code className="rounded-md border border-border bg-secondary px-2 py-1 text-xs font-semibold text-foreground">
      {children}
    </code>
  );
}

function DeployPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Backend setup"
        title="Deploy the downloader backend"
        description="The website frontend is ready. The real downloader needs the included Django service running on Render so yt-dlp and ffmpeg can process public media URLs."
      />

      <section className="container mx-auto grid gap-6 px-4 py-10 lg:grid-cols-[1fr_380px] lg:py-14">
        <div className="space-y-6">
          <Alert>
            <Server className="size-4" />
            <AlertTitle>Why this step is required</AlertTitle>
            <AlertDescription>
              Python, yt-dlp, and ffmpeg cannot run inside the frontend hosting runtime. Render runs the included Docker backend and the app connects to it through secure server-side proxy routes.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Rocket className="size-5 text-primary" /> Render checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <span className="pt-0.5 text-sm text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
              <Button asChild className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
                <a href="https://render.com/docs/blueprint-spec" target="_blank" rel="noopener noreferrer">
                  Open Render Blueprint docs <ExternalLink className="size-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Render environment variables</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {renderVars.map((item) => (
                <div key={item.name} className="grid gap-2 rounded-lg border border-border bg-card p-4 md:grid-cols-[190px_1fr]">
                  <div className="min-w-0">
                    <CodePill>{item.name}</CodePill>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-foreground">{item.value}</div>
                    <div className="mt-1 text-muted-foreground">{item.note}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="size-5 text-primary" /> Lovable secrets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>After Render deploys, add these project runtime secrets:</p>
              <div className="space-y-2 rounded-lg border border-border bg-secondary/60 p-4">
                <div className="flex items-center gap-2"><Copy className="size-4" /><CodePill>BACKEND_URL</CodePill></div>
                <div>Use your Render URL, for example <span className="font-medium text-foreground">https://your-service.onrender.com</span>.</div>
              </div>
              <div className="space-y-2 rounded-lg border border-border bg-secondary/60 p-4">
                <div className="flex items-center gap-2"><Copy className="size-4" /><CodePill>BACKEND_API_KEY</CodePill></div>
                <div>Use the exact same value as Render's <span className="font-medium text-foreground">API_KEY</span>.</div>
              </div>
              <Alert>
                <CheckCircle2 className="size-4" />
                <AlertTitle>No VITE variables</AlertTitle>
                <AlertDescription>
                  Do not set VITE_BACKEND_URL or VITE_BACKEND_API_KEY. The browser never receives the backend key.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Final test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>Open the tool after the secrets are saved. The backend banner should say connected before running detection.</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">/api/proxy/health</Badge>
                <Badge variant="secondary">/api/proxy/detect</Badge>
                <Badge variant="secondary">/api/proxy/download</Badge>
                <Badge variant="secondary">/api/proxy/convert</Badge>
              </div>
              <Button asChild className="w-full">
                <Link to="/tool">Go to tool</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/settings">Check cookie settings</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </section>
    </PageShell>
  );
}