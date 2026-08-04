from decimal import Decimal

from rest_framework import serializers

from apps.menu.models import MenuItemVariant
from apps.settings_app.models import RestaurantSettings

from .models import Bill, KOT, Order, OrderItem, PaymentMode
from .services import compute_totals


class OrderItemSerializer(serializers.ModelSerializer):
    portion_display = serializers.CharField(source='get_portion_display', read_only=True)
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    sent_to_kitchen = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            'id', 'variant', 'item_name', 'portion', 'portion_display', 'food_type',
            'unit_price', 'quantity', 'note', 'line_total', 'sent_to_kitchen', 'created_at',
        ]
        read_only_fields = ['item_name', 'portion', 'food_type', 'unit_price']

    def get_sent_to_kitchen(self, obj):
        return obj.kot_id is not None


class AddOrderItemSerializer(serializers.Serializer):
    """Cashier taps a menu tile — only the variant and how many."""

    variant = serializers.PrimaryKeyRelatedField(queryset=MenuItemVariant.objects.all())
    quantity = serializers.IntegerField(min_value=1, max_value=99, default=1)
    note = serializers.CharField(max_length=120, required=False, allow_blank=True, default='')

    def validate_variant(self, variant):
        if not variant.is_available or not variant.item.is_available:
            raise serializers.ValidationError(f'{variant.item.name} is currently out of stock.')
        return variant


class KOTItemSerializer(serializers.ModelSerializer):
    portion_display = serializers.CharField(source='get_portion_display', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'item_name', 'portion', 'portion_display', 'food_type', 'quantity', 'note']


class KOTSerializer(serializers.ModelSerializer):
    items = KOTItemSerializer(many=True, read_only=True)
    table_number = serializers.CharField(source='order.table.number', read_only=True, default='Takeaway')
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = KOT
        fields = ['id', 'number', 'order', 'table_number', 'created_by_name', 'created_at', 'items']


MONEY_FIELDS = [
    'subtotal', 'discount_percent', 'discount_amount', 'taxable_amount',
    'cgst_percent', 'cgst_amount', 'sgst_percent', 'sgst_amount', 'total',
    'points_redeemed', 'redeem_amount', 'net_payable', 'points_earned',
]


class BillSerializer(serializers.ModelSerializer):
    order_type_display = serializers.CharField(source='get_order_type_display', read_only=True)
    payment_mode_display = serializers.CharField(source='get_payment_mode_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    table_number = serializers.CharField(source='order.table.number', read_only=True, default='Takeaway')
    items = OrderItemSerializer(source='order.items', many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    approved_by_name = serializers.CharField(
        source='discount_approved_by.username', read_only=True, default=None
    )
    cancelled_by_name = serializers.CharField(
        source='cancelled_by.username', read_only=True, default=None
    )
    customer_name = serializers.CharField(source='customer.name', read_only=True, default=None)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True, default=None)

    class Meta:
        model = Bill
        fields = [
            'id', 'bill_number', 'order', 'order_type', 'order_type_display', 'table_number', 'status', 'status_display',
            'customer', 'customer_name', 'customer_phone',
            *MONEY_FIELDS,
            'payment_mode', 'payment_mode_display', 'paid_at',
            'restaurant_name', 'restaurant_address', 'gstin',
            'created_by_name', 'approved_by_name', 'created_at', 'items',
            'cancel_reason', 'cancelled_at', 'cancelled_by_name',
        ]


class BillListSerializer(serializers.ModelSerializer):
    """Lean row for order history — no line items, no header snapshot."""

    order_type_display = serializers.CharField(source='get_order_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_mode_display = serializers.CharField(source='get_payment_mode_display', read_only=True)
    table_number = serializers.CharField(source='order.table.number', read_only=True, default='Takeaway')
    customer_name = serializers.CharField(source='customer.name', read_only=True, default=None)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = [
            'id', 'bill_number', 'order_type', 'order_type_display', 'table_number', 'status', 'status_display',
            'customer', 'customer_name', 'customer_phone',
            'subtotal', 'discount_amount', 'total', 'redeem_amount', 'net_payable',
            'points_earned', 'points_redeemed',
            'payment_mode', 'payment_mode_display', 'paid_at',
            'created_by_name', 'created_at', 'item_count', 'cancel_reason',
        ]

    def get_item_count(self, obj):
        return sum(line.quantity for line in obj.order.items.all())


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    order_type_display = serializers.CharField(source='get_order_type_display', read_only=True)
    table_number = serializers.CharField(source='table.number', read_only=True, default='Takeaway')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    item_count = serializers.IntegerField(read_only=True)
    has_unsent_items = serializers.BooleanField(read_only=True)
    has_kots = serializers.BooleanField(read_only=True)
    bill = BillSerializer(read_only=True)
    totals = serializers.SerializerMethodField()
    customer_detail = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'order_type', 'order_type_display', 'table', 'table_number', 'status', 'status_display',
            'customer', 'customer_detail',
            'created_by_name', 'created_at', 'updated_at',
            'items', 'item_count', 'subtotal', 'has_unsent_items', 'has_kots', 'totals', 'bill',
        ]

    def get_customer_detail(self, obj):
        if not obj.customer:
            return None
        from apps.customers.serializers import CustomerSerializer

        return CustomerSerializer(obj.customer).data

    def get_totals(self, obj):
        """Undiscounted preview so the cart always shows a live grand total."""
        settings_row = self.context.get('settings') or RestaurantSettings.load()
        totals = compute_totals(obj.subtotal, Decimal('0'), settings_row)
        return {
            k: (v if k in ('points_redeemed', 'points_earned') else str(v))
            for k, v in totals.items()
        }


class OpenOrderSerializer(serializers.Serializer):
    table = serializers.IntegerField()


class PreviewSerializer(serializers.Serializer):
    discount_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal('0'), max_value=Decimal('100'),
        default=Decimal('0'),
    )
    customer = serializers.IntegerField(required=False, allow_null=True, default=None)
    redeem_points = serializers.IntegerField(required=False, min_value=0, default=0)


class GenerateBillSerializer(PreviewSerializer):
    """Owner credentials are only required when the discount breaks the ceiling."""

    owner_username = serializers.CharField(required=False, allow_blank=True)
    owner_password = serializers.CharField(required=False, allow_blank=True)


class PaySerializer(serializers.Serializer):
    payment_mode = serializers.ChoiceField(choices=PaymentMode.choices)


class AttachCustomerSerializer(serializers.Serializer):
    customer = serializers.IntegerField(allow_null=True)


class CancelBillSerializer(serializers.Serializer):
    """Reason is mandatory — the requirements are explicit about it."""

    reason = serializers.CharField(max_length=255)
    owner_username = serializers.CharField(required=False, allow_blank=True)
    owner_password = serializers.CharField(required=False, allow_blank=True)

    def validate_reason(self, value):
        value = value.strip()
        if len(value) < 4:
            raise serializers.ValidationError('Please provide a more detailed reason (at least 4 characters).')
        return value
