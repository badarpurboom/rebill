from django.urls import path
from .views import (
    AIRootDirectoryView,
    AISalesSummaryView,
    AIDailyReportView,
    AITopProductsView,
    AITopCustomersView,
    AITextReportView,
    AISchemaView,
    AIRunQueryView,
    AIContextDailyView,
    AIDemandForecastView,
)

urlpatterns = [
    path('', AIRootDirectoryView.as_view(), name='ai-root-directory'),
    path('schema/', AISchemaView.as_view(), name='ai-schema'),
    path('query/', AIRunQueryView.as_view(), name='ai-query'),
    path('sales/summary/', AISalesSummaryView.as_view(), name='ai-sales-summary'),
    path('sales/daily/', AIDailyReportView.as_view(), name='ai-sales-daily'),
    path('products/top/', AITopProductsView.as_view(), name='ai-top-products'),
    path('customers/top/', AITopCustomersView.as_view(), name='ai-top-customers'),
    path('text-report/', AITextReportView.as_view(), name='ai-text-report'),
    path('context/daily/', AIContextDailyView.as_view(), name='ai-context-daily'),
    path('forecast/demand/', AIDemandForecastView.as_view(), name='ai-forecast-demand'),
]
