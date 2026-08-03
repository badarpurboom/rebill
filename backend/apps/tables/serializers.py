from rest_framework import serializers

from .models import RestaurantTable


def _open_order(table):
    """The single open order on this table, or None.

    Reads the `_open_orders` list planted by the viewset's Prefetch so a
    50-table floor map stays at two queries instead of fifty-one.
    """
    orders = getattr(table, '_open_orders', None)
    if orders is None:
        return table.orders.filter(status__in=('RUNNING', 'BILLED')).first()
    return orders[0] if orders else None


class TableSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    open_order_id = serializers.SerializerMethodField()
    running_total = serializers.SerializerMethodField()
    running_items = serializers.SerializerMethodField()
    order_summary = serializers.SerializerMethodField()

    class Meta:
        model = RestaurantTable
        fields = [
            'id', 'number', 'label', 'seats', 'shape',
            'pos_x', 'pos_y', 'status', 'status_display', 'is_active',
            'open_order_id', 'running_total', 'running_items', 'order_summary',
        ]
        read_only_fields = ['status']

    def get_open_order_id(self, obj):
        order = _open_order(obj)
        return order.id if order else None

    def get_running_total(self, obj):
        order = _open_order(obj)
        return str(order.subtotal) if order else None

    def get_running_items(self, obj):
        order = _open_order(obj)
        return order.item_count if order else 0

    def get_order_summary(self, obj):
        order = _open_order(obj)
        if not order:
            return None
        return {
            'order_id': order.id,
            'status': order.status,
            'customer_name': order.customer.name if order.customer else None,
            'customer_phone': order.customer.phone if order.customer else None,
            'subtotal': str(order.subtotal),
            'item_count': order.item_count,
            'items': [
                {
                    'id': item.id,
                    'name': item.item_name,
                    'quantity': item.quantity,
                    'portion': item.portion,
                    'line_total': str(item.line_total),
                    'sent': item.kot_id is not None,
                }
                for item in order.items.all()
            ],
        }


class TableLayoutItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    pos_x = serializers.IntegerField(min_value=0, max_value=200)
    pos_y = serializers.IntegerField(min_value=0, max_value=200)


class TableLayoutSerializer(serializers.Serializer):
    """Owner drags several tables, then saves the whole layout in one call."""

    tables = TableLayoutItemSerializer(many=True)

    def validate_tables(self, value):
        if not value:
            raise serializers.ValidationError('Koi table nahi bheja gaya.')
        seen = set()
        for entry in value:
            cell = (entry['pos_x'], entry['pos_y'])
            if cell in seen:
                raise serializers.ValidationError(
                    f'Do tables ek hi jagah par hain ({cell[0]}, {cell[1]}).'
                )
            seen.add(cell)
        return value


class BulkCreateTablesSerializer(serializers.Serializer):
    """Quick setup: "mujhe 50 tables chahiye" without adding them one by one."""

    count = serializers.IntegerField(min_value=1, max_value=200)
    seats = serializers.IntegerField(min_value=1, max_value=30, default=4)
    start_from = serializers.IntegerField(min_value=1, default=1)
