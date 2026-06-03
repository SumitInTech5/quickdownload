// Server-only helpers for the media downloader proxy.
// No media bytes are ever buffered or stored here — we only return upstream JSON.

import { z } from "zod";

const PRIVATE_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
]);

export const urlInput = z.string().trim().min(1).max(2048).url();
export const formatIdInput = z.string().trim().min(1).max(4096).regex(/^[a-zA-Z0-9._\-=]+$/);
export const targetFormatInput = z.enum(["mp3", "aac", "wav", "mp4", "m4a", "ogg"]);
export const bitrateInput = z.enum(["64k", "128k", "192k", "256k", "320k"]).optional();
export const sampleRateInput = z.enum(["22050", "44100", "48000"]).optional();
export const copyrightFlag = z.literal(true, {
  errorMap: () => ({ message: "Copyright confirmation is required." }),
});

export function validatePublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw httpError(400, "Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw httpError(400, "Only http(s) URLs are allowed");
  }
  const host = u.hostname.toLowerCase();
  if (!host) throw httpError(400, "URL missing host");
  if (PRIVATE_HOSTNAMES.has(host)) throw httpError(400, "Private hosts are not allowed");
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) {
    throw httpError(400, "Private hosts are not allowed");
  }
  // Reject IPv4 literals in private ranges and any IPv6 literal.
  if (host.startsWith("[") || host.includes(":")) {
    throw httpError(400, "IP literals are not allowed");
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    ) {
      throw httpError(400, "Private/reserved IPs are not allowed");
    }
    throw httpError(400, "IP literals are not allowed");
  }

  const allow = (process.env.ALLOWED_HOSTS ?? "").trim();
  if (allow) {
    const list = allow.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const ok = list.some((h) => host === h || host.endsWith(`.${h}`));
    if (!ok) throw httpError(400, "Host is not on the allow-list");
  }
  return u;
}

export class HttpError extends Error {
  status: number;
  upstreamStatus?: number;
  constructor(status: number, message: string, upstreamStatus?: number) {
    super(message);
    this.status = status;
    this.upstreamStatus = upstreamStatus;
  }
}

export function httpError(status: number, message: string, upstreamStatus?: number) {
  return new HttpError(status, message, upstreamStatus);
}

export async function hashUrl(raw: string): Promise<string> {
  const buf = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < 12; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

export async function logEvent(event: {
  route: string;
  url: string;
  status: number;
  upstreamStatus?: number;
  message?: string;
}) {
  const hashed = await hashUrl(event.url).catch(() => "n/a");
  // Minimal log; no raw URL, no IP, no UA, no media.
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      r: event.route,
      url_h: hashed,
      s: event.status,
      us: event.upstreamStatus,
      m: event.message,
    }),
  );
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

export function corsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}


export async function handle(
  route: string,
  request: Request,
  fn: (body: unknown) => Promise<{ data: unknown; url: string }>,
): Promise<Response> {
  let parsedUrlForLog = "";
  try {
    if (request.method === "OPTIONS") return corsResponse();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") throw httpError(400, "Invalid JSON body");
    const result = await fn(body);
    parsedUrlForLog = result.url;
    await logEvent({ route, url: parsedUrlForLog, status: 200 });
    return jsonResponse(result.data, 200);
  } catch (err) {
    const isHttp = err instanceof HttpError;
    const status = isHttp ? err.status : 500;
    const message = isHttp ? err.message : "Internal error";
    await logEvent({ route, url: parsedUrlForLog, status, message });
    return jsonResponse({ error: message }, status);
  }
}
