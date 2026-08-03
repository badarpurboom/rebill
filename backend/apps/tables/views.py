from django.db import transaction
from django.db.models import Prefetch
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.auth_app.permissions import IsOwner, IsOwnerOrReadOnly
from apps.billing.models import OPEN_STATUSES, Order

from .models import RestaurantTable, TableStatus
from .serializers import (
    BulkCreateTablesSerializer,
    TableLayoutSerializer,
    TableSerializer,
)

GRID_COLUMNS = 10


class TableViewSet(viewsets.ModelViewSet):
    """Floor map. Everyone reads it; only the Owner edits the layout."""

    serializer_class = TableSerializer
    permission_classes = [IsOwnerOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        open_orders = Order.objects.filter(status__in=OPEN_STATUSES).prefetch_related('items')
        return RestaurantTable.objects.filter(is_active=True).prefetch_related(
            Prefetch('orders', queryset=open_orders, to_attr='_open_orders')
        )

    def perform_destroy(self, instance):
        if instance.orders.filter(status__in=OPEN_STATUSES).exists():
            raise ValidationError('This table has an active order — please generate the bill first.')
        instance.delete()

    @action(detail=False, methods=['post'], permission_classes=[IsOwner])
    def save_layout(self, request):
        """Persist drag & drop positions for many tables in one shot."""
        serializer = TableLayoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entries = serializer.validated_data['tables']

        by_id = RestaurantTable.objects.in_bulk([e['id'] for e in entries])
        missing = [e['id'] for e in entries if e['id'] not in by_id]
        if missing:
            return Response(
                {'detail': f'Tables not found: {missing}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for entry in entries:
            table = by_id[entry['id']]
            table.pos_x = entry['pos_x']
            table.pos_y = entry['pos_y']

        RestaurantTable.objects.bulk_update(by_id.values(), ['pos_x', 'pos_y'])
        return Response({'updated': len(entries)})

    @action(detail=False, methods=['post'], permission_classes=[IsOwner])
    @transaction.atomic
    def bulk_create(self, request):
        """Create N tables at once, auto-laid-out on the grid."""
        serializer = BulkCreateTablesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = serializer.validated_data['count']
        seats = serializer.validated_data['seats']
        number = serializer.validated_data['start_from']

        taken_numbers = set(RestaurantTable.objects.values_list('number', flat=True))
        taken_cells = set(RestaurantTable.objects.values_list('pos_x', 'pos_y'))

        new_tables = []
        cursor = len(taken_cells)
        while len(new_tables) < count:
            while str(number) in taken_numbers:
                number += 1
            x, y = cursor % GRID_COLUMNS, cursor // GRID_COLUMNS
            while (x, y) in taken_cells:
                cursor += 1
                x, y = cursor % GRID_COLUMNS, cursor // GRID_COLUMNS

            taken_cells.add((x, y))
            taken_numbers.add(str(number))
            new_tables.append(
                RestaurantTable(number=str(number), seats=seats, pos_x=x, pos_y=y)
            )
            number += 1
            cursor += 1

        RestaurantTable.objects.bulk_create(new_tables)
        return Response({'created': len(new_tables)}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        counts = {choice.value: 0 for choice in TableStatus}
        for row in RestaurantTable.objects.values('status'):
            counts[row['status']] = counts.get(row['status'], 0) + 1
        return Response({'total': sum(counts.values()), **counts})
