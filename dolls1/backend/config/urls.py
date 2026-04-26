from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def home(request):
    return JsonResponse({
        "app": "dolls1 backend",
        "status": "running",
        "admin": "/admin/",
        "api": "/api/",
        "docs": "/api/docs/",
        "dashboard_summary": "/api/dashboard-summary/",
    })


urlpatterns = [
    path("", home),  # 👈 THIS FIXES YOUR 404
    path("admin/", admin.site.urls),
    path("api/", include("supplychain.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)