from decimal import Decimal

from django.conf import settings as django_settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.menu.models import Portion
from apps.tables.models import RestaurantTable


class OrderType(models.TextChoices):
    DINE_IN = 'DINE_IN', 'Dine-in'
    TAKEAWAY = 'TAKEAWAY', 'Takeaway / Parcel'


class OrderStatus(models.TextChoices):
    RUNNING = 'RUNNING', 'Running'       # items still being added
    BILLED = 'BILLED', 'Billed'          # bill generated, payment pending
    PAID = 'PAID', 'Paid'                # closed
    CANCELLED = 'CANCELLED', 'Cancelled'


OPEN_STATUSES = (OrderStatus.RUNNING, OrderStatus.BILLED)


class Order(models.Model):
    """A running order on a table or takeaway counter."""

    order_type = models.CharField(
        max_length=10, choices=OrderType.choices, default=OrderType.DINE_IN
    )
    table = models.ForeignKey(
        RestaurantTable, on_delete=models.PROTECT, null=True, blank=True, related_name='orders'
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
    )
    status = models.CharField(
        max_length=10, choices=OrderStatus.choices, default=OrderStatus.RUNNING
    )
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='orders'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']

    def __str__(self):
        type_str = f'Table {self.table.number}' if self.table else 'Takeaway'
        return f'Order #{self.pk} — {type_str}'

    @property
    def is_open(self):
        return self.status in OPEN_STATUSES

    @property
    def subtotal(self):
        return sum((line.line_total for line in self.items.all()), Decimal('0.00'))

    @property
    def item_count(self):
        return sum(line.quantity for line in self.items.all())

    @property
    def has_unsent_items(self):
        """True when something has been added since the last KOT went out."""
        return self.items.filter(kot__isnull=True).exists()


class KOT(models.Model):
    """Kitchen Order Ticket — one batch of newly added items.

    A running order produces several KOTs over an evening; each carries only
    what the kitchen has not seen yet.
    """

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='kots')
    number = models.PositiveIntegerField(unique=True)
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='kots'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'kots'
        ordering = ['-created_at']
        verbose_name = 'KOT'
        verbose_name_plural = 'KOTs'

    def __str__(self):
        return f'KOT #{self.number}'


class OrderItem(models.Model):
    """One line on the order.

    Name, portion and price are snapshotted at add-time. If the owner edits the
    menu mid-service, an open order keeps the price the customer was quoted.
    """

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    variant = models.ForeignKey(
        'menu.MenuItemVariant', on_delete=models.SET_NULL, null=True, related_name='order_items'
    )

    item_name = models.CharField(max_length=120)
    portion = models.CharField(max_length=4, choices=Portion.choices)
    food_type = models.CharField(max_length=8, blank=True)
    unit_price = models.DecimalField(max_digits=8, decimal_places=2)
    quantity = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1)])
    note = models.CharField(max_length=120, blank=True, help_text='e.g. kam mirchi')

    kot = models.ForeignKey(
        KOT, on_delete=models.SET_NULL, null=True, blank=True, related_name='items'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'order_items'
        ordering = ['created_at', 'id']

    def __str__(self):
        return f'{self.item_name} ({self.get_portion_display()}) x{self.quantity}'

    @property
    def line_total(self):
        return (self.unit_price * self.quantity).quantize(Decimal('0.01'))


class PaymentMode(models.TextChoices):
    CASH = 'CASH', 'Cash'
    CARD = 'CARD', 'Card'
    UPI = 'UPI', 'UPI'


class BillStatus(models.TextChoices):
    UNPAID = 'UNPAID', 'Unpaid'
    PAID = 'PAID', 'Paid'
    CANCELLED = 'CANCELLED', 'Cancelled'


class Bill(models.Model):
    """Frozen money snapshot for one order.

    Every amount is stored, not recomputed on read — a reprint months later
    must match the paper the customer took home, even if tax rates changed.
    Only the amount and the mode are kept for payments; no card or UPI details.
    """

    order = models.OneToOneField(Order, on_delete=models.PROTECT, related_name='bill')
    order_type = models.CharField(
        max_length=10, choices=OrderType.choices, default=OrderType.DINE_IN
    )
    bill_number = models.CharField(max_length=20, unique=True)
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bills',
    )

    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    taxable_amount = models.DecimalField(max_digits=10, decimal_places=2)

    cgst_percent = models.DecimalField(max_digits=5, decimal_places=2)
    cgst_amount = models.DecimalField(max_digits=10, decimal_places=2)
    sgst_percent = models.DecimalField(max_digits=5, decimal_places=2)
    sgst_amount = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=10, decimal_places=2)

    # Loyalty points are tender, not a discount: GST is charged on the full
    # taxable value and the points then pay part of the invoice. Treating them
    # as a discount would under-collect GST.
    points_redeemed = models.PositiveIntegerField(default=0)
    redeem_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    # Always written explicitly at creation; the default exists only so the
    # column can be added to a table that already has rows.
    net_payable = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    points_earned = models.PositiveIntegerField(default=0)

    status = models.CharField(max_length=10, choices=BillStatus.choices, default=BillStatus.UNPAID)
    payment_mode = models.CharField(max_length=4, choices=PaymentMode.choices, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    # ── Cancel / refund audit ────────────────────────────────────────────
    cancel_reason = models.CharField(max_length=255, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cancelled_bills',
    )
    cancel_approved_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_cancellations',
    )

    # Set only when the discount crossed the owner-configured ceiling.
    discount_approved_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_discounts',
    )
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='bills'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # Header snapshot — a reprint should show the address that was on the bill.
    restaurant_name = models.CharField(max_length=120)
    restaurant_address = models.TextField(blank=True)
    gstin = models.CharField(max_length=15, blank=True)

    class Meta:
        db_table = 'bills'
        ordering = ['-created_at']

    def __str__(self):
        return self.bill_number
