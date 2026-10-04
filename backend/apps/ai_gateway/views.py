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


# ─────────────────────────────────────────────────────────────────────────────
# SAFE CRUD VIEWS  — append-only, no bulk ops, no hard delete, full audit log
# ─────────────────────────────────────────────────────────────────────────────

def _ai_audit_log(action: str, model_name: str, record_id, before: dict, after: dict):
    """Write every AI write operation to Django admin log for traceability."""
    try:
        from django.contrib.admin.models import LogEntry, CHANGE
        from django.contrib.contenttypes.models import ContentType
        from django.contrib.auth import get_user_model
        User = get_user_model()
        ai_user = User.objects.filter(is_superuser=True).first()
        ct = ContentType.objects.first()
        if ai_user and ct:
            LogEntry.objects.create(
                user=ai_user,
                content_type=ct,
                object_id=str(record_id),
                object_repr=f'AI:{action}:{model_name}#{record_id}',
                action_flag=CHANGE,
                change_message=f'AI action={action} | before={before} | after={after}',
            )
    except Exception:
        pass  # audit failure must never block the operation


class AICancelBillView(APIView):
    """
    AI CRUD — Cancel a single bill by ID.

    Safety rules:
    • Requires explicit bill_id (no bulk cancel possible)
    • Only RUNNING or BILLED bills can be cancelled
    • NO hard delete — only status = CANCELLED, all data preserved
    • Full audit log written
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        bill_id = request.data.get('bill_id')
        reason = (request.data.get('reason') or 'Cancelled via AI assistant').strip()

        if not bill_id:
            return Response(
                {'error': 'bill_id is required. Provide the exact integer ID of the bill to cancel.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            bill_id = int(bill_id)
        except (ValueError, TypeError):
            return Response({'error': 'bill_id must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bill = Bill.objects.select_related('order').get(pk=bill_id)
        except Bill.DoesNotExist:
            return Response({'error': f'Bill #{bill_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        if bill.status == 'PAID':
            return Response(
                {'error': f'Bill #{bill_id} is already PAID and cannot be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if bill.status == 'CANCELLED':
            return Response(
                {'error': f'Bill #{bill_id} is already CANCELLED.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        before = {'status': bill.status, 'net_payable': str(bill.net_payable)}

        # Only update status field — all other data stays intact
        bill.status = 'CANCELLED'
        bill.save(update_fields=['status'])

        if bill.order:
            bill.order.status = 'CANCELLED'
            bill.order.save(update_fields=['status'])

        after = {'status': 'CANCELLED', 'reason': reason}
        _ai_audit_log('cancel_bill', 'bill', bill_id, before, after)

        return Response({
            'success': True,
            'message': f'Bill #{bill_id} has been cancelled successfully.',
            'bill_id': bill_id,
            'previous_status': before['status'],
            'new_status': 'CANCELLED',
            'reason': reason,
        }, status=status.HTTP_200_OK)


class AIToggleMenuItemView(APIView):
    """
    AI CRUD — Toggle a menu item available / unavailable (out-of-stock).

    Safety rules:
    • Requires explicit item_id (no bulk toggle)
    • Only flips is_available boolean — zero other fields touched
    • Audit log written
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        item_id = request.data.get('item_id')
        available = request.data.get('available')

        if item_id is None:
            return Response({'error': 'item_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if available is None:
            return Response({'error': '"available" (true/false) is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item_id = int(item_id)
        except (ValueError, TypeError):
            return Response({'error': 'item_id must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        if not isinstance(available, bool):
            available = str(available).lower() in ('true', '1', 'yes')

        try:
            item = MenuItem.objects.get(pk=item_id)
        except MenuItem.DoesNotExist:
            return Response({'error': f'MenuItem #{item_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        before = {'is_available': item.is_available}
        item.is_available = available
        item.save(update_fields=['is_available'])
        after = {'is_available': available}
        _ai_audit_log('toggle_availability', 'menuitem', item_id, before, after)

        return Response({
            'success': True,
            'message': f'"{item.name}" is now {"AVAILABLE ✅" if available else "UNAVAILABLE ❌"}.',
            'item_id': item_id,
            'item_name': item.name,
            'previous_availability': before['is_available'],
            'new_availability': available,
        }, status=status.HTTP_200_OK)


class AIUpdateMenuPriceView(APIView):
    """
    AI CRUD — Update the price of a specific portion (variant) of a menu item.

    Safety rules:
    • Requires explicit portion_id (no bulk price change)
    • new_price must be > 0 and <= 1,00,000
    • Only price field updated — nothing else
    • Old price preserved in audit log
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        from apps.menu.models import Portion
        portion_id = request.data.get('portion_id')
        new_price = request.data.get('new_price')

        if portion_id is None:
            return Response(
                {'error': 'portion_id is required. Use run_sql_query to find the right portion_id from menu_portions table.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_price is None:
            return Response({'error': 'new_price is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            portion_id = int(portion_id)
            new_price = float(new_price)
        except (ValueError, TypeError):
            return Response({'error': 'portion_id must be integer and new_price must be a number.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_price <= 0:
            return Response({'error': 'new_price must be greater than 0.'}, status=status.HTTP_400_BAD_REQUEST)
        if new_price > 100000:
            return Response(
                {'error': 'new_price > ₹1,00,000 seems wrong. Please double-check the value.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            portion = Portion.objects.select_related('item').get(pk=portion_id)
        except Portion.DoesNotExist:
            return Response({'error': f'Portion #{portion_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        before = {'price': str(portion.price)}
        portion.price = new_price
        portion.save(update_fields=['price'])
        after = {'price': str(new_price)}
        _ai_audit_log('update_price', 'portion', portion_id, before, after)

        return Response({
            'success': True,
            'message': f'Price of "{portion.item.name} ({portion.label})" updated: ₹{before["price"]} → ₹{new_price}.',
            'portion_id': portion_id,
            'item_name': portion.item.name,
            'portion_label': portion.label,
            'old_price': before['price'],
            'new_price': str(new_price),
        }, status=status.HTTP_200_OK)


class AIUpdateCustomerView(APIView):
    """
    AI CRUD — Update a customer's name or phone number.

    Safety rules:
    • Requires explicit customer_id (no bulk update)
    • Only name / phone fields allowed — loyalty points, history untouched
    • No delete endpoint exists
    • Audit log written
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        customer_id = request.data.get('customer_id')
        name = (request.data.get('name') or '').strip()
        phone = (request.data.get('phone') or '').strip()

        if not customer_id:
            return Response({'error': 'customer_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not name and not phone:
            return Response(
                {'error': 'Provide at least one field to update: name or phone.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            customer_id = int(customer_id)
        except (ValueError, TypeError):
            return Response({'error': 'customer_id must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer = Customer.objects.get(pk=customer_id)
        except Customer.DoesNotExist:
            return Response({'error': f'Customer #{customer_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        before = {'name': customer.name, 'phone': customer.phone}
        update_fields = []

        if name:
            customer.name = name
            update_fields.append('name')
        if phone:
            if not re.match(r'^\+?[\d\s\-]{7,15}$', phone):
                return Response({'error': 'Phone number format is invalid.'}, status=status.HTTP_400_BAD_REQUEST)
            customer.phone = phone
            update_fields.append('phone')

        customer.save(update_fields=update_fields)
        after = {'name': customer.name, 'phone': customer.phone}
        _ai_audit_log('update_customer', 'customer', customer_id, before, after)

        return Response({
            'success': True,
            'message': f'Customer #{customer_id} updated successfully.',
            'customer_id': customer_id,
            'before': before,
            'after': after,
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# FLOOR MAP — Full Table & Order Control via AI/MCP
# ─────────────────────────────────────────────────────────────────────────────

class AIGetAllTablesView(APIView):
    """AI READ — All active tables with live status + running order summary."""
    authentication_classes = [AITokenAuthentication]

    def get(self, request):
        from apps.tables.models import RestaurantTable
        from apps.billing.models import Order, OPEN_STATUSES
        from django.db.models import Prefetch

        open_orders_qs = Order.objects.filter(status__in=OPEN_STATUSES).prefetch_related('items')
        tables = RestaurantTable.objects.filter(is_active=True).prefetch_related(
            Prefetch('orders', queryset=open_orders_qs, to_attr='_open_orders')
        ).order_by('number')

        result = []
        for t in tables:
            open_order = t._open_orders[0] if t._open_orders else None
            bill_info = None
            if open_order:
                try:
                    b = open_order.bill
                    bill_info = {'bill_id': b.id, 'bill_number': b.bill_number,
                                 'net_payable': str(b.net_payable), 'status': b.status}
                except Exception:
                    pass

            result.append({
                'table_id': t.id, 'number': t.number, 'label': t.label,
                'seats': t.seats, 'shape': t.shape, 'status': t.status,
                'running_order': {
                    'order_id': open_order.id,
                    'order_status': open_order.status,
                    'item_count': open_order.items.count(),
                    'items': [{'item_id': i.id, 'name': i.item_name, 'portion': i.portion,
                                'qty': i.quantity, 'line_total': str(i.line_total)}
                               for i in open_order.items.all()],
                    'bill': bill_info,
                } if open_order else None,
            })

        return Response({
            'summary': {
                'total': len(result),
                'available': sum(1 for t in result if t['status'] == 'AVAILABLE'),
                'occupied': sum(1 for t in result if t['status'] == 'OCCUPIED'),
                'billed': sum(1 for t in result if t['status'] == 'BILLED'),
            },
            'tables': result,
        }, status=status.HTTP_200_OK)


class AIGetTableDetailView(APIView):
    """AI READ — Full detail for one table. Pass ?number=1 or ?table_id=5."""
    authentication_classes = [AITokenAuthentication]

    def get(self, request):
        from apps.tables.models import RestaurantTable
        from apps.billing.models import Order, OPEN_STATUSES

        number = request.query_params.get('number')
        table_id = request.query_params.get('table_id')
        if not number and not table_id:
            return Response({'error': 'Provide number or table_id.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            table = RestaurantTable.objects.get(pk=int(table_id), is_active=True) if table_id \
                else RestaurantTable.objects.get(number=str(number), is_active=True)
        except RestaurantTable.DoesNotExist:
            return Response({'error': 'Table not found.'}, status=status.HTTP_404_NOT_FOUND)

        open_orders = Order.objects.filter(table=table, status__in=OPEN_STATUSES).prefetch_related('items').order_by('-created_at')
        orders_data = []
        for o in open_orders:
            bill_info = None
            try:
                b = o.bill
                bill_info = {'bill_id': b.id, 'bill_number': b.bill_number,
                             'subtotal': str(b.subtotal), 'net_payable': str(b.net_payable),
                             'status': b.status, 'payment_mode': b.payment_mode}
            except Exception:
                pass
            orders_data.append({
                'order_id': o.id, 'status': o.status,
                'items': [{'item_id': i.id, 'name': i.item_name, 'portion': i.portion,
                            'qty': i.quantity, 'unit_price': str(i.unit_price),
                            'line_total': str(i.line_total), 'note': i.note}
                           for i in o.items.all()],
                'bill': bill_info,
            })

        return Response({
            'table_id': table.id, 'number': table.number, 'label': table.label,
            'seats': table.seats, 'status': table.status, 'orders': orders_data,
        }, status=status.HTTP_200_OK)


class AIUpdateTableStatusView(APIView):
    """
    AI WRITE — Override a table status (AVAILABLE / OCCUPIED / BILLED).
    Safety: ID required, only status field updated, audit logged.
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        from apps.tables.models import RestaurantTable
        ALLOWED = ('AVAILABLE', 'OCCUPIED', 'BILLED')
        table_id = request.data.get('table_id')
        number = request.data.get('number')
        new_status = (request.data.get('status') or '').upper()

        if not table_id and not number:
            return Response({'error': 'Provide table_id or number.'}, status=status.HTTP_400_BAD_REQUEST)
        if new_status not in ALLOWED:
            return Response({'error': f'status must be one of {ALLOWED}.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            table = RestaurantTable.objects.get(pk=int(table_id), is_active=True) if table_id \
                else RestaurantTable.objects.get(number=str(number), is_active=True)
        except RestaurantTable.DoesNotExist:
            return Response({'error': 'Table not found.'}, status=status.HTTP_404_NOT_FOUND)

        before = {'status': table.status}
        table.status = new_status
        table.save(update_fields=['status'])
        _ai_audit_log('update_table_status', 'restauranttable', table.id, before, {'status': new_status})

        return Response({
            'success': True,
            'message': f'Table {table.number}: {before["status"]} → {new_status}.',
            'table_id': table.id, 'number': table.number,
            'previous_status': before['status'], 'new_status': new_status,
        }, status=status.HTTP_200_OK)


class AIAddItemToOrderView(APIView):
    """
    AI WRITE — Add a menu item to a table's running order.
    Safety: table ID + item required, quantity 1-50, item must be available, audit logged.
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        from apps.tables.models import RestaurantTable
        from apps.billing.models import Order, OrderItem, OPEN_STATUSES
        from apps.menu.models import MenuItemVariant

        table_id = request.data.get('table_id')
        number = request.data.get('number')
        item_name = (request.data.get('item_name') or '').strip()
        variant_id = request.data.get('variant_id')
        portion = (request.data.get('portion') or 'FULL').upper()
        note = (request.data.get('note') or '').strip()

        try:
            quantity = max(1, min(50, int(request.data.get('quantity', 1))))
        except (ValueError, TypeError):
            return Response({'error': 'quantity must be integer 1–50.'}, status=status.HTTP_400_BAD_REQUEST)

        if not table_id and not number:
            return Response({'error': 'Provide table_id or number.'}, status=status.HTTP_400_BAD_REQUEST)
        if not item_name and not variant_id:
            return Response({'error': 'Provide item_name or variant_id.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            table = RestaurantTable.objects.get(pk=int(table_id), is_active=True) if table_id \
                else RestaurantTable.objects.get(number=str(number), is_active=True)
        except RestaurantTable.DoesNotExist:
            return Response({'error': 'Table not found.'}, status=status.HTTP_404_NOT_FOUND)

        order = Order.objects.filter(table=table, status__in=OPEN_STATUSES).order_by('-created_at').first()
        if not order:
            from django.contrib.auth import get_user_model
            from apps.tables.models import TableStatus
            User = get_user_model()
            ai_user = User.objects.filter(is_superuser=True, is_active=True).first() or User.objects.filter(is_active=True).first()
            order = Order.objects.create(
                order_type='DINE_IN',
                table=table,
                status='RUNNING',
                created_by=ai_user,
            )
            table.mark(TableStatus.OCCUPIED)

        if variant_id:
            try:
                variant = MenuItemVariant.objects.select_related('item').get(pk=int(variant_id))
            except MenuItemVariant.DoesNotExist:
                return Response({'error': f'Variant #{variant_id} not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            variant = MenuItemVariant.objects.select_related('item').filter(
                item__name__icontains=item_name, item__is_available=True, portion=portion
            ).first() or MenuItemVariant.objects.select_related('item').filter(
                item__name__icontains=item_name, item__is_available=True
            ).first()
            if not variant:
                return Response({'error': f'"{item_name}" not found or unavailable.'}, status=status.HTTP_404_NOT_FOUND)

        if not variant.item.is_available:
            return Response({'error': f'"{variant.item.name}" is currently unavailable.'}, status=status.HTTP_400_BAD_REQUEST)

        oi = OrderItem.objects.create(
            order=order, variant=variant,
            item_name=variant.item.name, portion=variant.portion,
            food_type=variant.item.food_type, unit_price=variant.price,
            quantity=quantity, note=note,
        )
        _ai_audit_log('add_item_to_order', 'orderitem', oi.id, {},
                      {'order_id': order.id, 'item': variant.item.name, 'qty': quantity})

        return Response({
            'success': True,
            'message': f'Added {quantity}x "{variant.item.name} ({variant.portion})" to Table {table.number}.',
            'order_item_id': oi.id, 'order_id': order.id,
            'item_name': variant.item.name, 'portion': variant.portion,
            'unit_price': str(variant.price), 'quantity': quantity,
            'line_total': str(oi.line_total),
        }, status=status.HTTP_201_CREATED)


class AIRemoveItemFromOrderView(APIView):
    """
    AI WRITE — Remove one OrderItem by ID.
    Safety: explicit order_item_id required, only works on RUNNING/BILLED orders, audit logged.
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        from apps.billing.models import OrderItem, OPEN_STATUSES

        order_item_id = request.data.get('order_item_id')
        if not order_item_id:
            return Response({'error': 'order_item_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            order_item_id = int(order_item_id)
        except (ValueError, TypeError):
            return Response({'error': 'order_item_id must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item = OrderItem.objects.select_related('order').get(pk=order_item_id)
        except OrderItem.DoesNotExist:
            return Response({'error': f'OrderItem #{order_item_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        if item.order.status not in OPEN_STATUSES:
            return Response({'error': f'Order is already {item.order.status} — cannot edit.'}, status=status.HTTP_400_BAD_REQUEST)

        before = {'item_name': item.item_name, 'portion': item.portion,
                  'qty': item.quantity, 'order_id': item.order.id}
        _ai_audit_log('remove_order_item', 'orderitem', order_item_id, before, {'deleted': True})
        item.delete()

        return Response({
            'success': True,
            'message': f'Removed "{before["item_name"]} ({before["portion"]}) x{before["qty"]}" from Order #{before["order_id"]}.',
            'removed': before,
        }, status=status.HTTP_200_OK)


# ── TABLE MANAGEMENT ENDPOINTS ──────────────────────────────────────────

class AICreateTableView(APIView):
    """
    AI WRITE — Create a new restaurant table.
    Safety: Unique table number validation, audit logged.
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        from apps.tables.models import RestaurantTable, TableShape

        number = str(request.data.get('number', '')).strip()
        if not number:
            return Response({'error': 'number is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if RestaurantTable.objects.filter(number=number).exists():
            return Response({'error': f'Table number "{number}" already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            seats = max(1, min(50, int(request.data.get('seats', 4))))
        except (ValueError, TypeError):
            return Response({'error': 'seats must be an integer (1-50).'}, status=status.HTTP_400_BAD_REQUEST)

        label = str(request.data.get('label', request.data.get('section', 'Main Dining'))).strip()
        shape = str(request.data.get('shape', 'SQUARE')).upper()
        if shape not in ('SQUARE', 'ROUND', 'RECT'):
            shape = 'SQUARE'

        pos_x = int(request.data.get('pos_x', 0))
        pos_y = int(request.data.get('pos_y', 0))
        is_active = bool(request.data.get('is_active', True))

        table = RestaurantTable.objects.create(
            number=number,
            label=label,
            seats=seats,
            shape=shape,
            pos_x=max(0, pos_x),
            pos_y=max(0, pos_y),
            is_active=is_active,
        )

        _ai_audit_log('create_table', 'restauranttable', table.id, {}, {
            'number': table.number, 'seats': table.seats, 'label': table.label, 'shape': table.shape
        })

        return Response({
            'success': True,
            'message': f'Created Table {table.number} ({table.seats} seats, {table.label}).',
            'table': {
                'id': table.id,
                'number': table.number,
                'label': table.label,
                'seats': table.seats,
                'shape': table.shape,
                'status': table.status,
                'pos_x': table.pos_x,
                'pos_y': table.pos_y,
                'is_active': table.is_active,
            }
        }, status=status.HTTP_201_CREATED)


class AIUpdateTableView(APIView):
    """
    AI WRITE — Update an existing table's properties (seats, section, shape, active, coordinates).
    Safety: Table must exist, audit logged.
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        from apps.tables.models import RestaurantTable

        table_id = request.data.get('table_id')
        number = request.data.get('number')

        if not table_id and not number:
            return Response({'error': 'Provide table_id or number.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            table = RestaurantTable.objects.get(pk=int(table_id)) if table_id \
                else RestaurantTable.objects.get(number=str(number))
        except RestaurantTable.DoesNotExist:
            return Response({'error': 'Table not found.'}, status=status.HTTP_404_NOT_FOUND)

        before = {
            'number': table.number, 'label': table.label, 'seats': table.seats,
            'shape': table.shape, 'pos_x': table.pos_x, 'pos_y': table.pos_y,
            'is_active': table.is_active,
        }
        after = {}

        new_number = request.data.get('new_number')
        if new_number:
            new_num_str = str(new_number).strip()
            if new_num_str != table.number and RestaurantTable.objects.filter(number=new_num_str).exists():
                return Response({'error': f'Table number "{new_num_str}" already in use.'}, status=status.HTTP_400_BAD_REQUEST)
            table.number = new_num_str
            after['number'] = new_num_str

        if 'label' in request.data or 'section' in request.data:
            table.label = str(request.data.get('label', request.data.get('section', ''))).strip()
            after['label'] = table.label

        if 'seats' in request.data:
            try:
                table.seats = max(1, min(50, int(request.data['seats'])))
                after['seats'] = table.seats
            except (ValueError, TypeError):
                pass

        if 'shape' in request.data:
            sh = str(request.data['shape']).upper()
            if sh in ('SQUARE', 'ROUND', 'RECT'):
                table.shape = sh
                after['shape'] = table.shape

        if 'is_active' in request.data:
            table.is_active = bool(request.data['is_active'])
            after['is_active'] = table.is_active

        if 'pos_x' in request.data:
            table.pos_x = max(0, int(request.data['pos_x']))
            after['pos_x'] = table.pos_x

        if 'pos_y' in request.data:
            table.pos_y = max(0, int(request.data['pos_y']))
            after['pos_y'] = table.pos_y

        table.save()
        _ai_audit_log('update_table', 'restauranttable', table.id, before, after)

        return Response({
            'success': True,
            'message': f'Updated Table {table.number}.',
            'table': {
                'id': table.id,
                'number': table.number,
                'label': table.label,
                'seats': table.seats,
                'shape': table.shape,
                'status': table.status,
                'pos_x': table.pos_x,
                'pos_y': table.pos_y,
                'is_active': table.is_active,
            }
        }, status=status.HTTP_200_OK)


class AIDeleteTableView(APIView):
    """
    AI WRITE — Delete or deactivate a table.
    Safety: Prevents deletion if table has an active running order or open bill.
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        from apps.tables.models import RestaurantTable
        from apps.billing.models import OPEN_STATUSES

        table_id = request.data.get('table_id')
        number = request.data.get('number')
        deactivate_only = bool(request.data.get('deactivate_only', False))

        if not table_id and not number:
            return Response({'error': 'Provide table_id or number.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            table = RestaurantTable.objects.get(pk=int(table_id)) if table_id \
                else RestaurantTable.objects.get(number=str(number))
        except RestaurantTable.DoesNotExist:
            return Response({'error': 'Table not found.'}, status=status.HTTP_404_NOT_FOUND)

        if table.orders.filter(status__in=OPEN_STATUSES).exists():
            return Response({
                'error': f'Cannot delete Table {table.number} because it has an active running order or open bill. Please settle or void the order first.'
            }, status=status.HTTP_400_BAD_REQUEST)

        info = {'id': table.id, 'number': table.number, 'label': table.label}

        if deactivate_only:
            table.is_active = False
            table.save(update_fields=['is_active'])
            _ai_audit_log('deactivate_table', 'restauranttable', table.id, {'is_active': True}, {'is_active': False})
            return Response({'success': True, 'message': f'Table {table.number} marked inactive.', 'table': info})

        _ai_audit_log('delete_table', 'restauranttable', table.id, info, {'deleted': True})
        table.delete()

        return Response({'success': True, 'message': f'Table {info["number"]} deleted successfully.', 'deleted_table': info})


class AIRearrangeTablesView(APIView):
    """
    AI WRITE — Reposition multiple tables on the visual floor layout.
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        from apps.tables.models import RestaurantTable

        layout = request.data.get('layout') or request.data.get('tables')
        if not layout or not isinstance(layout, list):
            return Response({'error': 'Provide a layout array: [{"number" or "table_id", "pos_x", "pos_y"}]'}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = 0
        for entry in layout:
            tid = entry.get('table_id') or entry.get('id')
            num = entry.get('number')
            try:
                t = RestaurantTable.objects.get(pk=int(tid)) if tid else RestaurantTable.objects.get(number=str(num))
                if 'pos_x' in entry:
                    t.pos_x = max(0, int(entry['pos_x']))
                if 'pos_y' in entry:
                    t.pos_y = max(0, int(entry['pos_y']))
                t.save(update_fields=['pos_x', 'pos_y'])
                updated_count += 1
            except RestaurantTable.DoesNotExist:
                continue

        _ai_audit_log('rearrange_tables', 'restauranttable', 0, {}, {'count': updated_count})
        return Response({'success': True, 'message': f'Successfully updated layout for {updated_count} tables.', 'updated_count': updated_count})


class AIBulkCreateTablesView(APIView):
    """
    AI WRITE — Bulk generate tables on the floor map.
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        from apps.tables.models import RestaurantTable

        try:
            count = max(1, min(100, int(request.data.get('count', 5))))
            seats = max(1, min(30, int(request.data.get('seats', 4))))
            start_from = max(1, int(request.data.get('start_from', 1)))
        except (ValueError, TypeError):
            return Response({'error': 'count, seats, and start_from must be valid integers.'}, status=status.HTTP_400_BAD_REQUEST)

        label = str(request.data.get('label', request.data.get('section', 'Main Dining'))).strip()
        shape = str(request.data.get('shape', 'SQUARE')).upper()
        if shape not in ('SQUARE', 'ROUND', 'RECT'):
            shape = 'SQUARE'

        taken_numbers = set(RestaurantTable.objects.values_list('number', flat=True))
        taken_cells = set(RestaurantTable.objects.values_list('pos_x', 'pos_y'))

        cols = 6
        new_tables = []
        cursor = len(taken_cells)
        num = start_from

        while len(new_tables) < count:
            while str(num) in taken_numbers:
                num += 1
            x, y = cursor % cols, cursor // cols
            while (x, y) in taken_cells:
                cursor += 1
                x, y = cursor % cols, cursor // cols

            taken_cells.add((x, y))
            taken_numbers.add(str(num))
            new_tables.append(RestaurantTable(
                number=str(num), seats=seats, label=label, shape=shape, pos_x=x, pos_y=y
            ))
            num += 1
            cursor += 1

        RestaurantTable.objects.bulk_create(new_tables)
        _ai_audit_log('bulk_create_tables', 'restauranttable', 0, {}, {'count': len(new_tables), 'label': label})

        return Response({
            'success': True,
            'message': f'Bulk created {len(new_tables)} tables in section "{label}".',
            'created_count': len(new_tables),
        }, status=status.HTTP_201_CREATED)


class AITransferTableOrderView(APIView):
    """
    AI WRITE — Move an active order from source table to an available target table.
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        from apps.tables.models import RestaurantTable, TableStatus
        from apps.billing.models import OPEN_STATUSES

        src_val = request.data.get('source_table') or request.data.get('from_table')
        tgt_val = request.data.get('target_table') or request.data.get('to_table')

        if not src_val or not tgt_val:
            return Response({'error': 'source_table and target_table are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            source = RestaurantTable.objects.get(pk=int(src_val)) if str(src_val).isdigit() \
                else RestaurantTable.objects.get(number=str(src_val))
        except RestaurantTable.DoesNotExist:
            return Response({'error': f'Source table "{src_val}" not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            target = RestaurantTable.objects.get(pk=int(tgt_val)) if str(tgt_val).isdigit() \
                else RestaurantTable.objects.get(number=str(tgt_val))
        except RestaurantTable.DoesNotExist:
            return Response({'error': f'Target table "{tgt_val}" not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not target.is_active:
            return Response({'error': f'Target Table {target.number} is inactive.'}, status=status.HTTP_400_BAD_REQUEST)

        if target.status != 'AVAILABLE':
            return Response({'error': f'Target Table {target.number} is not AVAILABLE (currently {target.status}).'}, status=status.HTTP_400_BAD_REQUEST)

        open_orders = source.orders.filter(status__in=OPEN_STATUSES)
        if not open_orders.exists():
            return Response({'error': f'Source Table {source.number} has no active order to transfer.'}, status=status.HTTP_400_BAD_REQUEST)

        open_orders.update(table=target)
        target.mark(source.status)
        source.mark(TableStatus.AVAILABLE)

        _ai_audit_log('transfer_table_order', 'restauranttable', source.id,
                      {'from': source.number, 'status': source.status},
                      {'to': target.number})

        return Response({
            'success': True,
            'message': f'Transferred order from Table {source.number} to Table {target.number}.',
            'from_table': source.number,
            'to_table': target.number,
        }, status=status.HTTP_200_OK)


class AIGetOpenOrdersView(APIView):
    """
    AI READ — Retrieve all active open orders (Dine-In and Takeaway).
    Allows AI/cashier to inspect what orders need to be settled.
    """
    authentication_classes = [AITokenAuthentication]

    def get(self, request):
        from apps.billing.models import Order, OPEN_STATUSES

        order_type = request.query_params.get('order_type')
        table_number = request.query_params.get('table_number')

        qs = Order.objects.filter(status__in=OPEN_STATUSES).select_related('table', 'bill', 'created_by').prefetch_related('items')

        if order_type:
            qs = qs.filter(order_type=order_type.upper())
        if table_number:
            qs = qs.filter(table__number=str(table_number))

        qs = qs.order_by('-created_at')

        orders_data = []
        for o in qs:
            orders_data.append({
                'order_id': o.id,
                'order_type': o.order_type,
                'status': o.status,
                'table_number': o.table.number if o.table else None,
                'table_label': o.table.label if o.table else None,
                'tag_name': o.tag_name or None,
                'subtotal': str(o.subtotal),
                'item_count': o.item_count,
                'items': [
                    {
                        'id': it.id,
                        'name': it.item_name,
                        'portion': it.portion,
                        'quantity': it.quantity,
                        'unit_price': str(it.unit_price),
                        'line_total': str(it.line_total),
                        'note': it.note,
                    }
                    for it in o.items.all()
                ],
                'bill': {
                    'bill_id': o.bill.id,
                    'bill_number': o.bill.bill_number,
                    'status': o.bill.status,
                    'net_payable': str(o.bill.net_payable),
                } if hasattr(o, 'bill') and o.bill else None,
                'created_at': o.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            })

        return Response({
            'count': len(orders_data),
            'orders': orders_data,
        }, status=status.HTTP_200_OK)


class AISettleOrderView(APIView):
    """
    AI WRITE — Settle and complete a Dine-In or Takeaway order.
    Safety:
    • Resolves open order via table_number, order_id, bill_id, or tag_name.
    • Computes bill totals if not yet billed, saves bill snapshot.
    • Marks bill & order as PAID.
    • Releases table back to AVAILABLE if Dine-In.
    • Records customer visits and loyalty points.
    • Triggers WhatsApp bill receipt / feedback link if enabled.
    • Full audit log written.
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        from apps.billing.models import (
            Order, Bill, OrderStatus, BillStatus, PaymentMode,
            OPEN_STATUSES,
        )
        from apps.tables.models import RestaurantTable, TableStatus
        from apps.customers.models import Customer, LoyaltyTransaction, LoyaltyReason
        from apps.settings_app.models import RestaurantSettings
        from apps.billing.services import compute_totals
        from django.contrib.auth import get_user_model
        from django.utils import timezone
        from django.db import transaction
        from decimal import Decimal

        table_number = request.data.get('table_number') or request.data.get('table')
        order_id = request.data.get('order_id')
        bill_id = request.data.get('bill_id')
        bill_number = request.data.get('bill_number')
        tag_name = request.data.get('tag_name') or request.data.get('tag')

        payment_mode_input = str(request.data.get('payment_mode') or 'CASH').strip().upper()
        valid_modes = [c[0] for c in PaymentMode.choices]
        payment_mode = payment_mode_input if payment_mode_input in valid_modes else PaymentMode.CASH

        try:
            discount_percent = Decimal(str(request.data.get('discount_percent', 0)))
        except Exception:
            discount_percent = Decimal('0.00')

        try:
            redeem_points = int(request.data.get('redeem_points', 0))
        except Exception:
            redeem_points = 0

        customer_phone = (request.data.get('customer_phone') or '').strip()
        customer_name = (request.data.get('customer_name') or '').strip()

        order = None
        bill = None

        if bill_id or bill_number:
            try:
                b_qs = Bill.objects.select_related('order', 'order__table', 'customer')
                bill = b_qs.get(pk=int(bill_id)) if bill_id else b_qs.get(bill_number=str(bill_number).strip())
                order = bill.order
            except Bill.DoesNotExist:
                return Response({'error': f'Bill "{bill_id or bill_number}" not found.'}, status=status.HTTP_404_NOT_FOUND)

        elif order_id:
            try:
                order = Order.objects.select_related('table').get(pk=int(order_id))
                if hasattr(order, 'bill'):
                    bill = order.bill
            except Order.DoesNotExist:
                return Response({'error': f'Order #{order_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        elif table_number:
            try:
                table = RestaurantTable.objects.get(number=str(table_number))
            except RestaurantTable.DoesNotExist:
                return Response({'error': f'Table "{table_number}" not found.'}, status=status.HTTP_404_NOT_FOUND)

            order = Order.objects.filter(table=table, status__in=OPEN_STATUSES).select_related('table').order_by('-created_at').first()
            if not order:
                return Response({
                    'error': f'Table {table.number} has no active open order to settle (current table status: {table.status}).'
                }, status=status.HTTP_400_BAD_REQUEST)
            if hasattr(order, 'bill'):
                bill = order.bill

        elif tag_name:
            order = Order.objects.filter(tag_name__iexact=str(tag_name).strip(), status__in=OPEN_STATUSES).select_related('table').order_by('-created_at').first()
            if not order:
                return Response({
                    'error': f'No open order found with tag "{tag_name}".'
                }, status=status.HTTP_400_BAD_REQUEST)
            if hasattr(order, 'bill'):
                bill = order.bill

        else:
            return Response({
                'error': 'Provide table_number, order_id, bill_id, or tag_name to identify the order to settle.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if order.status == OrderStatus.PAID:
            return Response({'error': f'Order #{order.id} is already PAID.'}, status=status.HTTP_400_BAD_REQUEST)
        if order.status == OrderStatus.CANCELLED:
            return Response({'error': f'Order #{order.id} is CANCELLED.'}, status=status.HTTP_400_BAD_REQUEST)

        if not order.items.exists():
            return Response({
                'error': f'Order #{order.id} has no items and cannot be settled.'
            }, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        system_user = User.objects.filter(is_superuser=True, is_active=True).first() or User.objects.filter(is_active=True).first()

        customer = None
        if customer_phone:
            customer, _ = Customer.objects.get_or_create(
                phone=customer_phone,
                defaults={'name': customer_name or f'Guest {customer_phone[-4:]}'}
            )
            if customer_name and customer.name != customer_name:
                customer.name = customer_name
                customer.save(update_fields=['name'])
        elif bill and bill.customer:
            customer = bill.customer
        elif order and order.customer:
            customer = order.customer

        settings_row = RestaurantSettings.load()
        if settings_row.customer_details_mandatory:
            if not customer or not (customer.name or '').strip() or not (customer.phone or '').strip():
                return Response({
                    'error': 'Customer details (Name and 10-digit Phone) are mandatory to settle this bill. Please provide customer_name and customer_phone.'
                }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():

            if not bill:
                totals = compute_totals(
                    subtotal=order.subtotal,
                    discount_percent=discount_percent,
                    settings=settings_row,
                    redeem_points=redeem_points
                )
                bill = Bill.objects.create(
                    order=order,
                    order_type=order.order_type,
                    customer=customer,
                    bill_number=RestaurantSettings.take_bill_number(),
                    subtotal=totals['subtotal'],
                    discount_percent=totals['discount_percent'],
                    discount_amount=totals['discount_amount'],
                    taxable_amount=totals['taxable_amount'],
                    cgst_percent=totals['cgst_percent'],
                    cgst_amount=totals['cgst_amount'],
                    sgst_percent=totals['sgst_percent'],
                    sgst_amount=totals['sgst_amount'],
                    total=totals['total'],
                    points_redeemed=totals['points_redeemed'],
                    redeem_amount=totals['redeem_amount'],
                    net_payable=totals['net_payable'],
                    points_earned=totals['points_earned'] if customer else 0,
                    created_by=system_user,
                    restaurant_name=settings_row.restaurant_name,
                    restaurant_address=settings_row.address,
                    gstin=settings_row.gstin,
                )
                if customer and bill.points_redeemed:
                    LoyaltyTransaction.post(
                        customer,
                        -bill.points_redeemed,
                        LoyaltyReason.REDEEM,
                        bill=bill,
                        note=f'Bill {bill.bill_number}',
                        user=system_user,
                    )
            else:
                if bill.status == BillStatus.PAID:
                    return Response({'error': f'Bill #{bill.bill_number} is already PAID.'}, status=status.HTTP_400_BAD_REQUEST)
                if customer and not bill.customer:
                    bill.customer = customer
                    bill.save(update_fields=['customer'])

            bill.payment_mode = payment_mode
            bill.status = BillStatus.PAID
            bill.paid_at = timezone.now()
            bill.save(update_fields=['payment_mode', 'status', 'paid_at'])

            if bill.customer_id:
                cust = Customer.objects.select_for_update().get(pk=bill.customer_id)
                cust.record_visit(bill.total)
                if bill.points_earned:
                    LoyaltyTransaction.post(
                        cust,
                        bill.points_earned,
                        LoyaltyReason.EARN,
                        bill=bill,
                        note=f'Bill {bill.bill_number}',
                        user=system_user,
                    )

            order.status = OrderStatus.PAID
            order.save(update_fields=['status', 'updated_at'])

            table_freed = False
            table_number_val = None
            if order.table:
                order.table.mark(TableStatus.AVAILABLE)
                table_freed = True
                table_number_val = order.table.number

            try:
                if bill.customer:
                    from apps.whatsapp.models import FeedbackRequest, TriggerType, WhatsAppConfig
                    from apps.whatsapp.services import send_if_enabled

                    send_if_enabled(
                        TriggerType.BILL_RECEIPT,
                        customer=bill.customer,
                        bill=bill,
                        context={
                            'bill_number': bill.bill_number,
                            'bill_amount': str(bill.net_payable),
                            'earned_points': bill.points_earned,
                            'available_points': bill.customer.points_balance,
                        },
                    )

                    feedback_req, _ = FeedbackRequest.objects.get_or_create(
                        customer=bill.customer, bill=bill
                    )
                    wa_config = WhatsAppConfig.load()
                    feedback_link = f"{wa_config.public_base_url.rstrip('/')}/feedback/{feedback_req.token}"
                    send_if_enabled(
                        TriggerType.FEEDBACK,
                        customer=bill.customer,
                        bill=bill,
                        context={'link': feedback_link},
                    )
            except Exception:
                pass

        _ai_audit_log('settle_order', 'bill', bill.id,
                      {'order_id': order.id, 'status': 'OPEN'},
                      {'status': 'PAID', 'payment_mode': payment_mode, 'net_payable': str(bill.net_payable), 'table_freed': table_freed})

        order_identifier = f"Table {table_number_val}" if table_number_val else f"Takeaway Order #{order.id}" + (f" ({order.tag_name})" if order.tag_name else "")

        return Response({
            'success': True,
            'message': f'Successfully settled {order_identifier}! Bill #{bill.bill_number} for ₹{bill.net_payable} marked PAID via {payment_mode}.' + (f' Table {table_number_val} is now AVAILABLE.' if table_freed else ''),
            'order_id': order.id,
            'order_type': order.order_type,
            'bill_id': bill.id,
            'bill_number': bill.bill_number,
            'payment_mode': bill.payment_mode,
            'subtotal': str(bill.subtotal),
            'discount_amount': str(bill.discount_amount),
            'taxable_amount': str(bill.taxable_amount),
            'gst_amount': str(bill.cgst_amount + bill.sgst_amount),
            'total': str(bill.total),
            'net_payable': str(bill.net_payable),
            'table_freed': table_freed,
            'table_number': table_number_val,
            'customer': {
                'id': bill.customer.id,
                'name': bill.customer.name,
                'phone': bill.customer.phone,
                'points_earned': bill.points_earned,
            } if bill.customer else None,
        }, status=status.HTTP_200_OK)


class AIGetSettingsView(APIView):
    """
    AI READ — Get restaurant settings including mandatory customer details status.
    """
    authentication_classes = [AITokenAuthentication]

    def get(self, request):
        from apps.settings_app.models import RestaurantSettings

        settings = RestaurantSettings.load()
        return Response({
            'success': True,
            'restaurant_name': settings.restaurant_name,
            'address': settings.address,
            'phone': settings.phone,
            'gstin': settings.gstin,
            'customer_details_mandatory': settings.customer_details_mandatory,
            'cgst_percent': str(settings.cgst_percent),
            'sgst_percent': str(settings.sgst_percent),
            'max_discount_percent': str(settings.max_discount_percent),
            'loyalty_enabled': settings.loyalty_enabled,
            'bill_prefix': settings.bill_prefix,
            'next_bill_number': settings.next_bill_number,
        })


class AIToggleMandatoryCustomerView(APIView):
    """
    AI WRITE — Enable or disable mandatory customer details for billing.
    Safety:
    • Explicit boolean flag (true/false) or toggle.
    • Audit logged.
    """
    authentication_classes = [AITokenAuthentication]

    def post(self, request):
        from apps.settings_app.models import RestaurantSettings

        settings = RestaurantSettings.load()
        before_val = settings.customer_details_mandatory

        # Accept boolean 'mandatory' or 'customer_details_mandatory' or 'enabled'
        val = request.data.get('mandatory')
        if val is None:
            val = request.data.get('customer_details_mandatory')
        if val is None:
            val = request.data.get('enabled')
        if val is None:
            val = not before_val
        else:
            if isinstance(val, str):
                val = val.strip().lower() in ('true', '1', 'yes', 'on')
            else:
                val = bool(val)

        settings.customer_details_mandatory = val
        settings.save(update_fields=['customer_details_mandatory', 'updated_at'])

        _ai_audit_log(
            'toggle_mandatory_customer_details',
            'restaurantsettings',
            settings.pk,
            {'customer_details_mandatory': before_val},
            {'customer_details_mandatory': val}
        )

        status_str = "MANDATORY (Name & 10-digit Phone compulsory, 'Skip' button hidden on POS & Tables)" if val else "OPTIONAL (Default, 'Skip' button allowed)"
        return Response({
            'success': True,
            'message': f'Customer details setting updated: {status_str}',
            'customer_details_mandatory': settings.customer_details_mandatory,
        })

