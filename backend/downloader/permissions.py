from django.conf import settings
from rest_framework.permissions import BasePermission


class ApiKeyPermission(BasePermission):
    """If settings.API_KEY is set, require matching X-API-Key header."""

    message = "Invalid or missing API key."

    def has_permission(self, request, view) -> bool:
        expected = getattr(settings, "API_KEY", "")
        if not expected:
            return True
        provided = request.headers.get("X-API-Key", "")
        return bool(provided) and provided == expected
