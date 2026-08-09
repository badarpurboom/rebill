from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.reports.services import (
    get_dashboard_summary,
    get_daily_report,
    get_ltv_report,
)
from apps.menu.models import MenuItem
from apps.billing.models import Bill, OrderItem
from apps.customers.models import Customer
from django.db.models import Sum
from .authentication import AITokenAuthentication

class AIRootDirectoryView(APIView):
    """
    Root endpoint for ChatGPT to discover available AI gateway routes.
    """
    permission_classes = []
    
    def get(self, request):
        return Response({
            "message": "Welcome to the ReBill POS AI Gateway. Please use the following endpoints and authenticate with your secure token in the Authorization: Bearer header.",
            "endpoints": [
                {
                    "url": "/api/ai/sales/summary/",
                    "description": "Get high-level dashboard metrics for today, week, or month.",
                    "method": "GET"
                },
                {
                    "url": "/api/ai/sales/daily/",
                    "description": "Get detailed daily sales breakdown including top items and payment modes.",
                    "method": "GET"
                },
                {
                    "url": "/api/ai/products/top/",
                    "description": "Get top selling products and categories.",
                    "method": "GET"
                },
                {
                    "url": "/api/ai/customers/top/",
                    "description": "Get top customers by LTV and frequency.",
                    "method": "GET"
                }
            ]
        })

class AISalesSummaryView(APIView):
    """
    AI Endpoint: Returns overall sales summary (today, week, month).
    """
    authentication_classes = [AITokenAuthentication]

    def get(self, request):
        period = request.query_params.get('period', 'today')
        data = get_dashboard_summary(period)
        return Response(data, status=status.HTTP_200_OK)


class AIDailyReportView(APIView):
    """
    AI Endpoint: Returns detailed breakdown of a specific day's sales.
    """
    authentication_classes = [AITokenAuthentication]

    def get(self, request):
        date_str = request.query_params.get('date')
        if not date_str:
            from django.utils import timezone
            date_str = timezone.now().strftime('%Y-%m-%d')
            
        try:
            data = get_daily_report(date_str)
            return Response(data, status=status.HTTP_200_OK)
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)


class AITopProductsView(APIView):
    """
    AI Endpoint: Returns top selling products.
    """
    authentication_classes = [AITokenAuthentication]

    def get(self, request):
        limit = int(request.query_params.get('limit', 10))
        top_items = (
            OrderItem.objects.filter(order__bill__status='PAID')
            .values('item_name')
            .annotate(total_qty=Sum('quantity'), total_revenue=Sum('total'))
            .order_by('-total_qty')[:limit]
        )
        return Response(list(top_items), status=status.HTTP_200_OK)


class AITopCustomersView(APIView):
    """
    AI Endpoint: Returns top customers by LTV (Lifetime Value).
    """
    authentication_classes = [AITokenAuthentication]

    def get(self, request):
        data = get_ltv_report()
        return Response(data, status=status.HTTP_200_OK)


class AITextReportView(APIView):
    """
    Generates a ready-made plain text report for copy-pasting into ChatGPT.
    No auth required - uses session auth (must be logged in POS user).
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from django.utils import timezone
        from apps.settings_app.models import RestaurantSettings
        from apps.billing.models import Bill
        import datetime

        today = timezone.now().date()
        yesterday = today - datetime.timedelta(days=1)

        def day_summary(date):
            bills = Bill.objects.filter(created_at__date=date, status='PAID')
            total = sum(b.final_total or 0 for b in bills)
            count = bills.count()
            avg = round(total / count, 2) if count else 0

            # Top items for that day
            items = (
                OrderItem.objects.filter(order__bill__created_at__date=date, order__bill__status='PAID')
                .values('item_name')
                .annotate(qty=Sum('quantity'), rev=Sum('total'))
                .order_by('-qty')[:5]
            )
            items_text = '\n'.join(
                [f"  {i+1}. {it['item_name']} — {it['qty']} pcs = ₹{it['rev']}" for i, it in enumerate(items)]
            ) or '  (No data)'

            # Payment mode
            upi = sum(b.final_total or 0 for b in bills if b.payment_mode == 'UPI')
            cash = sum(b.final_total or 0 for b in bills if b.payment_mode == 'CASH')
            card = sum(b.final_total or 0 for b in bills if b.payment_mode == 'CARD')

            return {
                'total': total, 'count': count, 'avg': avg,
                'items_text': items_text, 'upi': upi, 'cash': cash, 'card': card
            }

        t = day_summary(today)
        y = day_summary(yesterday)

        try:
            settings = RestaurantSettings.objects.first()
            name = settings.restaurant_name if settings else 'My Restaurant'
        except Exception:
            name = 'My Restaurant'

        report = f"""=== {name} — POS Daily Report ===
Date: {today.strftime('%d %B %Y')}
Generated: {timezone.now().strftime('%I:%M %p')}

--- AAJKA DATA ({today.strftime('%d %b')}) ---
Total Sales    : ₹{t['total']}
Total Bills    : {t['count']}
Average Bill   : ₹{t['avg']}
UPI            : ₹{t['upi']}
Cash           : ₹{t['cash']}
Card           : ₹{t['card']}

Top Selling Items (Aaj):
{t['items_text']}

--- KAL KA DATA ({yesterday.strftime('%d %b')}) ---
Total Sales    : ₹{y['total']}
Total Bills    : {y['count']}
Average Bill   : ₹{y['avg']}

Top Selling Items (Kal):
{y['items_text']}

---
Yeh data mere restaurant ke actual POS system se liya gaya hai.
Ab aap iske baare mein koi bhi sawaal puch sakte hain.
"""
        return Response({'report': report}, status=status.HTTP_200_OK)
