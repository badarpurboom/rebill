from datetime import timedelta
import csv
from io import StringIO
from django.contrib.auth import authenticate
from django.db import IntegrityError, transaction
from django.db.models import Q
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
from apps.auth_app.permissions import IsOwnerOrCashier
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
    if owner is None or not owner.is_active or owner.role != Role.OWNER:
        raise ValidationError('Invalid owner username or password.')
    return owner


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    """Running orders. Owner + Cashier only — waiters do not enter orders."""

    serializer_class = OrderSerializer
    permission_classes = [IsOwnerOrCashier]
    pagination_class = None

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
        order = Order.objects.create(
            order_type=OrderType.TAKEAWAY,
            table=None,
            created_by=request.user,
        )
        return Response(self.get_serializer(order).data, status=status.HTTP_201_CREATED)

    # ── Cart operations ──────────────────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='items')
    @transaction.atomic
    def add_item(self, request, pk=None):
        order = self._running_order(pk)
        serializer = AddOrderItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        variant = serializer.validated_data['variant']
        quantity = serializer.validated_data['quantity']
        note = serializer.validated_data['note']

        # Merge into an identical line only while it is still un-sent — once
        # the kitchen has a ticket, the next round has to be its own line.
        line = order.items.filter(
            variant=variant, note=note, kot__isnull=True
        ).first()
        if line:
            line.quantity += quantity
            line.save(update_fields=['quantity'])
        else:
            line = OrderItem.objects.create(
                order=order,
                variant=variant,
                item_name=variant.item.name,
                portion=variant.portion,
                food_type=variant.item.food_type,
                unit_price=variant.price,
                quantity=quantity,
                note=note,
            )

        order.save(update_fields=['updated_at'])
        return Response(OrderItemSerializer(line).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path=r'items/(?P<item_id>\d+)')
    @transaction.atomic
    def update_item(self, request, pk=None, item_id=None):
        order = self._running_order(pk)
        line = order.items.filter(pk=item_id).first()
        if line is None:
            raise ValidationError('This item is not part of this order.')

        quantity = request.data.get('quantity')
        if quantity is not None:
            quantity = int(quantity)
            if quantity < 1:
                line.delete()
                order.save(update_fields=['updated_at'])
                return Response(status=status.HTTP_204_NO_CONTENT)
            line.quantity = quantity

        if 'note' in request.data:
            line.note = str(request.data['note'])[:120]

        line.save()
        order.save(update_fields=['updated_at'])
        return Response(OrderItemSerializer(line).data)

    @action(detail=True, methods=['delete'], url_path=r'items/(?P<item_id>\d+)/remove')
    @transaction.atomic
    def remove_item(self, request, pk=None, item_id=None):
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


class BillViewSet(viewsets.ReadOnlyModelViewSet):
    """Order history + checkout. Search covers name, phone and bill number."""

    permission_classes = [IsOwnerOrCashier]

    def get_serializer_class(self):
        return BillListSerializer if self.action == 'list' else BillSerializer

    def get_queryset(self):
        qs = Bill.objects.select_related(
            'order__table', 'customer', 'created_by', 'discount_approved_by', 'cancelled_by'
        ).prefetch_related('order__items')

        params = self.request.query_params
        if search := (params.get('search') or '').strip():
            qs = qs.filter(
                Q(bill_number__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(customer__phone__contains=search)
                | Q(order__table__number=search)
            )
        if status_filter := params.get('status'):
            qs = qs.filter(status=status_filter)
        if mode := params.get('payment_mode'):
            qs = qs.filter(payment_mode=mode)

        # Date Presets Handling: today, week, month, 6_months, 1_year, custom
        period = params.get('period')
        today = timezone.localdate()

        if period == 'today':
            qs = qs.filter(created_at__date=today)
        elif period == 'week':
            qs = qs.filter(created_at__date__gte=today - timedelta(days=7))
        elif period == 'month':
            qs = qs.filter(created_at__date__gte=today - timedelta(days=30))
        elif period == '6_months':
            qs = qs.filter(created_at__date__gte=today - timedelta(days=180))
        elif period == '1_year':
            qs = qs.filter(created_at__date__gte=today - timedelta(days=365))
        else:
            if date_from := params.get('from'):
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to := params.get('to'):
                qs = qs.filter(created_at__date__lte=date_to)

        return qs

    @action(detail=False, methods=['get'], permission_classes=[IsOwnerOrCashier])
    def export_csv(self, request):
        """Export filtered bills to CSV."""
        qs = self.get_queryset()
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'bill_number', 'date', 'customer_name', 'customer_phone',
            'order_type', 'table_number', 'payment_mode', 'status',
            'subtotal', 'cgst', 'sgst', 'total_amount', 'discount_percent', 'points_redeemed'
        ])

        for bill in qs:
            writer.writerow([
                bill.bill_number,
                bill.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                bill.customer.name if bill.customer else '',
                bill.customer.phone if bill.customer else '',
                bill.order.order_type if bill.order else 'TAKEAWAY',
                bill.order.table.number if (bill.order and bill.order.table) else '',
                bill.payment_mode,
                bill.status,
                str(bill.subtotal),
                str(bill.cgst_amount),
                str(bill.sgst_amount),
                str(bill.net_payable),
                str(bill.discount_percent),
                str(bill.points_redeemed),
            ])

        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="rebill-bills-export.csv"'
        return response

    @action(
        detail=False,
        methods=['post'],
        permission_classes=[IsOwnerOrCashier],
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
        bill = self.get_object()
        if bill.status != BillStatus.UNPAID:
            raise ValidationError(f'This bill is already {bill.get_status_display()}.')

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
    """Kitchen screen. Waiters may read this — it is the only billing data
    their role can see."""

    serializer_class = KOTSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = KOT.objects.select_related('order__table', 'created_by').prefetch_related('items')
        # Only show active tickets: must have items and order must be running.
        qs = qs.filter(items__isnull=False, order__status=OrderStatus.RUNNING).distinct()
        if self.request.query_params.get('today') != 'false':
            qs = qs.filter(created_at__date=timezone.localdate())
        return qs[:100]
