"""Root URL configuration for ReBill."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    return JsonResponse({'status': 'ok', 'service': 'rebill-api'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health),
    path('api/auth/', include('apps.auth_app.urls')),
    path('api/menu/', include('apps.menu.urls')),
    path('api/tables/', include('apps.tables.urls')),
    path('api/billing/', include('apps.billing.urls')),
    path('api/customers/', include('apps.customers.urls')),
    path('api/settings/', include('apps.settings_app.urls')),
    path('api/whatsapp/', include('apps.whatsapp.urls')),
    path('api/coupons/', include('apps.coupons.urls')),
    path('api/feedback/', include('apps.feedback.urls')),
    path('api/reports/', include('apps.reports.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
