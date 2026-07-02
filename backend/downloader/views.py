from __future__ import annotations

import ipaddress
import logging
import re
import socket
from urllib.parse import urlparse

import yt_dlp
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .permissions import ApiKeyPermission

log = logging.getLogger(__name__)

ALLOWED_AUDIO = {"mp3", "aac", "wav", "ogg", "m4a"}
ALLOWED_VIDEO = {"mp4"}
ALLOWED_TARGETS = ALLOWED_AUDIO | ALLOWED_VIDEO
ALLOWED_BITRATES = {"64", "96", "128", "160", "192", "256", "320"}

# Restrict yt-dlp format_id to plain identifiers returned by the detect step.
# Allows the "best" alias plus digits, letters, dashes, underscores, dots and a
# single "+" (used by yt-dlp to combine one video and one audio stream).
FORMAT_ID_RE = re.compile(r"^[A-Za-z0-9_.\-]+(\+[A-Za-z0-9_.\-]+)?$")

GENERIC_ERROR = "Request failed. Please try again."


def _host_is_public(host: str) -> bool:
    """Resolve the host and reject loopback, private, link-local, and
    otherwise reserved addresses to prevent SSRF via yt-dlp fetches."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            return False
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
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


class HealthView(APIView):
    permission_classes = []

    def get(self, request):
        return Response({"ok": True, "ytdlp": yt_dlp.version.__version__})


class DetectView(APIView):
    permission_classes = [ApiKeyPermission]

    def post(self, request):
        url = _validate_url(request.data.get("url"))
        if not url:
            return Response({"error": "Invalid or missing URL."}, status=400)
        try:
            return Response(services.detect(url))
        except Exception:
            log.exception("detect failed")
            return Response({"error": GENERIC_ERROR}, status=502)


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
        except Exception:
            log.exception("download failed")
            return Response({"error": GENERIC_ERROR}, status=502)


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
                {"error": f"Unsupported target_format. Allowed: {sorted(ALLOWED_TARGETS)}"},
                status=400,
            )
        if bitrate == "__invalid__":
            return Response(
                {"error": f"Unsupported bitrate. Allowed: {sorted(ALLOWED_BITRATES)}"},
                status=400,
            )
        try:
            return Response(services.convert(url, target_format, bitrate))
        except Exception:
            log.exception("convert failed")
            return Response({"error": GENERIC_ERROR}, status=502)
