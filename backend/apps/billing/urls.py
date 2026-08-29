from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import sync_views, views

router = DefaultRouter()
router.register('orders', views.OrderViewSet, basename='order')
router.register('bills', views.BillViewSet, basename='bill')

urlpatterns = [
    path('kots/', views.KOTListView.as_view(), name='kot-list'),
    path('sync/ping/', sync_views.SyncPingView.as_view(), name='sync-ping'),
    path('sync/batch/', sync_views.SyncBatchView.as_view(), name='sync-batch'),
    path('', include(router.urls)),
]

