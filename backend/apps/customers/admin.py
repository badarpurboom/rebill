from django.contrib import admin

from .models import Customer, LoyaltyTransaction


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'visit_count', 'total_spent', 'points_balance', 'last_visit_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'phone']
    readonly_fields = ['visit_count', 'total_spent', 'points_balance', 'last_visit_at']


@admin.register(LoyaltyTransaction)
class LoyaltyTransactionAdmin(admin.ModelAdmin):
    list_display = ['customer', 'reason', 'points', 'balance_after', 'bill', 'created_at']
    list_filter = ['reason', 'created_at']
    search_fields = ['customer__name', 'customer__phone']

    def has_change_permission(self, request, obj=None):
        return False  # append-only ledger

    def has_delete_permission(self, request, obj=None):
        return False
