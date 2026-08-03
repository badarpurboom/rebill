from rest_framework import serializers
from .models import Coupon, CouponUsage, generate_coupon_code


class CouponSerializer(serializers.ModelSerializer):
    discount_type_display = serializers.CharField(source='get_discount_type_display', read_only=True)
    segment_display = serializers.CharField(source='get_segment_display', read_only=True)
    is_valid_now = serializers.BooleanField(read_only=True)

    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'discount_type', 'discount_type_display', 'discount_value',
            'min_order_amount', 'max_discount_amount', 'valid_from', 'valid_until',
            'usage_limit', 'used_count', 'segment', 'segment_display',
            'is_active', 'is_valid_now', 'created_at',
        ]
        read_only_fields = ['used_count', 'created_at']

    def validate_code(self, value):
        value = value.strip().upper()
        if not value:
            value = generate_coupon_code()
        return value


class ValidateCouponSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=30)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2)
    customer_id = serializers.IntegerField(required=False, allow_null=True)


class CouponUsageSerializer(serializers.ModelSerializer):
    coupon_code = serializers.CharField(source='coupon.code', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True, default=None)
    bill_number = serializers.CharField(source='bill.bill_number', read_only=True, default=None)

    class Meta:
        model = CouponUsage
        fields = [
            'id', 'coupon', 'coupon_code', 'customer', 'customer_name',
            'bill', 'bill_number', 'discount_applied', 'used_at',
        ]
