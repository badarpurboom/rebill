from django.db import transaction
from rest_framework import serializers

from .models import Category, MenuItem, MenuItemVariant, Portion


class CategorySerializer(serializers.ModelSerializer):
    item_count = serializers.IntegerField(source='items.count', read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'sort_order', 'is_active', 'item_count']


class VariantSerializer(serializers.ModelSerializer):
    portion_display = serializers.CharField(source='get_portion_display', read_only=True)

    class Meta:
        model = MenuItemVariant
        fields = ['id', 'portion', 'portion_display', 'price', 'is_available']


class MenuItemSerializer(serializers.ModelSerializer):
    variants = VariantSerializer(many=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    is_veg = serializers.BooleanField(read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            'id', 'category', 'category_name', 'name', 'food_type', 'is_veg',
            'description', 'is_available', 'sort_order', 'variants',
        ]

    def validate_variants(self, value):
        if not value:
            raise serializers.ValidationError('Kam se kam ek price (Full) daalna zaroori hai.')
        portions = [v['portion'] for v in value]
        if len(portions) != len(set(portions)):
            raise serializers.ValidationError('Half aur Full — har portion sirf ek baar.')
        if Portion.FULL not in portions:
            raise serializers.ValidationError('Full portion ka price hona chahiye.')
        return value

    @transaction.atomic
    def create(self, validated_data):
        variants = validated_data.pop('variants')
        item = MenuItem.objects.create(**validated_data)
        MenuItemVariant.objects.bulk_create(
            [MenuItemVariant(item=item, **v) for v in variants]
        )
        return item

    @transaction.atomic
    def update(self, instance, validated_data):
        variants = validated_data.pop('variants', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if variants is not None:
            # Replace the whole price set — the owner edits Half/Full together.
            keep_ids = []
            for v in variants:
                obj, _ = MenuItemVariant.objects.update_or_create(
                    item=instance,
                    portion=v['portion'],
                    defaults={
                        'price': v['price'],
                        'is_available': v.get('is_available', True),
                    },
                )
                keep_ids.append(obj.id)
            instance.variants.exclude(id__in=keep_ids).delete()
        return instance


class CSVImportSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        allowed = ('.csv', '.xlsx', '.xls')
        if not value.name.lower().endswith(allowed):
            raise serializers.ValidationError('Sirf CSV ya Excel (.csv, .xlsx, .xls) file chalegi.')
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('File 5MB se choti honi chahiye.')
        return value
