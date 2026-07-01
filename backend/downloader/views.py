from __future__ import annotations

import logging
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


def _validate_url(raw) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    raw = raw.strip()
    try:
        p = urlparse(raw)
    except Exception:
        return None
    if p.scheme not in ("http", "https") or not p.netloc:
        return None
    return raw


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
        except Exception as exc:
            log.exception("detect failed")
            return Response({"error": str(exc) or "Extraction failed."}, status=502)


class DownloadView(APIView):
    permission_classes = [ApiKeyPermission]

    def post(self, request):
        url = _validate_url(request.data.get("url"))
        format_id = str(request.data.get("format_id") or "").strip()
        if not url:
            return Response({"error": "Invalid or missing URL."}, status=400)
        if not format_id:
            return Response({"error": "Missing format_id."}, status=400)
        try:
            return Response(services.resolve_download(url, format_id))
        except Exception as exc:
            log.exception("download failed")
            return Response({"error": str(exc) or "Download failed."}, status=502)


class ConvertView(APIView):
    permission_classes = [ApiKeyPermission]

    def post(self, request):
        url = _validate_url(request.data.get("url"))
        target_format = str(request.data.get("target_format") or "").lower().strip()
        bitrate = request.data.get("bitrate")
        if not url:
            return Response({"error": "Invalid or missing URL."}, status=400)
        if target_format not in ALLOWED_TARGETS:
            return Response(
                {"error": f"Unsupported target_format. Allowed: {sorted(ALLOWED_TARGETS)}"},
                status=400,
            )
        try:
            return Response(services.convert(url, target_format, bitrate))
        except Exception as exc:
            log.exception("convert failed")
            return Response({"error": str(exc) or "Conversion failed."}, status=502)
