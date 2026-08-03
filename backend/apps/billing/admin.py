from django.contrib import admin

from .models import Bill, KOT, Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['item_name', 'portion', 'unit_price', 'kot']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'table', 'status', 'created_by', 'created_at']
    list_filter = ['status', 'created_at']
    inlines = [OrderItemInline]


@admin.register(KOT)
class KOTAdmin(admin.ModelAdmin):
    list_display = ['number', 'order', 'created_by', 'created_at']
    list_filter = ['created_at']


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display = ['bill_number', 'order', 'total', 'status', 'payment_mode', 'created_at']
    list_filter = ['status', 'payment_mode', 'created_at']
    search_fields = ['bill_number']
    readonly_fields = [f.name for f in Bill._meta.fields]
