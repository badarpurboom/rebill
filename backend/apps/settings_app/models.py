from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction


class RestaurantSettings(models.Model):
    """Single-row config table — one outlet, so there is exactly one instance.

    Everything the biller needs at runtime lives here: bill header, tax rates,
    the discount ceiling, and the running counters. Loyalty and WhatsApp fields
    join later; they belong on this same row.
    """

    SINGLETON_ID = 1

    # ── Bill header ──────────────────────────────────────────────────────
    restaurant_name = models.CharField(max_length=120, default='ReBill Restaurant')
    address = models.TextField(default='123, Main Market, New Delhi - 110001')
    gstin = models.CharField(max_length=15, blank=True, default='')
    phone = models.CharField(max_length=15, blank=True, default='')

    # ── Bill numbering ───────────────────────────────────────────────────
    bill_prefix = models.CharField(max_length=8, default='RB')
    bill_number_padding = models.PositiveSmallIntegerField(default=4)
    next_bill_number = models.PositiveIntegerField(default=1)
    next_kot_number = models.PositiveIntegerField(default=1)

    # ── Tax — CGST 2.5 + SGST 2.5 = 5% ───────────────────────────────────
    cgst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('2.50'))
    sgst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('2.50'))

    # ── Discount policy ──────────────────────────────────────────────────
    max_discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('20.00'),
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Isse zyada discount dene par Owner password maanga jaayega',
    )

    # ── Loyalty points ───────────────────────────────────────────────────
    # Earn is expressed as a block so the owner can say "₹100 = 1 point"
    # without doing decimal maths. Partial blocks do not earn — spending ₹190
    # on a ₹100/point rule earns 1 point, not 1.9.
    loyalty_enabled = models.BooleanField(default=True)
    loyalty_earn_amount = models.DecimalField(
        max_digits=8, decimal_places=2, default=Decimal('100.00'),
        help_text='Itne rupaye kharch karne par',
    )
    loyalty_earn_points = models.PositiveIntegerField(
        default=1, help_text='Itne points milenge',
    )
    loyalty_redeem_value = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal('1.00'),
        help_text='1 point = itne rupaye',
    )
    loyalty_min_redeem_points = models.PositiveIntegerField(
        default=50, help_text='Isse kam points redeem nahi ho sakte',
    )
    # Without a ceiling a large balance could zero out a bill, leaving the till
    # with GST collected but no cash behind it.
    loyalty_max_redeem_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('50.00'),
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Ek bill me zyada se zyada itne % tak points se bhar sakte hain',
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'restaurant_settings'
        verbose_name_plural = 'restaurant settings'

    def __str__(self):
        return self.restaurant_name

    def save(self, *args, **kwargs):
        self.pk = self.SINGLETON_ID
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):  # pragma: no cover - guard rail
        raise RuntimeError('Restaurant settings delete nahi ho sakti.')

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=cls.SINGLETON_ID)
        return obj

    @property
    def gst_percent(self):
        return self.cgst_percent + self.sgst_percent

    def points_for_spend(self, amount):
        """Points earned on a bill. Whole blocks only, never fractional."""
        if not self.loyalty_enabled or self.loyalty_earn_amount <= 0:
            return 0
        return int(Decimal(amount) // self.loyalty_earn_amount) * self.loyalty_earn_points

    def redeem_value_of(self, points):
        """Rupee value of N points, rounded down to paise."""
        return (Decimal(points) * self.loyalty_redeem_value).quantize(Decimal('0.01'))

    @classmethod
    @transaction.atomic
    def take_bill_number(cls):
        """Reserve the next bill number. Row-locked, so two cashiers billing at
        the same moment can never land on the same RB-0007."""
        row = cls.objects.select_for_update().get(pk=cls.SINGLETON_ID)
        number = row.next_bill_number
        row.next_bill_number = number + 1
        row.save(update_fields=['next_bill_number', 'updated_at'])
        return f'{row.bill_prefix}-{number:0{row.bill_number_padding}d}'

    @classmethod
    @transaction.atomic
    def take_kot_number(cls):
        row = cls.objects.select_for_update().get(pk=cls.SINGLETON_ID)
        number = row.next_kot_number
        row.next_kot_number = number + 1
        row.save(update_fields=['next_kot_number', 'updated_at'])
        return number
