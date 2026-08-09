from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomRole(models.Model):
    name = models.CharField(max_length=50, unique=True)
    permissions = models.JSONField(default=dict, blank=True)
    is_system = models.BooleanField(default=False, help_text="System roles cannot be deleted")

    class Meta:
        db_table = 'custom_roles'
        ordering = ['name']

    def __str__(self):
        return self.name


class Role(models.TextChoices):
    # Kept for backward compatibility during migration
    OWNER = 'OWNER', 'Owner'
    CASHIER = 'CASHIER', 'Cashier'
    WAITER = 'WAITER', 'Waiter'


class User(AbstractUser):
    """Username + password login with a single restaurant role attached."""

    # Deprecated: use custom_role instead
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CASHIER)
    
    custom_role = models.ForeignKey(CustomRole, on_delete=models.PROTECT, null=True, blank=True, related_name='users')
    phone = models.CharField(max_length=15, blank=True)

    class Meta:
        db_table = 'users'
        ordering = ['username']

    def __str__(self):
        role_name = self.custom_role.name if self.custom_role else self.get_role_display()
        return f'{self.username} ({role_name})'

    def has_perm_dynamic(self, perm):
        if not self.custom_role:
            # Fallback to old string roles if not migrated yet
            if self.role == Role.OWNER:
                return True
            return False
        return self.custom_role.permissions.get(perm, False)

    @property
    def is_owner(self):
        if self.custom_role:
            return self.custom_role.name == 'Owner'
        return self.role == Role.OWNER

    @property
    def is_cashier(self):
        if self.custom_role:
            return self.custom_role.name == 'Cashier'
        return self.role == Role.CASHIER

    @property
    def is_waiter(self):
        if self.custom_role:
            return self.custom_role.name == 'Waiter'
        return self.role == Role.WAITER
