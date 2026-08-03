from decimal import Decimal

from django.conf import settings as django_settings
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

phone_validator = RegexValidator(
    r'^[6-9]\d{9}$',
    'Indian mobile number daalo — 10 digits, 6/7/8/9 se shuru.',
)


class Customer(models.Model):
    """A diner. Phone is the identity — it is what WhatsApp will address later.

    `visit_count`, `total_spent` and `points_balance` are rollups kept in sync
    when a bill is paid or cancelled. They are read on every POS lookup and in
    reports, so recomputing them from the ledger each time would be wasteful.
    """

    name = models.CharField(max_length=80)
    phone = models.CharField(max_length=10, unique=True, validators=[phone_validator])
    dob = models.DateField(null=True, blank=True, verbose_name='date of birth')
    anniversary = models.DateField(null=True, blank=True)
    note = models.CharField(max_length=255, blank=True)

    visit_count = models.PositiveIntegerField(default=0)
    total_spent = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    points_balance = models.IntegerField(default=0)
    last_visit_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='registered_customers',
    )

    class Meta:
        db_table = 'customers'
        ordering = ['-last_visit_at', '-created_at']
        indexes = [models.Index(fields=['name'])]

    def __str__(self):
        return f'{self.name} ({self.phone})'

    @property
    def average_bill(self):
        if not self.visit_count:
            return Decimal('0.00')
        return (self.total_spent / self.visit_count).quantize(Decimal('0.01'))

    @property
    def days_since_visit(self):
        if not self.last_visit_at:
            return None
        return (timezone.now() - self.last_visit_at).days

    def record_visit(self, amount):
        self.visit_count += 1
        self.total_spent += Decimal(amount)
        self.last_visit_at = timezone.now()
        self.save(update_fields=['visit_count', 'total_spent', 'last_visit_at'])

    def undo_visit(self, amount):
        """Called when a paid bill is cancelled — the visit never really happened."""
        self.visit_count = max(0, self.visit_count - 1)
        self.total_spent = max(Decimal('0.00'), self.total_spent - Decimal(amount))
        self.save(update_fields=['visit_count', 'total_spent'])


class LoyaltyReason(models.TextChoices):
    EARN = 'EARN', 'Bill par mile'
    REDEEM = 'REDEEM', 'Bill me use hue'
    REVERSAL = 'REVERSAL', 'Bill cancel hone par wapas'
    ADJUST = 'ADJUST', 'Owner ne manually badle'


class LoyaltyTransaction(models.Model):
    """Append-only points ledger.

    Nothing here is ever edited or deleted — a correction is a new row. The
    customer's balance is the running total, and `balance_after` on each row
    lets the owner see exactly where a disputed balance came from.
    """

    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name='loyalty_transactions'
    )
    bill = models.ForeignKey(
        'billing.Bill',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='loyalty_transactions',
    )
    reason = models.CharField(max_length=10, choices=LoyaltyReason.choices)
    points = models.IntegerField(help_text='Positive = mile, negative = kate')
    balance_after = models.IntegerField()
    note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'loyalty_transactions'
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f'{self.customer.name}: {self.points:+d} ({self.get_reason_display()})'

    @classmethod
    def post(cls, customer, points, reason, *, bill=None, note='', user=None):
        """Move points and write the ledger row in one place.

        Every balance change in the system goes through here, so the ledger can
        never drift from `Customer.points_balance`.
        """
        points = int(points)
        customer.points_balance += points
        customer.save(update_fields=['points_balance'])
        return cls.objects.create(
            customer=customer,
            bill=bill,
            reason=reason,
            points=points,
            balance_after=customer.points_balance,
            note=note,
            created_by=user,
        )
