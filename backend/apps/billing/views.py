from datetime import timedelta
import csv
from io import StringIO
from django.contrib.auth import authenticate
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.auth_app.models import Role
from apps.auth_app.permissions import IsOwnerOrCashier, HasDynamicPermission, has_perm
from apps.customers.models import Customer, LoyaltyReason, LoyaltyTransaction
from apps.settings_app.models import RestaurantSettings
from apps.tables.models import RestaurantTable, TableStatus

from .models import (
    OPEN_STATUSES,
    Bill,
    BillStatus,
    KOT,
    Order,
    OrderItem,
    OrderStatus,
)
from .serializers import (
    AddOrderItemSerializer,
    AttachCustomerSerializer,
    BillListSerializer,
    BillSerializer,
    CancelBillSerializer,
    GenerateBillSerializer,
    KOTSerializer,
    OpenOrderSerializer,
    OrderItemSerializer,
    OrderSerializer,
    PaySerializer,
    PreviewSerializer,
)
from .services import compute_totals, max_redeemable_points


def _order_queryset():
    return (
        Order.objects.select_related('table', 'created_by', 'bill', 'customer')
        .prefetch_related('items')
    )


# Point counts are whole numbers and the UI does arithmetic on them; money
# stays a string so no rounding sneaks in on the way through JSON.
POINT_KEYS = {'points_redeemed', 'points_earned'}


def _serialise_totals(totals):
    return {k: (v if k in POINT_KEYS else str(v)) for k, v in totals.items()}


