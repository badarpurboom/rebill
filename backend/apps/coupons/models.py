import random
import string
from django.conf import settings as django_settings
from django.db import models
from django.utils import timezone


class DiscountType(models.TextChoices):
    PERCENT = 'PERCENT', 'Percentage (%)'
    FIXED = 'FIXED', 'Fixed Amount (₹)'


class CouponSegment(models.TextChoices):
    ALL = 'ALL', 'Sab Customers'
    NEW = 'NEW', 'New Customers'
    REGULAR = 'REGULAR', 'Regular Customers'
    INACTIVE = 'INACTIVE', 'Inactive Customers'


def generate_coupon_code(length=6):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


class Coupon(models.Model):
    """Discount coupons created by owner."""

    code = models.CharField(max_length=30, unique=True)
    discount_type = models.CharField(
        max_length=10, choices=DiscountType.choices, default=DiscountType.PERCENT
    )
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_discount_amount = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Percent discount ke liye maximum limit (optional)'
    )
    valid_from = models.DateTimeField(default=timezone.now)
    valid_until = models.DateTimeField(null=True, blank=True)
    usage_limit = models.PositiveIntegerField(
        null=True, blank=True, help_text='Kul kitni baar code use ho sakta hai (optional)'
    )
    used_count = models.PositiveIntegerField(default=0)
    segment = models.CharField(
        max_length=10, choices=CouponSegment.choices, default=CouponSegment.ALL
    )
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'coupons'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.code} ({self.get_discount_type_display()} {self.discount_value})'

    @property
    def is_valid_now(self):
        if not self.is_active:
            return False
        now = timezone.now()
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        if self.usage_limit and self.used_count >= self.usage_limit:
            return False
        return True

    def calculate_discount(self, subtotal):
        if not self.is_valid_now or subtotal < self.min_order_amount:
            return Decimal('0.00')

        from decimal import Decimal
        subtotal = Decimal(str(subtotal))

        if self.discount_type == DiscountType.PERCENT:
            discount = subtotal * Decimal(str(self.discount_value)) / Decimal('100')
            if self.max_discount_amount:
                discount = min(discount, Decimal(str(self.max_discount_amount)))
        else:
            discount = Decimal(str(self.discount_value))

        return min(discount, subtotal)


class CouponUsage(models.Model):
    """Log of every coupon redemption."""

    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='usages')
    customer = models.ForeignKey(
        'customers.Customer', on_delete=models.SET_NULL, null=True, blank=True, related_name='coupon_usages'
    )
    bill = models.ForeignKey(
        'billing.Bill', on_delete=models.SET_NULL, null=True, blank=True, related_name='coupon_usages'
    )
    discount_applied = models.DecimalField(max_digits=10, decimal_places=2)
    used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'coupon_usages'
        ordering = ['-used_at']

    def __str__(self):
        return f'{self.coupon.code} used on Bill {self.bill_id}'
