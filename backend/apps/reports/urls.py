from django.urls import path

from .views import (
    DailyReportView,
    DashboardSummaryView,
    ExportPDFReportView,
    GSTReportView,
    LTVReportView,
    MonthlyReportView,
    WeeklyReportView,
)

urlpatterns = [
    path('dashboard-summary/', DashboardSummaryView.as_view(), name='report-dashboard-summary'),
    path('daily/', DailyReportView.as_view(), name='report-daily'),
    path('weekly/', WeeklyReportView.as_view(), name='report-weekly'),
    path('monthly/', MonthlyReportView.as_view(), name='report-monthly'),
    path('gst/', GSTReportView.as_view(), name='report-gst'),
    path('ltv/', LTVReportView.as_view(), name='report-ltv'),
    path('export-pdf/', ExportPDFReportView.as_view(), name='report-export-pdf'),
]

