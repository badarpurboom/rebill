from django.contrib import admin

from .models import RestaurantSettings


@admin.register(RestaurantSettings)
class RestaurantSettingsAdmin(admin.ModelAdmin):
    list_display = ['restaurant_name', 'bill_prefix', 'next_bill_number', 'max_discount_percent']

    def has_add_permission(self, request):
        return not RestaurantSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