def _verify_owner(username, password, message):
    """Shared owner-override check for discounts and refunds."""
    username = (username or '').strip()
    if not username or not password:
        raise ValidationError(message)
    owner = authenticate(username=username, password=password)
    if owner is None or not owner.is_active or not has_perm(owner, 'owner_override'):
        raise ValidationError('Invalid owner username or password.')
    return owner


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    """Running orders. Access depends on 'view_pos' permission."""

    serializer_class = OrderSerializer
    permission_classes = [HasDynamicPermission('view_pos')]
    pagination_class = None

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['settings'] = RestaurantSettings.load()
        return context

    def get_queryset(self):
        qs = _order_queryset()
        if status_filter := self.request.query_params.get('status'):
            qs = qs.filter(status=status_filter)
        if self.request.query_params.get('open') == 'true':
            qs = qs.filter(status__in=OPEN_STATUSES)
        if table := self.request.query_params.get('table'):
            qs = qs.filter(table_id=table)
        return qs

    # ── Opening a table ──────────────────────────────────────────────────
    @action(detail=False, methods=['post'])
    def open(self, request):
        """Return the table's running order, creating one if it has none.

        Idempotent on purpose: a cashier tapping the same table twice must land
        on the same bill, not start a second one.
        """
        serializer = OpenOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        table = RestaurantTable.objects.filter(pk=serializer.validated_data['table']).first()
        if table is None:
            raise ValidationError('Table not found.')
        if not table.is_active:
            raise ValidationError(f'Table {table.number} is currently closed.')

        existing = table.orders.filter(status__in=OPEN_STATUSES).first()
        if existing:
            return Response(self.get_serializer(existing).data)

        try:
            with transaction.atomic():
                order = Order.objects.create(table=table, created_by=request.user)
                # Note: Table remains AVAILABLE until the first KOT is sent.
        except IntegrityError:
            # Lost the race against another cashier — hand back their order.
            order = table.orders.filter(status__in=OPEN_STATUSES).first()

        return Response(self.get_serializer(order).data, status=status.HTTP_201_CREATED)

    # ── Opening a Takeaway order ─────────────────────────────────────────
    @action(detail=False, methods=['post'], url_path='takeaway')
    def takeaway(self, request):
        """Open a new Takeaway / Parcel order without assigning a table."""
        from .models import OrderType
        tag_name = str(request.data.get('tag_name', '')).strip()[:60]
        order = Order.objects.create(
            order_type=OrderType.TAKEAWAY,
            table=None,
            tag_name=tag_name,
            created_by=request.user,
        )
        return Response(self.get_serializer(order).data, status=status.HTTP_201_CREATED)

    # ── Cart operations ──────────────────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='items')
    @transaction.atomic
    def add_item(self, request, pk=None):
        if not has_perm(request.user, 'punch_order'):
            raise ValidationError('You do not have permission to punch orders.')
        order = self._running_order(pk)
        serializer = AddOrderItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        variant = serializer.validated_data.get('variant')
        quantity = serializer.validated_data['quantity']
        note = serializer.validated_data['note']

        if variant:
            item_name = variant.item.name
            portion = variant.portion
            food_type = variant.item.food_type
            unit_price = variant.price
        else:
            from apps.menu.models import Portion
            item_name = serializer.validated_data['custom_name']
            portion = serializer.validated_data.get('portion') or Portion.FULL
            food_type = serializer.validated_data.get('food_type') or 'VEG'
            unit_price = serializer.validated_data['unit_price']

        # Merge into an identical line only while it is still un-sent — once
        # the kitchen has a ticket, the next round has to be its own line.
        line = order.items.filter(
            variant=variant, item_name=item_name, note=note, kot__isnull=True
        ).first()
        if line:
            line.quantity += quantity
            line.save(update_fields=['quantity'])
        else:
            line = OrderItem.objects.create(
                order=order,
                variant=variant,
                item_name=item_name,
                portion=portion,
                food_type=food_type,
                unit_price=unit_price,
                quantity=quantity,
                note=note,
            )

        order.save(update_fields=['updated_at'])
        return Response(OrderItemSerializer(line).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path=r'items/(?P<item_id>\d+)')
    @transaction.atomic
    def update_item(self, request, pk=None, item_id=None):
        if not has_perm(request.user, 'punch_order'):
            raise ValidationError('You do not have permission to modify orders.')
        order = self._running_order(pk)
        line = order.items.filter(pk=item_id).first()
        if line is None:
            raise ValidationError('This item is not part of this order.')

        quantity = request.data.get('quantity')
        target_line = line

        if 'unit_price' in request.data:
            try:
                line.unit_price = Decimal(str(request.data['unit_price']))
            except Exception:
                pass

        if quantity is not None:
            quantity = int(quantity)
            if quantity < 1:
                line.delete()
                order.save(update_fields=['updated_at'])
                return Response(status=status.HTTP_204_NO_CONTENT)

            if line.kot_id is not None and quantity > line.quantity:
                # This item was already sent on a previous KOT ticket.
                # Do not mutate the sent line — add the extra quantity as an unsent item
                # so a new KOT can be printed for the kitchen.
                diff = quantity - line.quantity
                note = str(request.data.get('note', line.note))[:120] if 'note' in request.data else line.note

                unsent_line = order.items.filter(
                    variant=line.variant, note=note, kot__isnull=True
                ).first()
                if unsent_line:
                    unsent_line.quantity += diff
                    if 'unit_price' in request.data:
                        unsent_line.unit_price = line.unit_price
                    unsent_line.save(update_fields=['quantity', 'unit_price'])
                    target_line = unsent_line
                else:
                    target_line = OrderItem.objects.create(
                        order=order,
                        variant=line.variant,
                        item_name=line.item_name,
                        portion=line.portion,
                        food_type=line.food_type,
                        unit_price=line.unit_price,
                        quantity=diff,
                        note=note,
                    )
            else:
                line.quantity = quantity
                if 'note' in request.data:
                    line.note = str(request.data['note'])[:120]
                line.save()
        else:
            if 'note' in request.data:
                line.note = str(request.data['note'])[:120]
            line.save()

        order.save(update_fields=['updated_at'])
        return Response(OrderItemSerializer(target_line).data)

    @action(detail=True, methods=['delete'], url_path=r'items/(?P<item_id>\d+)/remove')
    @transaction.atomic
    def remove_item(self, request, pk=None, item_id=None):
        if not has_perm(request.user, 'punch_order'):
            raise ValidationError('You do not have permission to remove items.')
        order = self._running_order(pk)
        deleted, _ = order.items.filter(pk=item_id).delete()
        if not deleted:
            raise ValidationError('This item is not part of this order.')
        order.save(update_fields=['updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── KOT ──────────────────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def kot(self, request, pk=None):
        """Send everything added since the last ticket to the kitchen."""
        if not has_perm(request.user, 'print_kot'):
            raise ValidationError('You do not have permission to print KOT.')
        order = self._running_order(pk)
        pending = list(order.items.filter(kot__isnull=True))
        if not pending:
            raise ValidationError('No new items to send to kitchen.')

        ticket = KOT.objects.create(
            order=order,
            number=RestaurantSettings.take_kot_number(),
            created_by=request.user,
        )
        OrderItem.objects.filter(pk__in=[line.pk for line in pending]).update(kot=ticket)
        
        # Mark table as occupied only when the first KOT is generated
        if order.table and order.table.status == TableStatus.AVAILABLE:
            order.table.mark(TableStatus.OCCUPIED)

        return Response(
            KOTSerializer(KOT.objects.prefetch_related('items').get(pk=ticket.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    # ── Customer ─────────────────────────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='customer')
    def attach_customer(self, request, pk=None):
        """Link (or unlink) a diner mid-meal so points land on the right person."""
        order = self._running_order(pk)
        serializer = AttachCustomerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer_id = serializer.validated_data['customer']

        if customer_id is None:
            order.customer = None
        else:
            customer = Customer.objects.filter(pk=customer_id, is_active=True).first()
            if customer is None:
                raise ValidationError('Customer not found.')
            order.customer = customer

        order.save(update_fields=['customer', 'updated_at'])
        return Response(self.get_serializer(order).data)

    # ── Bill preview ─────────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def preview(self, request, pk=None):
        """Live totals for a candidate discount — same maths as the real bill."""
        if not has_perm(request.user, 'print_bill'):
            raise ValidationError('You do not have permission to print bills.')
        order = self.get_object()
        serializer = PreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        discount = serializer.validated_data['discount_percent']
        requested_points = serializer.validated_data['redeem_points']

        settings_row = RestaurantSettings.load()
        
        customer_id = serializer.validated_data.get('customer')
        if customer_id:
            customer = Customer.objects.filter(pk=customer_id, is_active=True).first()
        else:
            customer = order.customer

        # Compute the pre-redemption total first — the redeem ceiling is a
        # percentage of it, so it has to exist before points can be capped.
        gross = compute_totals(order.subtotal, discount, settings_row)
        allowed_points = max_redeemable_points(gross['total'], customer, settings_row)
        applied_points = min(requested_points, allowed_points)

        totals = compute_totals(order.subtotal, discount, settings_row, applied_points)
        return Response(
            {
                **_serialise_totals(totals),
                'max_discount_percent': str(settings_row.max_discount_percent),
                'needs_owner_approval': discount > settings_row.max_discount_percent,
                'loyalty_enabled': settings_row.loyalty_enabled,
                'points_balance': customer.points_balance if customer else 0,
                'max_redeemable_points': allowed_points,
                'points_capped': applied_points < requested_points,
                'min_redeem_points': settings_row.loyalty_min_redeem_points,
            }
        )

    # ── Generate bill ────────────────────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='generate-bill')
    @transaction.atomic
    def generate_bill(self, request, pk=None):
        if not has_perm(request.user, 'print_bill'):
            raise ValidationError('You do not have permission to print bills.')
        order = self._running_order(pk)
        if not order.items.exists():
            raise ValidationError('Cannot generate bill for an empty order.')

        serializer = GenerateBillSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        discount = serializer.validated_data['discount_percent']
        requested_points = serializer.validated_data['redeem_points']

        settings_row = RestaurantSettings.load()
        approver = None
        if discount > settings_row.max_discount_percent:
            approver = _verify_owner(
                serializer.validated_data.get('owner_username'),
                serializer.validated_data.get('owner_password'),
                f'Discount above {settings_row.max_discount_percent}% '
                'requires owner authorization.',
            )

        # Lock the customer row before reading the balance — two bills settling
        # at once must not both spend the same points.
        customer_id = serializer.validated_data.get('customer') or order.customer_id
        customer = None
        if customer_id:
            try:
                customer = Customer.objects.select_for_update().get(pk=customer_id, is_active=True)
            except Customer.DoesNotExist:
                pass
            else:
                if order.customer_id != customer.pk:
                    order.customer = customer
                    order.save(update_fields=['customer', 'updated_at'])

        if settings_row.customer_details_mandatory:
            if not customer or not (customer.name or '').strip() or not (customer.phone or '').strip():
                raise ValidationError('Customer details (Name and Phone) are mandatory for billing.')

        gross = compute_totals(order.subtotal, discount, settings_row)
        allowed_points = max_redeemable_points(gross['total'], customer, settings_row)
        if requested_points > allowed_points:
            raise ValidationError(
                f'Maximum {allowed_points} points can be redeemed on this bill.'
            )

        totals = compute_totals(order.subtotal, discount, settings_row, requested_points)
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
            created_by=request.user,
            discount_approved_by=approver,
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
                user=request.user,
            )

        order.status = OrderStatus.BILLED
        order.save(update_fields=['status', 'updated_at'])
        if order.table:
            order.table.mark(TableStatus.BILLED)

        return Response(BillSerializer(bill).data, status=status.HTTP_201_CREATED)

    def _running_order(self, pk):
        """Fetch an order that can still be edited, or explain why it can't."""
        order = _order_queryset().filter(pk=pk).first()
        if order is None:
            raise ValidationError('Order not found.')
        if order.status != OrderStatus.RUNNING:
            raise ValidationError(
                f'This order has been billed ({order.get_status_display()}) and cannot be modified.'
            )
        return order

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def void(self, request, pk=None):
        """Cancel a running order that has no bill yet (e.g. customer walked away).
        
        The table is immediately freed back to AVAILABLE.
        No bill is created — this is a hard delete of the running session.
        """
        if not has_perm(request.user, 'cancel_bill'):
            raise ValidationError('You do not have permission to void orders.')
        order = _order_queryset().filter(pk=pk).first()
        if order is None:
            raise ValidationError({'detail': 'Order not found.'})
        if order.status != OrderStatus.RUNNING:
            raise ValidationError({'detail': f'Only RUNNING orders can be voided (this is {order.status}).'})
        if hasattr(order, 'bill'):
            raise ValidationError({'detail': 'A bill already exists — use cancel bill instead.'})

        order.status = OrderStatus.CANCELLED
        order.save(update_fields=['status', 'updated_at'])

        if order.table:
            # Only free the table if no other open order is still linked to it
            other_open = order.table.orders.filter(status__in=OPEN_STATUSES).exclude(pk=order.pk).exists()
            if not other_open:
                order.table.mark(TableStatus.AVAILABLE)

        return Response({'detail': f'Order #{order.pk} voided. Table is now available.'})


class BillViewSet(viewsets.ReadOnlyModelViewSet):
    """Order history + checkout. Search covers name, phone and bill number."""

    permission_classes = [HasDynamicPermission('view_orders')]

    def get_serializer_class(self):
        return BillListSerializer if self.action == 'list' else BillSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        # Aggregate summary statistics across the entire filtered queryset
        summary_data = queryset.aggregate(
            total_revenue=Sum('net_payable', filter=Q(status=BillStatus.PAID)),
            paid_count=Count('id', filter=Q(status=BillStatus.PAID)),
            unpaid_count=Count('id', filter=Q(status=BillStatus.UNPAID)),
            cancelled_count=Count('id', filter=Q(status=BillStatus.CANCELLED)),
            avg_ticket=Avg('net_payable', filter=Q(status=BillStatus.PAID)),
            total_count=Count('id')
        )

        summary_payload = {
            'total_revenue': float(summary_data['total_revenue'] or 0),
            'paid_count': int(summary_data['paid_count'] or 0),
            'unpaid_count': int(summary_data['unpaid_count'] or 0),
            'cancelled_count': int(summary_data['cancelled_count'] or 0),
            'avg_ticket': round(float(summary_data['avg_ticket'] or 0), 2),
            'total_count': int(summary_data['total_count'] or 0),
        }

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['summary'] = summary_payload
            return response

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'results': serializer.data,
            'summary': summary_payload
        })

    def get_queryset(self):
        qs = Bill.objects.select_related(
            'order__table', 'customer', 'created_by', 'discount_approved_by', 'cancelled_by'
        ).prefetch_related('order__items')

        params = self.request.query_params
        if search := (params.get('search') or '').strip():
            clean_search = search.replace('#', '').replace('TK-', '').replace('tk-', '')
            qs = qs.filter(
                Q(bill_number__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(customer__phone__icontains=search)
                | Q(order__table__number__icontains=search)
                | Q(order__tag_name__icontains=search)
                | Q(order__id__icontains=clean_search)
            )
        if order_type := params.get('order_type'):
            qs = qs.filter(order_type=order_type)
        if status_filter := params.get('status'):
            qs = qs.filter(status=status_filter)
        if mode := params.get('payment_mode'):
            qs = qs.filter(payment_mode=mode)

        # Date Presets Handling: today, yesterday, week, last_week, month, last_month, last_7_days, last_30_days, last_90_days, 6_months, 1_year, custom
        period = params.get('period')
        today = timezone.localdate()

        if period == 'today':
            qs = qs.filter(created_at__date=today)
        elif period == 'yesterday':
            qs = qs.filter(created_at__date=today - timedelta(days=1))
        elif period in ('this_week', 'week'):
            start_of_week = today - timedelta(days=today.weekday())
            qs = qs.filter(created_at__date__gte=start_of_week, created_at__date__lte=today)
        elif period == 'last_week':
            start_of_last_week = today - timedelta(days=today.weekday() + 7)
            end_of_last_week = today - timedelta(days=today.weekday() + 1)
            qs = qs.filter(created_at__date__gte=start_of_last_week, created_at__date__lte=end_of_last_week)
        elif period in ('this_month', 'month'):
            qs = qs.filter(created_at__date__gte=today.replace(day=1), created_at__date__lte=today)
        elif period == 'last_month':
            first_of_this_month = today.replace(day=1)
            last_of_last_month = first_of_this_month - timedelta(days=1)
            first_of_last_month = last_of_last_month.replace(day=1)
            qs = qs.filter(created_at__date__gte=first_of_last_month, created_at__date__lte=last_of_last_month)
        elif period == 'last_7_days':
            qs = qs.filter(created_at__date__gte=today - timedelta(days=7), created_at__date__lte=today)
        elif period == 'last_30_days':
            qs = qs.filter(created_at__date__gte=today - timedelta(days=30), created_at__date__lte=today)
        elif period in ('last_90_days', '3_months'):
            qs = qs.filter(created_at__date__gte=today - timedelta(days=90), created_at__date__lte=today)
        elif period in ('6_months', 'last_6_months'):
            qs = qs.filter(created_at__date__gte=today - timedelta(days=180), created_at__date__lte=today)
        elif period in ('1_year', 'this_year', 'year'):
            qs = qs.filter(created_at__date__gte=today.replace(month=1, day=1), created_at__date__lte=today)
        elif period == 'custom':
            if date_from := params.get('from'):
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to := params.get('to'):
                qs = qs.filter(created_at__date__lte=date_to)
        else:
            if date_from := params.get('from'):
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to := params.get('to'):
                qs = qs.filter(created_at__date__lte=date_to)

        return qs

    @action(detail=False, methods=['get'], permission_classes=[HasDynamicPermission('view_orders')])
    def export_excel(self, request):
        """Export filtered bills to styled Microsoft Excel (.xlsx) spreadsheet."""
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
        from io import BytesIO

        qs = self.get_queryset()

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Order History"

        headers = [
            'Bill #',
            'Date & Time',
            'Order Type',
            'Table / Token',
            'Customer Name',
            'Customer Phone',
            'Subtotal (₹)',
            'Discount %',
            'Discount Amt (₹)',
            'Taxable (₹)',
            'CGST (₹)',
            'SGST (₹)',
            'Total Tax (₹)',
            'Points Redeemed',
            'Net Payable (₹)',
            'Payment Mode',
            'Status',
        ]
        ws.append(headers)

        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        center_align = Alignment(horizontal="center", vertical="center")
        right_align = Alignment(horizontal="right", vertical="center")
        left_align = Alignment(horizontal="left", vertical="center")

        thin_border = Border(
            left=Side(style='thin', color='E2E8F0'),
            right=Side(style='thin', color='E2E8F0'),
            top=Side(style='thin', color='E2E8F0'),
            bottom=Side(style='thin', color='E2E8F0')
        )

        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_align
        ws.row_dimensions[1].height = 26

        total_subtotal = 0.0
        total_discount = 0.0
        total_tax = 0.0
        total_revenue = 0.0
        paid_count = 0

        row_num = 2
        for bill in qs:
            order_type_display = 'Dine-In' if (bill.order_type == 'DINE_IN' or (bill.order and bill.order.order_type == 'DINE_IN')) else 'Takeaway'
            table_token = bill.order.table.number if (bill.order and bill.order.table) else (bill.order.tag_name if bill.order else '')
            cust_name = bill.customer.name if bill.customer else ''
            cust_phone = bill.customer.phone if bill.customer else ''
            created_str = timezone.localtime(bill.created_at).strftime('%Y-%m-%d %H:%M:%S')

            subtotal_val = float(bill.subtotal or 0)
            disc_pct = float(bill.discount_percent or 0)
            disc_amt = float(bill.discount_amount or 0)
            taxable_val = float(bill.taxable_amount or 0)
            cgst_val = float(bill.cgst_amount or 0)
            sgst_val = float(bill.sgst_amount or 0)
            tot_tax_val = cgst_val + sgst_val
            points_val = int(bill.points_redeemed or 0)
            net_val = float(bill.net_payable or 0)

            if bill.status == 'PAID':
                paid_count += 1
                total_subtotal += subtotal_val
                total_discount += disc_amt
                total_tax += tot_tax_val
                total_revenue += net_val

            row_data = [
                f"#{bill.bill_number}",
                created_str,
                order_type_display,
                str(table_token),
                cust_name,
                cust_phone,
                round(subtotal_val, 2),
                round(disc_pct, 2),
                round(disc_amt, 2),
                round(taxable_val, 2),
                round(cgst_val, 2),
                round(sgst_val, 2),
                round(tot_tax_val, 2),
                points_val,
                round(net_val, 2),
                bill.get_payment_mode_display() if hasattr(bill, 'get_payment_mode_display') else (bill.payment_mode or ''),
                bill.get_status_display() if hasattr(bill, 'get_status_display') else bill.status,
            ]
            ws.append(row_data)

            for col_idx in range(1, len(headers) + 1):
                c = ws.cell(row=row_num, column=col_idx)
                c.border = thin_border
                c.font = Font(name="Calibri", size=10)
                if col_idx in (7, 8, 9, 10, 11, 12, 13, 14, 15):
                    c.alignment = right_align
                    if col_idx in (7, 9, 10, 11, 12, 13, 15):
                        c.number_format = '#,##0.00'
                elif col_idx in (1, 2, 3, 4, 16, 17):
                    c.alignment = center_align
                else:
                    c.alignment = left_align

            ws.row_dimensions[row_num].height = 20
            row_num += 1

        # Summary Row
        if qs.exists():
            summary_row = ws.max_row + 1
            ws.cell(row=summary_row, column=1, value="TOTAL (Paid Orders)")
            ws.cell(row=summary_row, column=7, value=round(total_subtotal, 2))
            ws.cell(row=summary_row, column=9, value=round(total_discount, 2))
            ws.cell(row=summary_row, column=13, value=round(total_tax, 2))
            ws.cell(row=summary_row, column=15, value=round(total_revenue, 2))

            for col_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=summary_row, column=col_idx)
                cell.font = Font(name="Calibri", size=10, bold=True, color="0F172A")
                cell.fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
                cell.border = thin_border
                if col_idx in (7, 9, 13, 15):
                    cell.alignment = right_align
                    cell.number_format = '#,##0.00'
            ws.row_dimensions[summary_row].height = 22

        # Auto column width
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 13)

        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        filename = f"rebill-orders-{timezone.localdate().strftime('%Y-%m-%d')}.xlsx"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=['get'], permission_classes=[HasDynamicPermission('view_orders')])
    def export_csv(self, request):
        """Export filtered bills to CSV with UTF-8 BOM for Excel compatibility."""
        qs = self.get_queryset()
        output = StringIO()
        output.write('\ufeff')  # UTF-8 BOM for Excel compatibility
        writer = csv.writer(output)
        writer.writerow([
            'Bill #', 'Date & Time', 'Order Type', 'Table / Token', 'Customer Name', 'Customer Phone',
            'Subtotal', 'Discount %', 'Discount Amt', 'Taxable', 'CGST', 'SGST', 'Total Tax',
            'Points Redeemed', 'Net Payable', 'Payment Mode', 'Status'
        ])

        for bill in qs:
            order_type_display = 'Dine-In' if (bill.order_type == 'DINE_IN' or (bill.order and bill.order.order_type == 'DINE_IN')) else 'Takeaway'
            table_token = bill.order.table.number if (bill.order and bill.order.table) else (bill.order.tag_name if bill.order else '')
            tot_tax = (bill.cgst_amount or 0) + (bill.sgst_amount or 0)
            writer.writerow([
                bill.bill_number,
                timezone.localtime(bill.created_at).strftime('%Y-%m-%d %H:%M:%S'),
                order_type_display,
                table_token,
                bill.customer.name if bill.customer else '',
                bill.customer.phone if bill.customer else '',
                str(bill.subtotal),
                str(bill.discount_percent),
                str(bill.discount_amount),
                str(bill.taxable_amount),
                str(bill.cgst_amount),
                str(bill.sgst_amount),
                str(tot_tax),
                str(bill.points_redeemed),
                str(bill.net_payable),
                bill.payment_mode,
                bill.status,
            ])

        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = f'attachment; filename="rebill-bills-export-{timezone.localdate().strftime("%Y-%m-%d")}.csv"'
        return response

    @action(
        detail=False,
        methods=['post'],
        permission_classes=[HasDynamicPermission('view_orders')],
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_csv(self, request):
        from .importer import import_bills
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'File upload is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            res = import_bills(file_obj)
            return Response(res)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def pay(self, request, pk=None):
        """Take payment, award points, free the table.

        Only the amount and mode are kept — no card digits, no UPI id.
        Points are awarded here rather than at bill generation, so a bill that
        is cancelled before payment never mints points.
        """
        if not has_perm(request.user, 'settle_bill'):
            raise ValidationError('You do not have permission to settle bills.')
        bill = self.get_object()
        if bill.status != BillStatus.UNPAID:
            raise ValidationError(f'This bill is already {bill.get_status_display()}.')

        settings_row = RestaurantSettings.load()
        if settings_row.customer_details_mandatory:
            if not bill.customer or not (bill.customer.name or '').strip() or not (bill.customer.phone or '').strip():
                raise ValidationError('Customer details (Name and Phone) are mandatory to settle this bill.')

        serializer = PaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bill.payment_mode = serializer.validated_data['payment_mode']
        bill.status = BillStatus.PAID
        bill.paid_at = timezone.now()
        bill.save(update_fields=['payment_mode', 'status', 'paid_at'])

        if bill.customer_id:
            customer = Customer.objects.select_for_update().get(pk=bill.customer_id)
            customer.record_visit(bill.total)
            if bill.points_earned:
                LoyaltyTransaction.post(
                    customer,
                    bill.points_earned,
                    LoyaltyReason.EARN,
                    bill=bill,
                    note=f'Bill {bill.bill_number}',
                    user=request.user,
                )

            # ── WhatsApp Triggers (Bill Receipt & Feedback Link) ──────────────
            try:
                from apps.whatsapp.models import FeedbackRequest, TriggerType, WhatsAppConfig
                from apps.whatsapp.services import send_if_enabled

                send_if_enabled(
                    TriggerType.BILL_RECEIPT,
                    customer=customer,
                    bill=bill,
                    context={
                        'bill_number': bill.bill_number,
                        'bill_amount': str(bill.net_payable),
                        'earned_points': bill.points_earned,
                        'available_points': customer.points_balance,
                    },
                )

                feedback_req, _ = FeedbackRequest.objects.get_or_create(
                    customer=customer, bill=bill
                )
                wa_config = WhatsAppConfig.load()
                feedback_link = f"{wa_config.public_base_url.rstrip('/')}/feedback/{feedback_req.token}"
                send_if_enabled(
                    TriggerType.FEEDBACK,
                    customer=customer,
                    bill=bill,
                    context={'link': feedback_link},
                )
            except Exception:
                pass

        order = bill.order
        order.status = OrderStatus.PAID
        order.save(update_fields=['status', 'updated_at'])
        if order.table:
            order.table.mark(TableStatus.AVAILABLE)

        return Response(BillSerializer(bill).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cancel(self, request, pk=None):
        """Cancel or refund a bill. Reason is always mandatory.

        An UNPAID bill is just a mistake being undone, so a cashier may do it.
        A PAID bill means money leaves the till, so it needs the Owner's
        password — the same rule the over-limit discount follows.

        Loyalty is unwound both ways: points earned are taken back and points
        spent are returned, so a cancelled meal leaves no trace on the balance.
        """
        if not has_perm(request.user, 'cancel_bill'):
            raise ValidationError('You do not have permission to cancel bills.')
        bill = self.get_object()
        if bill.status == BillStatus.CANCELLED:
            raise ValidationError('This bill has already been cancelled.')

        serializer = CancelBillSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        was_paid = bill.status == BillStatus.PAID
        approver = None
        if was_paid and not request.user.is_owner:
            approver = _verify_owner(
                serializer.validated_data.get('owner_username'),
                serializer.validated_data.get('owner_password'),
                'Owner authorization required to refund a paid bill.',
            )
        elif was_paid:
            approver = request.user

        if bill.customer_id:
            customer = Customer.objects.select_for_update().get(pk=bill.customer_id)
            if was_paid:
                customer.undo_visit(bill.total)
                if bill.points_earned:
                    LoyaltyTransaction.post(
                        customer, -bill.points_earned, LoyaltyReason.REVERSAL,
                        bill=bill, note=f'{bill.bill_number} cancel', user=request.user,
                    )
            if bill.points_redeemed:
                LoyaltyTransaction.post(
                    customer, bill.points_redeemed, LoyaltyReason.REVERSAL,
                    bill=bill, note=f'{bill.bill_number} cancelled — points reversed',
                    user=request.user,
                )

        bill.status = BillStatus.CANCELLED
        bill.cancel_reason = serializer.validated_data['reason']
        bill.cancelled_at = timezone.now()
        bill.cancelled_by = request.user
        bill.cancel_approved_by = approver
        bill.save(
            update_fields=[
                'status', 'cancel_reason', 'cancelled_at', 'cancelled_by', 'cancel_approved_by',
            ]
        )

        order = bill.order
        order.status = OrderStatus.CANCELLED
        order.save(update_fields=['status', 'updated_at'])
        if order.table:
            order.table.mark(TableStatus.AVAILABLE)

        return Response(BillSerializer(bill).data)


class KOTListView(ListAPIView):
    """Kitchen screen and KOT history. Waiters may read this — it is the only billing data
    their role can see."""

    serializer_class = KOTSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = KOT.objects.select_related('order__table', 'created_by').prefetch_related('items')
        is_history = self.request.query_params.get('history') == 'true'

        if not is_history:
            # Active tickets only: must have items and order must be running.
            qs = qs.filter(items__isnull=False, order__status=OrderStatus.RUNNING).distinct()
            if self.request.query_params.get('today') != 'false':
                qs = qs.filter(created_at__date=timezone.localdate())
            return qs[:100]

        # ── History filters ──────────────────────────────────────────────
        if order_status := self.request.query_params.get('status'):
            if order_status.upper() != 'ALL':
                qs = qs.filter(order__status=order_status.upper())

        if date_str := self.request.query_params.get('date'):
            qs = qs.filter(created_at__date=date_str)
        else:
            if start_date := self.request.query_params.get('start_date'):
                qs = qs.filter(created_at__date__gte=start_date)
            if end_date := self.request.query_params.get('end_date'):
                qs = qs.filter(created_at__date__lte=end_date)
            if not start_date and not end_date and self.request.query_params.get('all_time') != 'true':
                qs = qs.filter(created_at__date=timezone.localdate())

        if table := self.request.query_params.get('table'):
            qs = qs.filter(Q(order__table__number=table) | Q(order__table_id=table))

        if search := (self.request.query_params.get('search') or '').strip():
            qs = qs.filter(
                Q(number__icontains=search)
                | Q(order__table__number__icontains=search)
                | Q(order__tag_name__icontains=search)
                | Q(items__item_name__icontains=search)
                | Q(created_by__username__icontains=search)
            ).distinct()

        return qs[:300]
