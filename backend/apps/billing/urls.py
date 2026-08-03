from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('orders', views.OrderViewSet, basename='order')
router.register('bills', views.BillViewSet, basename='bill')

urlpatterns = [
    path('kots/', views.KOTListView.as_view(), name='kot-list'),
    path('', include(router.urls)),
]
