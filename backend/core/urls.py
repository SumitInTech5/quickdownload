from django.conf import settings
from django.http import JsonResponse
from django.urls import include, path
from django.views.static import serve


def root_status(_request):
    return JsonResponse({
        "ok": True,
        "service": "All Video Downloader backend",
        "message": "Backend is live. Use /api/health/ to check downloader status.",
    })

urlpatterns = [
    path("", root_status),
    path("api/", include("downloader.urls")),
    path("media/<path:path>", serve, {"document_root": settings.MEDIA_ROOT}),
]
