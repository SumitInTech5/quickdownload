import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Cookie, Copy, ExternalLink, FileText, RefreshCw, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { PageShell, PageHeader } from "@/components/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, type BackendSettings, type YtdlpCookieStatus } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Downloader Settings — All Video Downloader" },
      { name: "description", content: "Configure YouTube cookies for yt-dlp and check whether the downloader backend is using them." },
      { property: "og:title", content: "Downloader Settings — All Video Downloader" },
      { property: "og:description", content: "Check YTDLP_COOKIES_FILE status and follow the Render setup flow for YouTube cookies." },
      { property: "og:url", content: "https://quickdownload.lovable.app/settings" },
    ],
    links: [
      { rel: "canonical", href: "https://quickdownload.lovable.app/settings" },
    ],
  }),
  component: SettingsPage,
});

function cookieBadge(cookies?: YtdlpCookieStatus | null) {
  if (!cookies) return { label: "Unknown", variant: "secondary" as const };
  if (cookies.available) return { label: "Active", variant: "default" as const };
  if (cookies.configured) return { label: "Configured, unavailable", variant: "destructive" as const };
  return { label: "Not configured", variant: "secondary" as const };
}

function isLikelyNetscapeCookies(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.includes("# Netscape HTTP Cookie File")) return true;
  return trimmed.split(/\r?\n/).some((line) => {
    if (!line || line.startsWith("#")) return false;
    return line.split("\t").length >= 7;
  });
}

function CodePill({ children }: { children: string }) {
  return (
    <code className="rounded-md border border-border bg-secondary px-2 py-1 text-xs font-semibold text-foreground">
      {children}
    </code>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState<BackendSettings | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState("/app/cookies.txt");
  const [cookieText, setCookieText] = useState("");

  const cookieCheck = useMemo(() => isLikelyNetscapeCookies(cookieText), [cookieText]);

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const res = await api.settings();
      setSettings(res);
      if (res.cookies.pathLabel) setPath(res.cookies.pathLabel);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadSettings(); }, []);

  async function readFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setCookieText(text.slice(0, 5000));
  }

  async function copyEnvValue() {
    await navigator.clipboard.writeText(`YTDLP_COOKIES_FILE=${path}`);
    toast.success("Copied YTDLP_COOKIES_FILE setting");
  }

  const badge = cookieBadge(settings?.cookies);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Settings"
        title="Downloader settings"
        description="Connect a cookies.txt file to yt-dlp so YouTube detection and conversion can use your authorized browser cookies when YouTube blocks cloud traffic."
      />

      <section className="container mx-auto grid gap-6 px-4 py-10 lg:grid-cols-[1fr_380px] lg:py-14">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Cookie className="size-5 text-primary" /> Current cookie status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Status unavailable</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-lg border border-border bg-secondary/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badge.variant}>{loading ? "Checking" : badge.label}</Badge>
                    {settings?.cookies.pathLabel && <Badge variant="secondary">{settings.cookies.pathLabel}</Badge>}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {loading ? "Checking the backend configuration." : settings?.cookies.message ?? "Cookie status is not available."}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void loadSettings()} disabled={loading}>
                  <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
                </Button>
                <Button asChild>
                  <Link to="/tool"><SettingsIcon className="size-4" /> Back to tool</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" /> Add or reference cookies.txt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert>
                <CheckCircle2 className="size-4" />
                <AlertTitle>Use a Netscape cookies.txt export</AlertTitle>
                <AlertDescription>
                  Export cookies from a browser session that can view YouTube, then make that file available inside the Render backend and point `YTDLP_COOKIES_FILE` to it.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="cookiePath">Backend file path</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input id="cookiePath" value={path} onChange={(e) => setPath(e.target.value)} />
                  <Button type="button" variant="outline" onClick={() => void copyEnvValue()}>
                    <Copy className="size-4" /> Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Set this as a Render environment variable after the file exists in the backend container.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cookieFile">Check a cookies.txt file locally</Label>
                <Input id="cookieFile" type="file" accept=".txt,text/plain" onChange={(e) => void readFile(e.target.files?.[0])} />
                {cookieText && (
                  <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                    <Badge variant={cookieCheck ? "default" : "destructive"}>{cookieCheck ? "Looks valid" : "Check format"}</Badge>
                    <p className="mt-2 text-xs text-muted-foreground">
                      This browser check does not upload the file. Add it to Render securely, then refresh this page after redeploying.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Render setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <ol className="space-y-3">
                <li className="flex gap-3"><span className="font-semibold text-foreground">1.</span><span>Create or upload a secure `cookies.txt` file for the Render service. Prefer Render secret files or a private deployment path; do not commit personal cookies to a public repository.</span></li>
                <li className="flex gap-3"><span className="font-semibold text-foreground">2.</span><span>Set <CodePill>YTDLP_COOKIES_FILE</CodePill> to the backend file path, commonly <CodePill>/app/cookies.txt</CodePill>.</span></li>
                <li className="flex gap-3"><span className="font-semibold text-foreground">3.</span><span>Redeploy the backend, then refresh this page. The badge should change to Active.</span></li>
              </ol>
              <Button asChild variant="outline" className="w-full">
                <a href="https://render.com/docs/configure-environment-variables" target="_blank" rel="noopener noreferrer">
                  Render environment docs <ExternalLink className="size-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversion timeout note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Long conversions can still outlast the app request window. Cookies help with YouTube bot checks, but large transcodes need a background job worker for guaranteed completion.</p>
              <p>For now, use Detect to download direct streams, or convert shorter media while the backend is already awake.</p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </PageShell>
  );
}