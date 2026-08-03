from rest_framework import serializers

from .models import RestaurantSettings


class RestaurantSettingsSerializer(serializers.ModelSerializer):
    gst_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True
    )
    next_bill_preview = serializers.SerializerMethodField()

    class Meta:
        model = RestaurantSettings
        fields = [
            'restaurant_name', 'address', 'gstin', 'phone',
            'bill_prefix', 'bill_number_padding', 'next_bill_number', 'next_bill_preview',
            'cgst_percent', 'sgst_percent', 'gst_percent',
            'max_discount_percent',
            'loyalty_enabled', 'loyalty_earn_amount', 'loyalty_earn_points',
            'loyalty_redeem_value', 'loyalty_min_redeem_points', 'loyalty_max_redeem_percent',
            'updated_at',
        ]
        read_only_fields = ['next_bill_number', 'updated_at']

    def get_next_bill_preview(self, obj):
        return f'{obj.bill_prefix}-{obj.next_bill_number:0{obj.bill_number_padding}d}'

    def validate_gstin(self, value):
        value = value.strip().upper()
        if value and len(value) != 15:
            raise serializers.ValidationError('GSTIN 15 character ka hota hai.')
        return value
