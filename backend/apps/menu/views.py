from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
import csv
from io import StringIO

from apps.auth_app.permissions import IsOwner, IsOwnerOrReadOnly

from .importer import import_menu
from .models import Category, MenuItem
from .serializers import CategorySerializer, CSVImportSerializer, MenuItemSerializer

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
        return Response({'id': item.id, 'is_available': item.is_available})

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
