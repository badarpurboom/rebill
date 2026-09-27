from decimal import Decimal
from django.db import transaction
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
import csv
from io import StringIO

from apps.auth_app.permissions import IsOwner, IsOwnerOrReadOnly

from .importer import import_menu
from .models import Category, MenuItem, MenuItemVariant
from .serializers import CategorySerializer, CSVImportSerializer, MenuItemSerializer, VariantSerializer

SAMPLE_CSV = (
    'category,name,food_type,half_price,full_price,description\n'
    'Starters,Paneer Tikka,Veg,140,240,Tandoori paneer cooked in clay oven\n'
    'Starters,Chicken Tikka,Non-Veg,170,290,\n'
    'Main Course,Dal Makhani,Veg,,220,\n'
    'Desserts,Gulab Jamun,Veg,,90,2 pieces\n'
    'Drinks,Masala Chai,Veg,,40,\n'
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsOwnerOrReadOnly]
    pagination_class = None

    @action(detail=False, methods=['post'], permission_classes=[IsOwner])
    def reorder(self, request):
        """Update display sort_order for categories."""
        orders = request.data.get('order', [])
        for item in orders:
            if 'id' in item and 'sort_order' in item:
                Category.objects.filter(id=item['id']).update(sort_order=item['sort_order'])
        return Response({'status': 'ok', 'detail': 'Categories reordered successfully.'})

    @action(detail=True, methods=['post'], permission_classes=[IsOwner])
    def toggle_active(self, request, pk=None):
        cat = self.get_object()
        cat.is_active = not cat.is_active
        cat.save(update_fields=['is_active'])
        return Response({'id': cat.id, 'is_active': cat.is_active})


