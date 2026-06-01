import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Download, Shuffle, Loader2, Link2, Trash2, Plus, Check, FileAudio, FileVideo } from "lucide-react";
import { PageShell, PageHeader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type DetectResponse, type MediaStream } from "@/lib/api";

export const Route = createFileRoute("/tool")({
  head: () => ({
    meta: [
      { title: "Convert & Download — All Video Downloader" },
      { name: "description", content: "Paste a URL, detect available streams, and download or convert in your preferred format." },
      { property: "og:title", content: "Convert & Download" },
      { property: "og:description", content: "Detect media, pick quality, download or convert MP4↔MP3 with bitrate control." },
    ],
  }),
  component: ToolPage,
});

const urlSchema = z.string().url("Please enter a valid URL").max(2048);

interface QueueItem {
  id: string;
  url: string;
  status: "queued" | "processing" | "done" | "error";
  error?: string;
  downloadUrl?: string;
}

function triggerBrowserDownload(url: string) {
  // Direct upstream link — bytes never transit our server.
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  a.target = "_blank";
  a.click();
}

function ToolPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Tool"
        title="Convert & Download"
        description="Paste a public page URL. We'll detect every available stream, then you choose what to download or convert."
      />
      <div className="container mx-auto px-4 py-10 md:py-14">
        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="single">Detect</TabsTrigger>
            <TabsTrigger value="convert">Convert</TabsTrigger>
            <TabsTrigger value="batch">Batch</TabsTrigger>
          </TabsList>
          <TabsContent value="single" className="mt-6">
            <DetectPanel />
          </TabsContent>
          <TabsContent value="convert" className="mt-6">
            <ConvertPanel />
          </TabsContent>
          <TabsContent value="batch" className="mt-6">
            <BatchPanel />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}

