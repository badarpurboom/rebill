import datetime
import decimal
import re
import uuid
from django.db import connection
from django.db.models import F, Sum
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.models import Bill, OrderItem
from apps.customers.models import Customer
from apps.menu.models import MenuItem
from apps.reports.services import (
    get_daily_report,
    get_dashboard_summary,
    get_ltv_report,
)
from .authentication import AITokenAuthentication


class AIRootDirectoryView(APIView):
    """
    Root endpoint for ChatGPT / Claude to discover available AI gateway routes.
    """
    permission_classes = []

    def get(self, request):
        return Response({
            "message": "Welcome to the ReBill POS AI Gateway. Please use the following endpoints and authenticate with your secure token in the Authorization: Bearer header.",
            "endpoints": [
                {
                    "url": "/api/ai/schema/",
                    "description": "Get dynamic database schema (all tables, columns, types, and foreign keys).",
                    "method": "GET"
                },
                {
                    "url": "/api/ai/query/",
                    "description": "Execute raw read-only SQL SELECT queries on the restaurant database.",
                    "method": "POST"
                },
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
            .annotate(
                total_qty=Sum('quantity'),
                total_revenue=Sum(F('unit_price') * F('quantity'))
            )
            .order_by('-total_qty')[:limit]
        )
        return Response(
            [
                {
                    'item_name': item['item_name'],
                    'total_qty': item['total_qty'],
                    'total_revenue': str(item['total_revenue'] or 0),
                }
                for item in top_items
            ],
            status=status.HTTP_200_OK,
        )


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
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from django.utils import timezone
        from apps.settings_app.models import RestaurantSettings

        today = timezone.now().date()
        yesterday = today - datetime.timedelta(days=1)

        def day_summary(date):
            bills = Bill.objects.filter(created_at__date=date, status='PAID')
            total = sum(b.net_payable or 0 for b in bills)
            count = bills.count()
            avg = round(float(total) / count, 2) if count else 0

            # Top items for that day
            items = (
                OrderItem.objects.filter(order__bill__created_at__date=date, order__bill__status='PAID')
                .values('item_name')
                .annotate(qty=Sum('quantity'), rev=Sum(F('unit_price') * F('quantity')))
                .order_by('-qty')[:5]
            )
            items_text = '\n'.join(
                [f"  {i+1}. {it['item_name']} — {it['qty']} pcs = ₹{it['rev'] or 0}" for i, it in enumerate(items)]
            ) or '  (No data)'

            # Payment mode
            upi = sum(b.net_payable or 0 for b in bills if b.payment_mode == 'UPI')
            cash = sum(b.net_payable or 0 for b in bills if b.payment_mode == 'CASH')
            card = sum(b.net_payable or 0 for b in bills if b.payment_mode == 'CARD')

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


class AISchemaView(APIView):
    """
    AI Endpoint: Returns dynamic database schema (tables, columns, data types, and foreign key references).
    Dynamically queried from PostgreSQL information_schema.
    """
    authentication_classes = [AITokenAuthentication]

    def get(self, request):
        tables_query = """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE'
              AND table_name NOT IN ('django_migrations', 'django_content_type', 'django_session', 'django_admin_log')
            ORDER BY table_name;
        """

        columns_query = """
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position;
        """

        fk_query = """
            SELECT
                kcu.table_name AS from_table,
                kcu.column_name AS from_column,
                ccu.table_name AS to_table,
                ccu.column_name AS to_column
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public';
        """

        with connection.cursor() as cursor:
            if connection.vendor == 'postgresql':
                cursor.execute(tables_query)
                table_names = [row[0] for row in cursor.fetchall()]

                cursor.execute(columns_query)
                columns_data = cursor.fetchall()

                cursor.execute(fk_query)
                fk_data = cursor.fetchall()
            else:
                # SQLite fallback for local development
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'django_%' AND name NOT LIKE 'sqlite_%';")
                table_names = [row[0] for row in cursor.fetchall()]
                columns_data = []
                fk_data = []
                for t in table_names:
                    cursor.execute(f"PRAGMA table_info({t});")
                    for col in cursor.fetchall():
                        columns_data.append((t, col[1], col[2], 'YES' if not col[3] else 'NO'))
                    cursor.execute(f"PRAGMA foreign_key_list({t});")
                    for fk in cursor.fetchall():
                        fk_data.append((t, fk[3], fk[2], fk[4]))

        # Map FKs by (table, column)
        fk_map = {}
        for from_t, from_c, to_t, to_c in fk_data:
            fk_map[(from_t, from_c)] = f"{to_t}.{to_c}"

        # Group columns by table
        table_columns = {t: [] for t in table_names}
        for t_name, c_name, d_type, is_null in columns_data:
            if t_name in table_columns:
                col_obj = {
                    'name': c_name,
                    'type': d_type,
                }
                if is_null == 'YES':
                    col_obj['nullable'] = True
                if (t_name, c_name) in fk_map:
                    col_obj['references'] = fk_map[(t_name, c_name)]
                table_columns[t_name].append(col_obj)

        result = {
            'tables': [
                {
                    'name': t,
                    'columns': table_columns.get(t, []),
                }
                for t in sorted(table_names)
            ]
        }
        return Response(result, status=status.HTTP_200_OK)


class AIRunQueryView(APIView):
    """
    AI Endpoint: Runs raw SQL SELECT queries with strict read-only safety, timeout, and row limits.
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        sql = request.data.get('sql', '').strip()
        if not sql:
            return Response({'error': 'SQL query is required in "sql" field.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Clean query of comments and trailing semicolons
        clean_sql = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)
        clean_sql = re.sub(r'/\*.*?\*/', '', clean_sql, flags=re.DOTALL).strip()

        if clean_sql.endswith(';'):
            clean_sql = clean_sql[:-1].strip()

        # Multi-statement check: disallow semicolons inside statement
        if ';' in clean_sql:
            return Response({'error': 'Multiple SQL statements separated by semicolons are not allowed.'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Strict read-only validation: must start with SELECT, WITH, or EXPLAIN
        upper_sql = clean_sql.upper()
        if not (upper_sql.startswith('SELECT') or upper_sql.startswith('WITH') or upper_sql.startswith('EXPLAIN')):
            return Response({'error': 'Only SELECT queries (including WITH CTEs) are permitted.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check for forbidden destructive keywords
        forbidden_patterns = [
            r'\bINSERT\b', r'\bUPDATE\b', r'\bDELETE\b', r'\bDROP\b', r'\bALTER\b',
            r'\bTRUNCATE\b', r'\bCREATE\b', r'\bGRANT\b', r'\bREVOKE\b', r'\bEXEC\b',
            r'\bEXECUTE\b', r'\bCALL\b', r'\bREPLACE\b', r'\bCOPY\b', r'\bINTO\b'
        ]
        for pattern in forbidden_patterns:
            if re.search(pattern, upper_sql):
                return Response({'error': f'Query contains disallowed keyword matching {pattern}. Only read-only queries are allowed.'}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Execute with safety timeout and limit
        def serialize_cell(val):
            if val is None:
                return None
            if isinstance(val, decimal.Decimal):
                return float(val)
            if isinstance(val, (datetime.date, datetime.datetime, datetime.time)):
                return val.isoformat()
            if isinstance(val, uuid.UUID):
                return str(val)
            return val

        try:
            with connection.cursor() as cursor:
                if connection.vendor == 'postgresql':
                    cursor.execute("SET LOCAL statement_timeout = '10000';")

                cursor.execute(clean_sql)

                if cursor.description is None:
                    return Response({'error': 'Query did not return any result set.'}, status=status.HTTP_400_BAD_REQUEST)

                columns = [col[0] for col in cursor.description]
                max_rows = 500
                raw_rows = cursor.fetchmany(max_rows + 1)

                truncated = len(raw_rows) > max_rows
                returned_rows = raw_rows[:max_rows]

                formatted_rows = [
                    [serialize_cell(cell) for cell in row]
                    for row in returned_rows
                ]

                return Response({
                    'columns': columns,
                    'rows': formatted_rows,
                    'row_count': len(formatted_rows),
                    'truncated': truncated,
                }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'error': f'Database query execution error: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)


class AIContextDailyView(APIView):
    """
    AI Endpoint: Returns daily weather, calendar occasion & holiday metadata,
    and consolidated restaurant footfall metrics. Automatically syncs missing dates.
    """
    authentication_classes = [AITokenAuthentication]

    def get(self, request):
        from apps.reports.models import DailyFootfallContextLog
        from apps.reports.context_capture import DailyContextSyncService
        from django.utils import timezone

        date_str = request.query_params.get('date')
        days_param = request.query_params.get('days')

        today = timezone.localdate() if hasattr(timezone, 'localdate') else datetime.date.today()

        if days_param:
            try:
                days = min(max(int(days_param), 1), 90)
            except ValueError:
                days = 7
            start_date = today - datetime.timedelta(days=days - 1)
            
            # Ensure records exist
            existing_count = DailyFootfallContextLog.objects.filter(date__gte=start_date, date__lte=today).count()
            if existing_count < days:
                DailyContextSyncService.sync_range(start_date, today)

            logs = DailyFootfallContextLog.objects.filter(date__gte=start_date, date__lte=today).order_by('date')
            results = [
                {
                    'date': log.date.strftime('%Y-%m-%d'),
                    'weather': {
                        'condition': log.weather_condition,
                        'code': log.weather_code,
                        'temp_max': float(log.temp_max) if log.temp_max else None,
                        'temp_min': float(log.temp_min) if log.temp_min else None,
                        'temp_avg': float(log.temp_avg) if log.temp_avg else None,
                        'precipitation_mm': float(log.precipitation_mm),
                        'rain_probability': log.rain_probability_percent,
                    },
                    'calendar': {
                        'is_holiday': log.is_holiday,
                        'holiday_name': log.holiday_name,
                        'is_weekend': log.is_weekend,
                        'is_long_weekend': log.is_long_weekend,
                        'is_event_day': log.is_event_day,
                        'event_name': log.event_name,
                        'event_category': log.event_category,
                    },
                    'restaurant_footfall': {
                        'total_bills': log.total_bills,
                        'dine_in_bills': log.dine_in_bills,
                        'takeaway_bills': log.takeaway_bills,
                        'guest_count': log.guest_count,
                        'total_sales': float(log.total_sales),
                        'dine_in_sales': float(log.dine_in_sales),
                        'peak_hour': log.peak_hour,
                        'top_item': log.top_selling_item,
                    },
                    'snapshot_type': log.snapshot_type,
                }
                for log in logs
            ]
            return Response({'count': len(results), 'history': results}, status=status.HTTP_200_OK)

        # Single date lookup
        if date_str:
            try:
                target_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            target_date = today

        log = DailyFootfallContextLog.objects.filter(date=target_date).first()
        if not log:
            log = DailyContextSyncService.sync_single_date(target_date)

        return Response({
            'date': log.date.strftime('%Y-%m-%d'),
            'weather': {
                'condition': log.weather_condition,
                'code': log.weather_code,
                'temp_max': float(log.temp_max) if log.temp_max else None,
                'temp_min': float(log.temp_min) if log.temp_min else None,
                'temp_avg': float(log.temp_avg) if log.temp_avg else None,
                'precipitation_mm': float(log.precipitation_mm),
                'rain_probability': log.rain_probability_percent,
            },
            'calendar': {
                'is_holiday': log.is_holiday,
                'holiday_name': log.holiday_name,
                'is_weekend': log.is_weekend,
                'is_long_weekend': log.is_long_weekend,
                'is_event_day': log.is_event_day,
                'event_name': log.event_name,
                'event_category': log.event_category,
            },
            'restaurant_footfall': {
                'total_bills': log.total_bills,
                'dine_in_bills': log.dine_in_bills,
                'takeaway_bills': log.takeaway_bills,
                'guest_count': log.guest_count,
                'total_sales': float(log.total_sales),
                'dine_in_sales': float(log.dine_in_sales),
                'peak_hour': log.peak_hour,
                'top_item': log.top_selling_item,
            },
            'snapshot_type': log.snapshot_type,
        }, status=status.HTTP_200_OK)


class AIDemandForecastView(APIView):
    """
    AI Endpoint: Returns 7-day upcoming weather forecast + holiday/event impacts
    with predicted footfall multipliers, expected bills, and sales projections.
    """
    authentication_classes = [AITokenAuthentication]

    def get(self, request):
        from apps.reports.context_capture import DailyContextSyncService
        data = DailyContextSyncService.generate_7_day_demand_forecast()
        return Response(data, status=status.HTTP_200_OK)

