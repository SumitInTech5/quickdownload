from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.HealthView.as_view()),
    path("settings/", views.SettingsView.as_view()),
    path("detect/", views.DetectView.as_view()),
    path("download/", views.DownloadView.as_view()),
    path("convert/", views.ConvertView.as_view()),
]
