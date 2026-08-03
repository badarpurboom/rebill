from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework.permissions import IsAuthenticated

from apps.auth_app.permissions import IsOwner

from .services import (
    generate_report_pdf,
    get_daily_report,
    get_dashboard_summary,
    get_gst_report,
    get_ltv_report,
    get_monthly_report,
    get_weekly_report,
)


class DashboardSummaryView(APIView):
    """Executive Dashboard Real-Time Metrics."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        period = request.query_params.get('period', 'today')
        res = get_dashboard_summary(period)
        return Response(res, status=status.HTTP_200_OK)



class DailyReportView(APIView):
    """Daily Sales Summary."""

    permission_classes = [IsOwner]

    def get(self, request):
        date_str = request.query_params.get('date', timezone.now().strftime('%Y-%m-%d'))
        try:
            res = get_daily_report(date_str)
            return Response(res, status=status.HTTP_200_OK)
        except ValueError:
            return Response({'detail': 'Ghalat date format. YYYY-MM-DD use karein.'}, status=status.HTTP_400_BAD_REQUEST)


class WeeklyReportView(APIView):
    """7-Day Sales Report."""

    permission_classes = [IsOwner]

    def get(self, request):
        date_str = request.query_params.get('start_date', (timezone.now() - timezone.timedelta(days=6)).strftime('%Y-%m-%d'))
        try:
            res = get_weekly_report(date_str)
            return Response(res, status=status.HTTP_200_OK)
        except ValueError:
            return Response({'detail': 'Ghalat date format.'}, status=status.HTTP_400_BAD_REQUEST)


class MonthlyReportView(APIView):
    """Monthly Sales Trend."""

    permission_classes = [IsOwner]

    def get(self, request):
        now = timezone.now()
        year = request.query_params.get('year', now.year)
        month = request.query_params.get('month', now.month)
        try:
            res = get_monthly_report(year, month)
            return Response(res, status=status.HTTP_200_OK)
        except ValueError:
            return Response({'detail': 'Ghalat year ya month.'}, status=status.HTTP_400_BAD_REQUEST)


class GSTReportView(APIView):
    """GST Compliance Register (5% Total)."""

    permission_classes = [IsOwner]

    def get(self, request):
        now = timezone.now()
        from_date = request.query_params.get('from', now.strftime('%Y-%m-01'))
        to_date = request.query_params.get('to', now.strftime('%Y-%m-%d'))
        try:
            res = get_gst_report(from_date, to_date)
            return Response(res, status=status.HTTP_200_OK)
        except ValueError:
            return Response({'detail': 'Ghalat date format.'}, status=status.HTTP_400_BAD_REQUEST)


class LTVReportView(APIView):
    """Customer Lifetime Value Leaderboard."""

    permission_classes = [IsOwner]

    def get(self, request):
        res = get_ltv_report()
        return Response(res, status=status.HTTP_200_OK)


class ExportPDFReportView(APIView):
    """PDF Download Endpoint."""

    permission_classes = [IsOwner]

    def get(self, request):
        report_type = request.query_params.get('type', 'daily')
        pdf_bytes = generate_report_pdf(report_type, request.query_params)

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="rebill_{report_type}_report.pdf"'
        return response
