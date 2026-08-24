from django.contrib import admin
from .models import DailyFootfallContextLog


@admin.register(DailyFootfallContextLog)
class DailyFootfallContextLogAdmin(admin.ModelAdmin):
    list_display = (
        'date',
        'weather_condition',
        'temp_max',
        'temp_min',
        'precipitation_mm',
        'holiday_name',
        'event_name',
        'total_bills',
        'guest_count',
        'total_sales',
        'snapshot_type',
    )
    list_filter = ('snapshot_type', 'is_holiday', 'is_weekend', 'weather_condition')
    search_fields = ('holiday_name', 'event_name', 'weather_condition', 'top_selling_item')
    date_hierarchy = 'date'

