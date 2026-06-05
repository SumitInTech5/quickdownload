"""
Tiny FastAPI wrapper around yt-dlp.

Exposes:
  GET  /health             -> {"ok": true}
  POST /info     {url}     -> normalized metadata + formats
  POST /resolve  {url, format_id?, audio_format?, audio_bitrate?}
                           -> {"download_url", "filename"} (direct upstream link)

Optional auth: set env API_KEY; clients send X-API-Key header.
"""

import os
import re
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
import yt_dlp

app = FastAPI(title="yt-dlp service", version="1.0.0")

API_KEY = os.environ.get("API_KEY", "").strip()

# --- helpers -----------------------------------------------------------------

URL_RE = re.compile(r"^https?://", re.IGNORECASE)


def _check_auth(x_api_key: Optional[str]) -> None:
    if not API_KEY:
        return  # auth disabled
    if not x_api_key or x_api_key.strip() != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


def _validate_url(url: str) -> str:
    url = (url or "").strip()
    if not url or not URL_RE.match(url):
        raise HTTPException(status_code=400, detail="Invalid URL")
    if len(url) > 2048:
        raise HTTPException(status_code=400, detail="URL too long")
    return url


def _ydl(opts: dict[str, Any]) -> yt_dlp.YoutubeDL:
    base = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "skip_download": True,
        "nocheckcertificate": True,
        "socket_timeout": 20,
        "extractor_retries": 2,
        # No filesystem writes; we never download.
        "outtmpl": "-",
    }
    base.update(opts)
    return yt_dlp.YoutubeDL(base)


def _normalize_format(f: dict[str, Any]) -> dict[str, Any]:
    return {
        "format_id": f.get("format_id"),
        "ext": f.get("ext"),
        "resolution": f.get("resolution")
        or (f"{f.get('height')}p" if f.get("height") else None),
        "height": f.get("height"),
        "width": f.get("width"),
        "abr": f.get("abr"),
        "vbr": f.get("vbr"),
        "tbr": f.get("tbr"),
        "filesize": f.get("filesize") or f.get("filesize_approx"),
        "vcodec": f.get("vcodec"),
        "acodec": f.get("acodec"),
        "has_audio": (f.get("acodec") not in (None, "none")),
        "has_video": (f.get("vcodec") not in (None, "none")),
        "url": f.get("url"),
    }


# --- models ------------------------------------------------------------------


class InfoReq(BaseModel):
    url: str


class ResolveReq(BaseModel):
    url: str
    format_id: Optional[str] = None
    # Audio-extraction shortcuts (used by /api/convert in the main app).
    audio_format: Optional[str] = Field(
        None, description="mp3|m4a|wav|ogg|aac — when set, picks best audio + format selector"
    )
    audio_bitrate: Optional[str] = Field(None, description="e.g. '192' or '192k'")


# --- routes ------------------------------------------------------------------


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "yt_dlp": yt_dlp.version.__version__}


@app.post("/info")
def info(req: InfoReq, x_api_key: Optional[str] = Header(default=None)) -> dict[str, Any]:
    _check_auth(x_api_key)
    url = _validate_url(req.url)
    try:
        with _ydl({}) as ydl:
            data = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"yt-dlp failed: {e}")

    if not data:
        raise HTTPException(status_code=502, detail="yt-dlp returned no data")

    # Playlists: pick the first entry's metadata for "detect" purposes.
    if data.get("_type") == "playlist" and data.get("entries"):
        data = data["entries"][0] or {}

    raw_formats = data.get("formats") or []
    formats = [_normalize_format(f) for f in raw_formats if f.get("url")]

    return {
        "title": data.get("title") or "Untitled",
        "thumbnail": data.get("thumbnail"),
        "duration": data.get("duration"),
        "uploader": data.get("uploader"),
        "webpage_url": data.get("webpage_url"),
        "extractor": data.get("extractor_key"),
        "formats": formats[:120],
    }


@app.post("/resolve")
def resolve(req: ResolveReq, x_api_key: Optional[str] = Header(default=None)) -> dict[str, Any]:
    _check_auth(x_api_key)
    url = _validate_url(req.url)

    selector = req.format_id
    if not selector:
        if req.audio_format:
            # Best audio of the requested ext, fallback to bestaudio.
            ext = req.audio_format.lower()
            selector = f"bestaudio[ext={ext}]/bestaudio"
        else:
            selector = "best"

    opts: dict[str, Any] = {"format": selector}

    try:
        with _ydl(opts) as ydl:
            data = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"yt-dlp failed: {e}")

    if not data:
        raise HTTPException(status_code=502, detail="yt-dlp returned no data")

    # When yt-dlp picks via -f, the chosen url lives at top-level (or first entry).
    if data.get("_type") == "playlist" and data.get("entries"):
        data = data["entries"][0] or {}

    chosen_url = data.get("url")
    filename = data.get("title")
    ext = data.get("ext")

    # Some extractors only populate "requested_formats" (merged a+v).
    if not chosen_url:
        req_formats = data.get("requested_formats") or []
        if req_formats:
            # We can't merge server-side cheaply on free tier; return the
            # highest-bitrate single track. For audio-only that's exactly what we want.
            picked = max(
                req_formats,
                key=lambda f: (f.get("tbr") or 0) + (f.get("abr") or 0),
            )
            chosen_url = picked.get("url")
            ext = picked.get("ext") or ext

    if not chosen_url:
        raise HTTPException(status_code=502, detail="No downloadable URL for selected format")

    safe_name = (filename or "download").strip().replace("/", "_")[:120]
    if ext:
        safe_name = f"{safe_name}.{ext}"

    return {"download_url": chosen_url, "filename": safe_name, "ext": ext}
