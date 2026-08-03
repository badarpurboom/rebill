from rest_framework import serializers

from .models import Customer, LoyaltyTransaction


class CustomerSerializer(serializers.ModelSerializer):
    average_bill = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    days_since_visit = serializers.IntegerField(read_only=True)

    # Declared by hand so the model's max_length and regex do not reject the
    # raw input before it has been normalised. Cashiers type "+91 98765 43210"
    # or "098765 43210"; both must resolve to the same customer.
    phone = serializers.CharField(max_length=20)

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'dob', 'anniversary', 'note',
            'visit_count', 'total_spent', 'points_balance', 'average_bill',
            'last_visit_at', 'days_since_visit', 'is_active', 'created_at',
        ]
        read_only_fields = [
            'visit_count', 'total_spent', 'points_balance', 'last_visit_at', 'created_at',
        ]

    def validate_phone(self, value):
        digits = ''.join(ch for ch in value if ch.isdigit())
        if len(digits) > 10:
            digits = digits[-10:]   # drop 91 / 0 prefixes
        if len(digits) != 10 or digits[0] not in '6789':
            raise serializers.ValidationError(
                'Enter a valid Indian mobile number — 10 digits, starting with 6/7/8/9.'
            )

        clash = Customer.objects.filter(phone=digits)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError('This phone number is already registered to another customer.')
        return digits

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError('Name must be at least 2 characters.')
        return value


class LoyaltyTransactionSerializer(serializers.ModelSerializer):
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    bill_number = serializers.CharField(source='bill.bill_number', read_only=True, default=None)
    created_by_name = serializers.CharField(
        source='created_by.username', read_only=True, default=None
    )

    class Meta:
        model = LoyaltyTransaction
        fields = [
            'id', 'reason', 'reason_display', 'points', 'balance_after',
            'bill', 'bill_number', 'note', 'created_by_name', 'created_at',
        ]


class AdjustPointsSerializer(serializers.Serializer):
    """Owner-only manual correction — a goodwill grant or a mistake fix."""

    points = serializers.IntegerField()
    note = serializers.CharField(max_length=255)

    def validate_points(self, value):
        if value == 0:
            raise serializers.ValidationError('Points adjustment cannot be zero.')
        return value

    def validate_note(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError('Reason is required.')
        return value
