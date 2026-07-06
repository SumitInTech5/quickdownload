from __future__ import annotations

import ipaddress
import logging
import re
import socket
from urllib.parse import urlparse

import yt_dlp
from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .permissions import ApiKeyPermission

log = logging.getLogger(__name__)

ALLOWED_AUDIO = {"mp3"}
ALLOWED_VIDEO = {"mp4"}
ALLOWED_TARGETS = ALLOWED_AUDIO | ALLOWED_VIDEO
ALLOWED_BITRATES = {"64", "96", "128", "160", "192", "256", "320"}

# Restrict yt-dlp format_id to plain identifiers returned by the detect step.
# Allows the "best" alias plus digits, letters, dashes, underscores, dots and a
# single "+" (used by yt-dlp to combine one video and one audio stream).
FORMAT_ID_RE = re.compile(r"^[A-Za-z0-9_.\-]+(\+[A-Za-z0-9_.\-]+)?$")

def _ip_is_public(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


# --- SSRF hardening: enforce public-IP-only resolution at connect time. ---
# Wrapping socket.getaddrinfo globally prevents DNS rebinding: even if a
# hostname resolves to a public IP during pre-validation and to a private IP
# moments later when yt-dlp/urllib actually connects, the connect-time
# resolution passes through this same filter and any private/reserved
# addresses are stripped, causing the connection to fail closed.
_original_getaddrinfo = socket.getaddrinfo


def _safe_getaddrinfo(host, *args, **kwargs):
    infos = _original_getaddrinfo(host, *args, **kwargs)
    filtered = [info for info in infos if _ip_is_public(info[4][0])]
    if not filtered:
        raise socket.gaierror(f"blocked non-public address for host {host!r}")
    return filtered


if socket.getaddrinfo is not _safe_getaddrinfo:
    socket.getaddrinfo = _safe_getaddrinfo


def _host_is_public(host: str) -> bool:
    """Resolve the host and reject loopback, private, link-local, and
    otherwise reserved addresses to prevent SSRF via yt-dlp fetches."""
    try:
        infos = _original_getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        if not _ip_is_public(info[4][0]):
            return False
    return True


def _validate_url(raw) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    raw = raw.strip()
    if len(raw) > 2048:
        return None
    try:
        p = urlparse(raw)
    except Exception:
        return None
    if p.scheme not in ("http", "https") or not p.hostname:
        return None
    if not _host_is_public(p.hostname):
        return None
    return raw


def _validate_format_id(raw) -> str | None:
    if not isinstance(raw, str):
        return None
    raw = raw.strip()
    if not raw or len(raw) > 64:
        return None
    if not FORMAT_ID_RE.match(raw):
        return None
    return raw


def _validate_bitrate(raw) -> str | None:
    if raw is None or raw == "":
        return None  # optional; service picks a safe default
    if not isinstance(raw, str):
        return "__invalid__"
    v = raw.strip().rstrip("k").rstrip("K")
    if v not in ALLOWED_BITRATES:
        return "__invalid__"
    return v


def _extract_error(exc: Exception) -> str:
    message = (str(exc).strip() or type(exc).__name__).replace("ERROR: ", "").strip()
    lower = message.lower()
    if "sign in to confirm" in lower or "not a bot" in lower or "cookies" in lower:
        return (
            "YouTube blocked this request (bot detection). "
            "This usually means the cookies file is missing/stale, or YouTube has flagged this cloud host's IP address "
            "(common on Render's free tier even with valid cookies). "
            "Upload a fresh Netscape cookies.txt export as a Render Secret File mounted at /etc/secrets/cookies.txt. "
            "See https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies and "
            "https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide"
        )
    if "po token" in lower or "requested format is not available" in lower:
        return (
            "YouTube requires a PO Token for this request. "
            "See https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide for configuring a PO Token provider."
        )
    if "unsupported url" in lower:
        return "This website or URL is not supported by yt-dlp. Try a public, non-DRM media page."
    if "drm" in lower:
        return "This source appears to use DRM or protected streaming, which is not supported."
    if "http error 403" in lower or "forbidden" in lower:
        return "The source blocked the backend request. Cookies or a proxy may be required, or the site may not allow downloading."
    return "Media extraction failed. The source may be unavailable, region-locked, or not supported."


class HealthView(APIView):
    permission_classes = []

    def get(self, request):
        configured_key = getattr(settings, "API_KEY", "")
        provided_key = request.headers.get("X-API-Key", "")
        authenticated = bool(configured_key) and provided_key == configured_key
        if provided_key and not authenticated:
            return Response({"ok": False, "message": "Invalid backend API key."}, status=401)
        return Response({
            "ok": True,
            "ytdlp": yt_dlp.version.__version__,
            "auth_required": bool(configured_key),
            "authenticated": authenticated,
            "cookies": services.cookie_status(),
            "proxy": {"configured": bool(getattr(settings, "YTDLP_PROXY", None))},
        })


class DetectView(APIView):
    permission_classes = [ApiKeyPermission]

    def post(self, request):
        url = _validate_url(request.data.get("url"))
        if not url:
            return Response({"error": "Invalid or missing URL."}, status=400)
        try:
            return Response(services.detect(url))
        except Exception as exc:
            log.exception("detect failed")
            return Response({"error": f"Extraction failed: {_extract_error(exc)}"}, status=502)


class DownloadView(APIView):
    permission_classes = [ApiKeyPermission]

    def post(self, request):
        url = _validate_url(request.data.get("url"))
        format_id = _validate_format_id(request.data.get("format_id"))
        if not url:
            return Response({"error": "Invalid or missing URL."}, status=400)
        if not format_id:
            return Response({"error": "Invalid or missing format_id."}, status=400)
        try:
            return Response(services.resolve_download(url, format_id))
        except Exception as exc:
            log.exception("download failed")
            return Response({"error": f"Download failed: {_extract_error(exc)}"}, status=502)


class ConvertView(APIView):
    permission_classes = [ApiKeyPermission]

    def post(self, request):
        url = _validate_url(request.data.get("url"))
        target_format = str(request.data.get("target_format") or "").lower().strip()
        bitrate = _validate_bitrate(request.data.get("bitrate"))
        if not url:
            return Response({"error": "Invalid or missing URL."}, status=400)
        if target_format not in ALLOWED_TARGETS:
            return Response(
                {"error": "Unsupported target_format. Use mp4 for video or mp3 for audio."},
                status=400,
            )
        if bitrate == "__invalid__":
            return Response(
                {"error": f"Unsupported bitrate. Allowed: {sorted(ALLOWED_BITRATES)}"},
                status=400,
            )
        try:
            return Response(services.convert(url, target_format, bitrate))
        except Exception as exc:
            log.exception("convert failed")
            return Response({"error": f"Conversion failed: {_extract_error(exc)}"}, status=502)
