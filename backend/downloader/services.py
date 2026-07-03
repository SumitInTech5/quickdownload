"""yt-dlp wrappers used by the API views."""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from django.conf import settings
from yt_dlp import YoutubeDL


def _base_opts() -> Dict[str, Any]:
    opts: Dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
        "cachedir": False,
    }
    if settings.YTDLP_COOKIES_FILE:
        opts["cookiefile"] = settings.YTDLP_COOKIES_FILE
    if settings.YTDLP_PROXY:
        opts["proxy"] = settings.YTDLP_PROXY
    return opts


def cookie_status() -> Dict[str, Any]:
    cookie_file = settings.YTDLP_COOKIES_FILE
    if not cookie_file:
        return {
            "configured": False,
            "available": False,
            "readable": False,
            "pathLabel": None,
            "message": "YouTube cookies are not configured.",
        }

    path = Path(cookie_file)
    exists = path.is_file()
    readable = bool(exists and os.access(path, os.R_OK))
    label = str(path) if str(path).startswith("/app/") else path.name
    if readable:
        message = "YouTube cookies are configured and readable."
    elif exists:
        message = "YTDLP_COOKIES_FILE is set, but the file is not readable."
    else:
        message = "YTDLP_COOKIES_FILE is set, but the file was not found."

    return {
        "configured": True,
        "available": readable,
        "readable": readable,
        "pathLabel": label,
        "message": message,
    }


def _human_size(n: Optional[int]) -> Optional[str]:
    if not n or n <= 0:
        return None
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024
    return f"{n:.1f} PB"


def _classify(f: Dict[str, Any]) -> str:
    vcodec = f.get("vcodec") or "none"
    acodec = f.get("acodec") or "none"
    if vcodec != "none":
        return "video"
    if acodec != "none":
        return "audio"
    return "video"


def extract_info(url: str) -> Dict[str, Any]:
    with YoutubeDL(_base_opts()) as ydl:
        return ydl.extract_info(url, download=False)


def detect(url: str) -> Dict[str, Any]:
    info = extract_info(url)
    # If it's a playlist entry list, take the first playable entry.
    if info.get("_type") == "playlist" and info.get("entries"):
        entries = [e for e in info["entries"] if e]
        if entries:
            info = entries[0]

    streams: List[Dict[str, Any]] = []
    for f in info.get("formats") or []:
        if not f.get("url"):
            continue
        kind = _classify(f)
        streams.append({
            "id": str(f.get("format_id")),
            "kind": kind,
            "container": f.get("ext") or "",
            "resolution": (
                f.get("resolution")
                or (f"{f.get('height')}p" if f.get("height") else None)
            ),
            "bitrate": (f"{int(f['abr'])}kbps" if f.get("abr") else
                        f"{int(f['tbr'])}kbps" if f.get("tbr") else None),
            "fileSize": _human_size(f.get("filesize") or f.get("filesize_approx")),
        })

    # Fallback: single-format extractors (TikTok, etc.) with a top-level url.
    if not streams and info.get("url"):
        streams.append({
            "id": "best",
            "kind": "video",
            "container": info.get("ext") or "mp4",
            "resolution": None,
            "bitrate": None,
            "fileSize": None,
        })

    return {
        "title": info.get("title") or "Untitled",
        "thumbnail": info.get("thumbnail"),
        "previewUrl": info.get("webpage_url"),
        "streams": streams,
    }


def resolve_download(url: str, format_id: str) -> Dict[str, str]:
    opts = _base_opts()
    if format_id and format_id != "best":
        opts["format"] = format_id
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    if info.get("_type") == "playlist" and info.get("entries"):
        info = next((e for e in info["entries"] if e), info)

    direct: Optional[str] = info.get("url")
    filename = f"{info.get('title', 'download')}.{info.get('ext', 'mp4')}"

    if not direct:
        # requested_formats: DASH combined
        req = info.get("requested_formats") or []
        if req:
            direct = req[0].get("url")
    if not direct:
        raise RuntimeError("No direct download URL available for this format.")
    return {"download_url": direct, "filename": filename}


AUDIO_FORMATS = {"mp3", "aac", "wav", "ogg", "m4a"}


def convert(url: str, target_format: str, bitrate: Optional[str]) -> Dict[str, str]:
    """Download + transcode. Requires ffmpeg on PATH and a writable MEDIA_ROOT."""
    target_format = target_format.lower()
    media_root: Path = settings.MEDIA_ROOT
    media_root.mkdir(parents=True, exist_ok=True)

    file_id = uuid.uuid4().hex
    outtmpl = str(media_root / f"{file_id}.%(ext)s")

    opts = _base_opts()
    opts["skip_download"] = False
    opts["outtmpl"] = outtmpl
    opts["quiet"] = True

    if target_format in AUDIO_FORMATS:
        opts["format"] = "bestaudio/best"
        pref = (bitrate or "192k").rstrip("k")
        opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": target_format,
            "preferredquality": pref,
        }]
    else:  # video: mp4 by default
        opts["format"] = "bv*+ba/best"
        opts["merge_output_format"] = target_format
        opts["postprocessors"] = [{
            "key": "FFmpegVideoConvertor",
            "preferedformat": target_format,
        }]

    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)

    title = info.get("title", "download")
    # Locate the final file matching our id prefix.
    produced = sorted(media_root.glob(f"{file_id}.*"))
    if not produced:
        raise RuntimeError("Conversion produced no output file.")
    # Prefer the file with the requested extension.
    final = next((p for p in produced if p.suffix.lower() == f".{target_format}"), produced[-1])

    base = settings.PUBLIC_BASE_URL
    rel = f"{settings.MEDIA_URL}{final.name}"
    download_url = f"{base}{rel}" if base else rel
    return {
        "download_url": download_url,
        "filename": f"{title}.{final.suffix.lstrip('.')}",
    }
