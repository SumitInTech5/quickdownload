from django.conf import settings
from rest_framework.permissions import BasePermission


class ApiKeyPermission(BasePermission):
    """Require matching X-API-Key header.

    Deployments MUST set API_KEY. When it is missing we deny all requests
    (except when DEBUG is on) rather than silently exposing the API to the
    public internet.
    """

    message = "Invalid or missing API key."

    def has_permission(self, request, view) -> bool:
        expected = getattr(settings, "API_KEY", "")
        if not expected:
            # Missing key: only allow requests in local DEBUG mode.
            return bool(getattr(settings, "DEBUG", False))
        provided = request.headers.get("X-API-Key", "")
        return bool(provided) and provided == expected
