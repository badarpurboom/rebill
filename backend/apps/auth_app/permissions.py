"""Role-based DRF permissions shared across all ReBill apps."""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Role


class IsOwner(BasePermission):
    """Owner only — reports, settings, menu editing, user management."""

    message = 'Sirf Owner hi yeh action kar sakta hai.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == Role.OWNER)


class IsOwnerOrCashier(BasePermission):
    """Everything on the billing floor: POS, customers, checkout, coupons."""

    message = 'Yeh action sirf Owner ya Cashier kar sakta hai.'

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role in (Role.OWNER, Role.CASHIER)
        )


class IsOwnerOrReadOnly(BasePermission):
    """Any logged-in staff member can read; only the Owner can write.

    This is the menu rule: a cashier must see items to bill them, a waiter must
    see them to read a KOT, but neither may change prices or stock.
    """

    message = 'Menu badalne ka access sirf Owner ke paas hai.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.role == Role.OWNER
