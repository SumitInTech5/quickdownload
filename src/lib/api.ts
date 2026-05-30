// Thin client for the BYO backend (yt-dlp + ffmpeg server you host).
// Configure VITE_API_BASE_URL to point at your backend.

export const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const isBackendConfigured = () => Boolean(API_BASE && API_BASE.length > 0);

export interface MediaStream {
  id: string;
  kind: "video" | "audio";
  container: string;
  resolution?: string;
  bitrate?: string;
  fileSize?: string;
}

export interface DetectResponse {
  title: string;
  thumbnail?: string;
  previewUrl?: string;
  streams: MediaStream[];
}

export interface JobStatus {
  status: "queued" | "processing" | "done" | "error";
  progress: number; // 0..100
  downloadUrl?: string;
  error?: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isBackendConfigured()) {
    throw new Error("Backend not configured. Set VITE_API_BASE_URL.");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment and try again.");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  detect: (url: string) =>
    call<DetectResponse>("/detect", { method: "POST", body: JSON.stringify({ url }) }),
  download: (url: string, streamId: string) =>
    call<{ job_id: string }>("/download", {
      method: "POST",
      body: JSON.stringify({ url, stream_id: streamId, confirmed: true }),
    }),
  convert: (source: string, target_format: string, bitrate?: string, sample_rate?: string) =>
    call<{ job_id: string }>("/convert", {
      method: "POST",
      body: JSON.stringify({ source, target_format, bitrate, sample_rate, confirmed: true }),
    }),
  job: (id: string) => call<JobStatus>(`/jobs/${encodeURIComponent(id)}`),
  report: (payload: { url: string; reason: string; contact: string }) =>
    call<{ ok: true }>("/report", { method: "POST", body: JSON.stringify(payload) }),
};
