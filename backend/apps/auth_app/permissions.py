"""Role-based DRF permissions shared across all ReBill apps."""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Role


def has_perm(user, perm):
    if not user or not user.is_authenticated:
        return False
    return user.has_perm_dynamic(perm)


class HasDynamicPermission(BasePermission):
    """Factory to create permission classes on the fly based on a specific permission."""
    def __init__(self, perm_name, fallback_message="Access denied."):
        self.perm_name = perm_name
        self.message = fallback_message

    def __call__(self):
        return self

    def has_permission(self, request, view):
        return has_perm(request.user, self.perm_name)


class IsOwner(BasePermission):
    """Owner only — reports, settings, menu editing, user management."""

    message = 'Sirf Owner hi yeh action kar sakta hai.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_owner)


class IsOwnerOrCashier(BasePermission):
    """Fallback for everything on the billing floor, until we migrate all views to granular perms."""

    message = 'Yeh action sirf Owner ya Cashier kar sakta hai.'

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_owner or user.is_cashier)
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
        return user.is_owner
