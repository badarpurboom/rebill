from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    OWNER = 'OWNER', 'Owner'
    CASHIER = 'CASHIER', 'Cashier'
    WAITER = 'WAITER', 'Waiter'


class User(AbstractUser):
    """Username + password login with a single restaurant role attached.

    Owner   — full access (reports, settings, menu, loyalty, campaigns, users)
    Cashier — billing, customer register, checkout, payment, coupon validation
    Waiter  — read-only KOT view; does not enter orders into the system
    """

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CASHIER)
    phone = models.CharField(max_length=15, blank=True)

    class Meta:
        db_table = 'users'
        ordering = ['username']

    def __str__(self):
        return f'{self.username} ({self.get_role_display()})'

    @property
    def is_owner(self):
        return self.role == Role.OWNER

    @property
    def is_cashier(self):
        return self.role == Role.CASHIER

    @property
    def is_waiter(self):
        return self.role == Role.WAITER
