from decimal import Decimal
from django.db import models


class DailyFootfallContextLog(models.Model):
    """Stores daily meteorological data, calendar occasions, and restaurant POS footfall metrics.
    
    This provides an intelligent correlation foundation for demand forecasting,
    inventory planning, and AI analysis.
    """

    SNAPSHOT_TYPES = (
        ('ACTUAL', 'Actual Recorded Day'),
        ('FORECAST', 'Upcoming Forecast'),
    )

    date = models.DateField(unique=True, db_index=True, help_text='Target date')

    # ── Weather Snapshot ──────────────────────────────────────────────────
    weather_condition = models.CharField(max_length=80, default='Clear Sky', help_text='E.g. Sunny, Heavy Rain, Fog')
    weather_code = models.IntegerField(default=0, help_text='WMO Weather Interpretation Code')
    temp_max = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='Max temperature in Celsius')
    temp_min = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='Min temperature in Celsius')
    temp_avg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='Average temperature in Celsius')
    precipitation_mm = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'), help_text='Rainfall in mm')
    rain_probability_percent = models.PositiveSmallIntegerField(default=0, help_text='Chance of rain (0-100%)')
    humidity_percent = models.PositiveSmallIntegerField(default=50, help_text='Average humidity percentage')

    # ── Calendar & Occasion Details ──────────────────────────────────────
    is_holiday = models.BooleanField(default=False)
    holiday_name = models.CharField(max_length=120, blank=True, default='')
    is_weekend = models.BooleanField(default=False)
    is_long_weekend = models.BooleanField(default=False)
    is_event_day = models.BooleanField(default=False)
    event_name = models.CharField(max_length=120, blank=True, default='')
    event_category = models.CharField(max_length=50, blank=True, default='', help_text='Festival, Sports, National Holiday, etc.')

    # ── Consolidated Restaurant Footfall & Sales ─────────────────────────
    total_bills = models.PositiveIntegerField(default=0)
    dine_in_bills = models.PositiveIntegerField(default=0)
    takeaway_bills = models.PositiveIntegerField(default=0)
    delivery_bills = models.PositiveIntegerField(default=0)
    guest_count = models.PositiveIntegerField(default=0, help_text='Total pax/covers served')
    total_sales = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    dine_in_sales = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    delivery_sales = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    peak_hour = models.PositiveSmallIntegerField(null=True, blank=True, help_text='Busiest hour of the day (0-23)')
    top_selling_category = models.CharField(max_length=100, blank=True, default='')
    top_selling_item = models.CharField(max_length=120, blank=True, default='')

    snapshot_type = models.CharField(max_length=20, default='ACTUAL', choices=SNAPSHOT_TYPES)
    notes = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'daily_footfall_context_log'
        ordering = ['-date']
        verbose_name = 'Daily Footfall Context Log'
        verbose_name_plural = 'Daily Footfall Context Logs'

    def __str__(self):
        occasion_str = f" ({self.holiday_name or self.event_name})" if (self.holiday_name or self.event_name) else ""
        return f"{self.date}: {self.weather_condition}{occasion_str} - ₹{self.total_sales} ({self.total_bills} bills)"