// ---------- DETECT ----------
function DetectPanel() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DetectResponse | null>(null);
  const [picked, setPicked] = useState<MediaStream | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function onDetect(e: React.FormEvent) {
    e.preventDefault();
    const parsed = urlSchema.safeParse(url);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid URL");
      return;
    }
    setLoading(true);
    setData(null);
    setPicked(null);
    try {
      const res = await api.detect(parsed.data);
      setData(res);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detect available media</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={onDetect} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="url" className="sr-only">Public page URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pl-9"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="sm:w-40">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {loading ? "Detecting…" : "Detect"}
          </Button>
        </form>

        {data && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-secondary/40 p-4">
              {data.thumbnail && (
                <img src={data.thumbnail} alt="" className="h-20 w-32 rounded object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{data.title}</div>
                {data.previewUrl && (
                  <video src={data.previewUrl} controls className="mt-2 max-h-40 rounded" />
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-semibold">Available streams</h3>
              <div className="grid gap-2">
                {data.streams.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setPicked(s); setConfirmOpen(true); }}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-secondary"
                  >
                    <div className="flex items-center gap-3">
                      {s.kind === "video" ? <FileVideo className="size-5 text-primary" aria-hidden /> : <FileAudio className="size-5 text-primary" aria-hidden />}
                      <div>
                        <div className="font-medium">
                          {s.kind === "video" ? s.resolution || "Video" : "Audio"} · {s.container.toUpperCase()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[s.bitrate, s.fileSize].filter(Boolean).join(" · ") || "Source quality"}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary">Select</Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <CopyrightDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          actionLabel="Start download"
          onConfirm={async () => {
            if (!picked || !url) return;
            try {
              const { download_url } = await api.download(url, picked.id);
              setConfirmOpen(false);
              triggerBrowserDownload(download_url);
              toast.success("Download started in a new tab");
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        />
      </CardContent>
    </Card>
  );
}

// ---------- CONVERT ----------
function ConvertPanel() {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("mp3");
  const [bitrate, setBitrate] = useState("192k");
  const [sampleRate, setSampleRate] = useState("44100");
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convert between formats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="source">Source URL or file URL</Label>
            <Input id="source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://…/video.mp4" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target">Target format</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="target"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mp3">MP3 (audio)</SelectItem>
                <SelectItem value="aac">AAC (audio)</SelectItem>
                <SelectItem value="wav">WAV (audio, lossless)</SelectItem>
                <SelectItem value="mp4">MP4 (video wrapper)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bitrate">Bitrate</Label>
            <Select value={bitrate} onValueChange={setBitrate}>
              <SelectTrigger id="bitrate"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="128k">128 kbps</SelectItem>
                <SelectItem value="192k">192 kbps</SelectItem>
                <SelectItem value="256k">256 kbps</SelectItem>
                <SelectItem value="320k">320 kbps</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate">Sample rate</Label>
            <Select value={sampleRate} onValueChange={setSampleRate}>
              <SelectTrigger id="rate"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="22050">22.05 kHz</SelectItem>
                <SelectItem value="44100">44.1 kHz</SelectItem>
                <SelectItem value="48000">48 kHz</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            const parsed = urlSchema.safeParse(source);
            if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid URL");
            setConfirmOpen(true);
          }}
        >
          <Shuffle className="size-4" />
          Convert
        </Button>

        <CopyrightDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          actionLabel="Start conversion"
          onConfirm={async () => {
            try {
              const { download_url } = await api.convert(source, target, bitrate, sampleRate);
              setConfirmOpen(false);
              triggerBrowserDownload(download_url);
              toast.success("Conversion ready — download started");
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        />
      </CardContent>
    </Card>
  );
}

// ---------- BATCH ----------
function BatchPanel() {
  const [input, setInput] = useState("");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function addUrl() {
    const parsed = urlSchema.safeParse(input.trim());
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid URL");
    if (items.length >= 25) return toast.error("Maximum 25 URLs per batch");
    setItems((it) => [...it, { id: crypto.randomUUID(), url: parsed.data, status: "queued" }]);
    setInput("");
  }

  function remove(id: string) {
    setItems((it) => it.filter((x) => x.id !== id));
  }

  async function startAll() {
    setConfirmOpen(false);
    for (const item of items) {
      if (item.status !== "queued") continue;
      setItems((curr) => curr.map((x) => x.id === item.id ? { ...x, status: "processing" } : x));
      try {
        const detected = await api.detect(item.url);
        const best = detected.streams[0];
        if (!best) throw new Error("No streams detected");
        const { download_url } = await api.download(item.url, best.id);
        triggerBrowserDownload(download_url);
        setItems((curr) => curr.map((x) => x.id === item.id ? { ...x, status: "done", downloadUrl: download_url } : x));
      } catch (err) {
        setItems((curr) => curr.map((x) => x.id === item.id ? { ...x, status: "error", error: (err as Error).message } : x));
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch downloads</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Label htmlFor="bulkUrl" className="sr-only">URL to add</Label>
          <Input
            id="bulkUrl"
            type="url"
            placeholder="Add a URL to the queue"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())}
          />
          <Button type="button" variant="outline" onClick={addUrl}>
            <Plus className="size-4" /> Add
          </Button>
        </div>

        {items.length > 0 && (
          <>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{it.url}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={it.status} />
                      {it.downloadUrl && (
                        <a href={it.downloadUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-primary underline">
                          <Check className="size-3" /> Open
                        </a>
                      )}
                    </div>
                    {it.error && <div className="mt-1 text-xs text-destructive">{it.error}</div>}
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => remove(it.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>

            <Button onClick={() => setConfirmOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Download className="size-4" />
              Start {items.filter((i) => i.status === "queued").length} downloads
            </Button>
          </>
        )}

        <CopyrightDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          actionLabel="Start batch"
          onConfirm={startAll}
        />
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: QueueItem["status"] }) {
  const map = {
    queued: { label: "Queued", variant: "secondary" as const },
    processing: { label: "Processing", variant: "default" as const },
    done: { label: "Done", variant: "default" as const },
    error: { label: "Error", variant: "destructive" as const },
  };
  return <Badge variant={map[status].variant} className="shrink-0 text-[10px]">{map[status].label}</Badge>;
}

function CopyrightDialog({
  open,
  onOpenChange,
  onConfirm,
  actionLabel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  actionLabel: string;
}) {
  const [checked, setChecked] = useState(false);
  useEffect(() => { if (!open) setChecked(false); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm copyright compliance</DialogTitle>
          <DialogDescription>
            All Video Downloader does not bypass DRM or other technical protection measures. You must
            only download content you own or have explicit permission to use.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} aria-label="I confirm" />
          <span>
            I confirm I own the rights or have permission from the rights holder to download or convert this content,
            and I agree to the <a href="/terms" className="underline">Terms of Service</a>.
          </span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!checked} onClick={onConfirm} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
