from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CouponUsageHistoryView,
    CouponViewSet,
    GenerateCodeView,
    ValidateCouponView,
)

router = DefaultRouter()
router.register(r'', CouponViewSet, basename='coupon')

urlpatterns = [
    path('generate-code/', GenerateCodeView.as_view(), name='coupon-generate-code'),
    path('validate/', ValidateCouponView.as_view(), name='coupon-validate'),
    path('usage/', CouponUsageHistoryView.as_view(), name='coupon-usage'),
] + router.urls