class MenuItemViewSet(viewsets.ModelViewSet):
    """Menu CRUD. Everyone reads (POS + KOT need it), only Owner writes."""

    serializer_class = MenuItemSerializer
    permission_classes = [IsOwnerOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        qs = (
            MenuItem.objects.select_related('category')
            .prefetch_related('variants')
            .all()
        )
        params = self.request.query_params
        if category := params.get('category'):
            qs = qs.filter(category_id=category)
        if food_type := params.get('food_type'):
            qs = qs.filter(food_type=food_type)
        if search := params.get('search'):
            qs = qs.filter(name__icontains=search)
        if params.get('available') == 'true':
            qs = qs.filter(is_available=True)
        return qs

    @action(detail=True, methods=['post'], permission_classes=[IsOwner])
    def toggle_stock(self, request, pk=None):
        """Out-of-stock switch — the owner's fastest daily action."""
        item = self.get_object()
        item.is_available = not item.is_available
        item.save(update_fields=['is_available', 'updated_at'])
        # Also sync all variants
        item.variants.update(is_available=item.is_available)
        return Response(MenuItemSerializer(item).data)

    @action(detail=True, methods=['post'], url_path=r'variants/(?P<variant_id>\d+)/toggle_stock', permission_classes=[IsOwner])
    def toggle_variant_stock(self, request, pk=None, variant_id=None):
        """Toggle stock for a specific portion variant (e.g. Half or Full)."""
        item = self.get_object()
        variant = item.variants.filter(id=variant_id).first()
        if not variant:
            return Response({'detail': 'Variant not found.'}, status=status.HTTP_404_NOT_FOUND)
        variant.is_available = not variant.is_available
        variant.save(update_fields=['is_available'])
        return Response(MenuItemSerializer(item).data)

    @action(detail=True, methods=['post'], permission_classes=[IsOwner])
    @transaction.atomic
    def duplicate(self, request, pk=None):
        """1-click clone dish with all its variants."""
        item = self.get_object()
        base_name = item.name
        new_name = f'{base_name} (Copy)'
        counter = 1
        while MenuItem.objects.filter(category=item.category, name=new_name).exists():
            counter += 1
            new_name = f'{base_name} (Copy {counter})'

        new_item = MenuItem.objects.create(
            category=item.category,
            name=new_name,
            food_type=item.food_type,
            description=item.description,
            is_available=item.is_available,
            sort_order=item.sort_order + 1,
        )
        for v in item.variants.all():
            MenuItemVariant.objects.create(
                item=new_item,
                portion=v.portion,
                price=v.price,
                is_available=v.is_available,
            )
        return Response(MenuItemSerializer(new_item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='quick_update', permission_classes=[IsOwner])
    @transaction.atomic
    def quick_update(self, request, pk=None):
        """Quickly update prices or basic fields directly from inline table/grid."""
        item = self.get_object()
        data = request.data
        if 'name' in data and data['name']:
            item.name = data['name'].strip()
        if 'food_type' in data:
            item.food_type = data['food_type']
        if 'is_available' in data:
            item.is_available = bool(data['is_available'])
        if 'description' in data:
            item.description = str(data['description']).strip()
        if 'category' in data and data['category']:
            item.category_id = data['category']
        item.save()

        # Update variant prices if provided
        prices = data.get('prices')
        if prices and isinstance(prices, dict):
            for portion, price_val in prices.items():
                if price_val is not None and str(price_val).strip() != '':
                    MenuItemVariant.objects.update_or_create(
                        item=item,
                        portion=portion,
                        defaults={'price': Decimal(str(price_val)), 'is_available': True}
                    )
                elif portion == 'HALF' and (price_val is None or str(price_val).strip() == ''):
                    MenuItemVariant.objects.filter(item=item, portion='HALF').delete()

        item.refresh_from_db()
        return Response(MenuItemSerializer(item).data)

    @action(detail=False, methods=['post'], permission_classes=[IsOwner])
    @transaction.atomic
    def bulk_action(self, request):
        """Bulk operations on multiple menu items."""
        action_type = request.data.get('action')
        item_ids = request.data.get('item_ids', [])
        if not item_ids:
            return Response({'detail': 'No items selected.'}, status=status.HTTP_400_BAD_REQUEST)

        qs = MenuItem.objects.filter(id__in=item_ids)
        count = qs.count()

        if action_type == 'set_stock':
            avail = bool(request.data.get('is_available', True))
            qs.update(is_available=avail)
            MenuItemVariant.objects.filter(item__in=qs).update(is_available=avail)
            return Response({'updated_count': count, 'detail': f'{count} items marked as {"In Stock" if avail else "Out of Stock"}.'})

        elif action_type == 'move_category':
            cat_id = request.data.get('category_id')
            if not Category.objects.filter(id=cat_id).exists():
                return Response({'detail': 'Target category does not exist.'}, status=status.HTTP_400_BAD_REQUEST)
            qs.update(category_id=cat_id)
            return Response({'updated_count': count, 'detail': f'{count} items moved to new category.'})

        elif action_type == 'adjust_price':
            mode = request.data.get('mode', 'percent')
            value = Decimal(str(request.data.get('value', '0')))
            for v in MenuItemVariant.objects.filter(item__in=qs):
                if mode == 'percent':
                    new_price = v.price + (v.price * value / Decimal('100'))
                else:
                    new_price = v.price + value
                v.price = max(Decimal('0'), round(new_price, 2))
                v.save(update_fields=['price'])
            return Response({'updated_count': count, 'detail': f'Prices updated for {count} items.'})

        elif action_type == 'delete':
            deleted_count, _ = qs.delete()
            return Response({'deleted_count': deleted_count, 'detail': f'{count} items deleted successfully.'})

        return Response({'detail': f'Unknown bulk action: {action_type}'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], permission_classes=[IsOwner])
    def clear_all(self, request):
        """Delete all menu items and categories to start fresh."""
        count, _ = MenuItem.objects.all().delete()
        Category.objects.all().delete()
        return Response({'deleted_count': count, 'detail': 'All menu items and categories cleared.'})


    @action(
        detail=False,
        methods=['post'],
        permission_classes=[IsOwner],
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_csv(self, request):
        serializer = CSVImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = import_menu(serializer.validated_data['file'])
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=False, methods=['get'], permission_classes=[IsOwnerOrReadOnly])
    def export_csv(self, request):
        """Export all current menu items with variants to CSV."""
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['category', 'name', 'food_type', 'half_price', 'full_price', 'description'])

        items = self.get_queryset()
        for item in items:
            half = ''
            full = ''
            for v in item.variants.all():
                if v.portion == 'HALF':
                    half = str(v.price)
                elif v.portion == 'FULL':
                    full = str(v.price)
            writer.writerow([
                item.category.name if item.category else '',
                item.name,
                item.food_type,
                half,
                full,
                item.description or ''
            ])

        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="rebill-menu-export.csv"'
        return response

    @action(detail=False, methods=['get'], permission_classes=[IsOwnerOrReadOnly])
    def sample_csv(self, request):
        """Downloadable template so the owner knows the exact column names."""
        response = HttpResponse(SAMPLE_CSV, content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="rebill-menu-template.csv"'
        return response
