from django.contrib import admin

from .models import RestaurantTable


@admin.register(RestaurantTable)
class RestaurantTableAdmin(admin.ModelAdmin):
    list_display = ['number', 'label', 'seats', 'status', 'pos_x', 'pos_y', 'is_active']
    list_filter = ['status', 'is_active', 'shape']
    search_fields = ['number', 'label']
