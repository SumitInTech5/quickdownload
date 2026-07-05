"""yt-dlp wrappers used by the API views."""
from __future__ import annotations

import os
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from django.conf import settings
from yt_dlp import YoutubeDL


BEST_MP4_ID = "best_mp4"
BEST_MP3_ID = "best_mp3"
SAFE_TITLE_RE = re.compile(r"[^A-Za-z0-9._ -]+")


def _base_opts() -> Dict[str, Any]:
    opts: Dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
        "cachedir": False,
        "retries": 2,
        "fragment_retries": 2,
        "socket_timeout": 25,
        
    }
    if settings.YTDLP_COOKIES_FILE:
        opts["cookiefile"] = settings.YTDLP_COOKIES_FILE
    if settings.YTDLP_PROXY:
        opts["proxy"] = settings.YTDLP_PROXY
    return opts


def _cookie_file_has_rows(path: Path) -> bool:
    try:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except OSError:
        return False
    return any(line.strip() and not line.startswith("#") and len(line.split("\t")) >= 7 for line in lines)


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
    usable = bool(readable and _cookie_file_has_rows(path))
    label = str(path) if str(path).startswith("/app/") else path.name
    if usable:
        message = "YouTube cookies are configured and usable."
    elif readable:
        message = "YTDLP_COOKIES_FILE is readable, but it contains no cookie rows yet. Replace the placeholder with a real Netscape cookies.txt export."
    elif exists:
        message = "YTDLP_COOKIES_FILE is set, but the file is not readable."
    else:
        message = "YTDLP_COOKIES_FILE is set, but the file was not found."

    return {
        "configured": True,
        "available": usable,
        "readable": readable,
        "pathLabel": label,
        "message": message,
    }


def _human_size(n: Optional[int]) -> Optional[str]:
    if not n or n <= 0:
        return None
    size = float(n)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024:
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024
    return f"{size:.1f} PB"


def _bitrate(f: Dict[str, Any]) -> Optional[str]:
    value = f.get("abr") or f.get("tbr")
    return f"{int(value)}kbps" if value else None


def _resolution(f: Dict[str, Any]) -> Optional[str]:
    if f.get("resolution") and f.get("resolution") != "audio only":
        return f.get("resolution")
    if f.get("height"):
        return f"{f.get('height')}p"
    return None


def _safe_filename(title: str, ext: str) -> str:
    clean = SAFE_TITLE_RE.sub("", title).strip(" .")[:120] or "download"
    return f"{clean}.{ext}"


def _normalize_info(info: Dict[str, Any]) -> Dict[str, Any]:
    if info.get("_type") == "playlist" and info.get("entries"):
        entries = [e for e in info["entries"] if e]
        if entries:
            return entries[0]
    return info


def extract_info(url: str, *, format_selector: Optional[str] = None) -> Dict[str, Any]:
    opts = _base_opts()
    if format_selector:
        opts["format"] = format_selector
    with YoutubeDL(opts) as ydl:
        return _normalize_info(ydl.extract_info(url, download=False))


def _stream_from_format(f: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(f.get("format_id") or BEST_MP4_ID),
        "kind": "video",
        "container": "mp4",
        "resolution": _resolution(f) or "Best available",
        "bitrate": _bitrate(f),
        "fileSize": _human_size(f.get("filesize") or f.get("filesize_approx")),
    }


def detect(url: str) -> Dict[str, Any]:
    info = extract_info(url)
    formats = info.get("formats") or []

    mp4_progressive = [
        f for f in formats
        if f.get("url")
        and (f.get("ext") or "").lower() == "mp4"
        and (f.get("vcodec") or "none") != "none"
        and (f.get("acodec") or "none") != "none"
    ]
    mp4_progressive.sort(key=lambda f: (int(f.get("height") or 0), float(f.get("tbr") or 0)), reverse=True)

    streams: List[Dict[str, Any]] = []
    seen_ids: set[str] = set()
    for f in mp4_progressive[:8]:
        fmt_id = str(f.get("format_id") or "")
        if not fmt_id or fmt_id in seen_ids:
            continue
        seen_ids.add(fmt_id)
        streams.append(_stream_from_format(f))

    if BEST_MP4_ID not in seen_ids:
        streams.insert(0, {
            "id": BEST_MP4_ID,
            "kind": "video",
            "container": "mp4",
            "resolution": "Best available",
            "bitrate": None,
            "fileSize": None,
        })
    streams.append({
        "id": BEST_MP3_ID,
        "kind": "audio",
        "container": "mp3",
        "resolution": None,
        "bitrate": "Best available",
        "fileSize": None,
    })

    preview_url = None
    preview_kind = None
    if mp4_progressive:
        preview_url = mp4_progressive[0].get("url")
        preview_kind = "video"
    elif info.get("url") and (info.get("ext") or "").lower() in {"mp4", "mp3", "m4a", "webm"}:
        preview_url = info.get("url")
        preview_kind = "audio" if (info.get("vcodec") or "none") == "none" else "video"

    return {
        "title": info.get("title") or "Untitled",
        "thumbnail": info.get("thumbnail"),
        "previewUrl": preview_url,
        "previewKind": preview_kind,
        "streams": streams,
        "cookies": cookie_status(),
    }


def resolve_download(url: str, format_id: str) -> Dict[str, str]:
    if format_id == BEST_MP3_ID:
        return convert(url, "mp3", None)
    if format_id == BEST_MP4_ID or "+" in format_id:
        return convert(url, "mp4", None)

    info = extract_info(url, format_selector=format_id)
    direct: Optional[str] = info.get("url")
    ext = (info.get("ext") or "mp4").lower()
    if ext != "mp4" or not direct:
        return convert(url, "mp4", None)

    return {"download_url": direct, "filename": _safe_filename(info.get("title", "download"), "mp4")}


def convert(url: str, target_format: str, bitrate: Optional[str]) -> Dict[str, str]:
    """Download + transcode. Requires ffmpeg on PATH and a writable MEDIA_ROOT."""
    target_format = target_format.lower()
    if target_format not in {"mp3", "mp4"}:
        raise ValueError("Only mp4 video and mp3 audio output are supported.")

    media_root: Path = settings.MEDIA_ROOT
    media_root.mkdir(parents=True, exist_ok=True)

    file_id = uuid.uuid4().hex
    outtmpl = str(media_root / f"{file_id}.%(ext)s")
    opts = _base_opts()
    opts.update({
        "skip_download": False,
        "outtmpl": outtmpl,
        "quiet": True,
        "restrictfilenames": True,
    })

    if target_format == "mp3":
        opts["format"] = "bestaudio/best"
        pref = (bitrate or "320k").rstrip("kK") or "320"
        opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": pref,
        }]
    else:
        opts["format"] = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/bestvideo+bestaudio/best"
        opts["merge_output_format"] = "mp4"
        opts["postprocessors"] = [{
            "key": "FFmpegVideoConvertor",
            "preferedformat": "mp4",
        }]

    with YoutubeDL(opts) as ydl:
        info = _normalize_info(ydl.extract_info(url, download=True))

    produced = sorted(media_root.glob(f"{file_id}.*"), key=lambda p: p.stat().st_mtime)
    if not produced:
        raise RuntimeError("Conversion produced no output file.")
    final = next((p for p in produced if p.suffix.lower() == f".{target_format}"), produced[-1])

    base = settings.PUBLIC_BASE_URL
    rel = f"{settings.MEDIA_URL}{final.name}"
    download_url = f"{base}{rel}" if base else rel
    return {
        "download_url": download_url,
        "filename": _safe_filename(info.get("title", "download"), final.suffix.lstrip(".") or target_format),
    }
