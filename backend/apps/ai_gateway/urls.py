from django.urls import path
from .views import (
    AISalesSummaryView,
    AIDailyReportView,
    AITopProductsView,
    AITopCustomersView,
)

urlpatterns = [
    path('sales/summary/', AISalesSummaryView.as_view(), name='ai-sales-summary'),
    path('sales/daily/', AIDailyReportView.as_view(), name='ai-sales-daily'),
    path('products/top/', AITopProductsView.as_view(), name='ai-top-products'),
    path('customers/top/', AITopCustomersView.as_view(), name='ai-top-customers'),
]
