"""
Context Capture Services for ReBill
Captures daily weather (via Open-Meteo free API), Indian holiday/event calendar,
and aggregates POS sales & footfall data for demand forecasting & AI analytics.
"""

import json
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
import urllib.request
import urllib.parse
from django.db.models import Count, Sum, Avg
from django.db.models.functions import ExtractHour
from django.utils import timezone

from apps.settings_app.models import RestaurantSettings
from apps.billing.models import Bill, BillStatus, OrderType, OrderItem
from .models import DailyFootfallContextLog

logger = logging.getLogger(__name__)

# WMO Weather interpretation codes mapped to Indian context descriptions
WMO_WEATHER_MAP = {
    0: ('Clear Sky', 'Sunny / Clear'),
    1: ('Mainly Clear', 'Sunny / Pleasant'),
    2: ('Partly Cloudy', 'Partly Cloudy'),
    3: ('Overcast', 'Cloudy / Overcast'),
    45: ('Foggy', 'Chilly / Foggy'),
    48: ('Depositing Rime Fog', 'Dense Fog'),
    51: ('Light Drizzle', 'Light Drizzle'),
    53: ('Moderate Drizzle', 'Drizzle'),
    55: ('Dense Drizzle', 'Heavy Drizzle'),
    61: ('Slight Rain', 'Light Rain'),
    63: ('Moderate Rain', 'Moderate Rain'),
    65: ('Heavy Monsoon Rain', 'Heavy Monsoon Rain'),
    71: ('Slight Snow', 'Chilly Snow'),
    73: ('Moderate Snow', 'Snowfall'),
    75: ('Heavy Snow', 'Heavy Snow'),
    80: ('Slight Showers', 'Passing Rain Showers'),
    81: ('Moderate Showers', 'Rain Showers'),
    82: ('Violent Showers', 'Intense Rain Showers'),
    95: ('Thunderstorm', 'Thunderstorm with Rain'),
    96: ('Thunderstorm with Hail', 'Severe Thunderstorm'),
    99: ('Heavy Thunderstorm with Hail', 'Severe Storm with Hail'),
}


class WeatherCaptureService:
    """Fetches real-time, forecast, or historical archive weather data from Open-Meteo (Free Open API)."""

    @staticmethod
    def get_weather_description(wmo_code):
        return WMO_WEATHER_MAP.get(int(wmo_code), ('Clear', 'Normal Weather'))[0]

    @classmethod
    def fetch_weather_for_date(cls, target_date: date, lat: float = 28.6139, lon: float = 77.2090) -> dict:
        """Fetch weather for a specific date (historical, today, or forecast)."""
        today = timezone.localdate() if hasattr(timezone, 'localdate') else date.today()
        date_str = target_date.strftime('%Y-%m-%d')

        # Decide whether to use archive API (past) or forecast API (today/future)
        is_past = target_date < (today - timedelta(days=2))
        
        if is_past:
            url = (
                f"https://archive-api.open-meteo.com/v1/archive?"
                f"latitude={lat}&longitude={lon}&start_date={date_str}&end_date={date_str}"
                f"&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,weather_code"
                f"&timezone=Asia%2FKolkata"
            )
        else:
            url = (
                f"https://api.open-meteo.com/v1/forecast?"
                f"latitude={lat}&longitude={lon}&start_date={date_str}&end_date={date_str}"
                f"&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,precipitation_probability_max,weather_code"
                f"&timezone=Asia%2FKolkata"
            )

        try:
            req = urllib.request.Request(
                url,
                headers={'User-Agent': 'ReBill-POS-Weather-Service/1.0'}
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                data = json.loads(response.read().decode('utf-8'))
                daily = data.get('daily', {})
                
                if daily and len(daily.get('time', [])) > 0:
                    wmo_code = daily.get('weather_code', [0])[0] or 0
                    t_max = daily.get('temperature_2m_max', [30.0])[0]
                    t_min = daily.get('temperature_2m_min', [20.0])[0]
                    t_avg = daily.get('temperature_2m_mean', [25.0])[0]
                    precip = daily.get('precipitation_sum', [0.0])[0] or 0.0
                    rain_prob = daily.get('precipitation_probability_max', [0])[0] if 'precipitation_probability_max' in daily else (60 if precip > 1.0 else 0)

                    condition_str = cls.get_weather_description(wmo_code)
                    if t_max and float(t_max) >= 41.0 and 'Rain' not in condition_str:
                        condition_str = f"Heatwave ({condition_str})"

                    return {
                        'weather_code': int(wmo_code),
                        'weather_condition': condition_str,
                        'temp_max': Decimal(str(round(float(t_max), 2))) if t_max is not None else None,
                        'temp_min': Decimal(str(round(float(t_min), 2))) if t_min is not None else None,
                        'temp_avg': Decimal(str(round(float(t_avg), 2))) if t_avg is not None else None,
                        'precipitation_mm': Decimal(str(round(float(precip), 2))),
                        'rain_probability_percent': int(rain_prob) if rain_prob is not None else 0,
                        'humidity_percent': 65 if precip > 2.0 else 45,
                    }
        except Exception as exc:
            logger.warning(f"Failed to fetch weather from Open-Meteo for {date_str}: {exc}")

        # Graceful fallback in case of no internet
        month = target_date.month
        is_monsoon = month in (6, 7, 8, 9)
        is_winter = month in (11, 12, 1, 2)
        is_summer = month in (4, 5, 6)

        if is_monsoon:
            default_condition = 'Cloudy / Seasonal Rain'
            default_tmax = Decimal('32.0')
            default_tmin = Decimal('25.0')
        elif is_winter:
            default_condition = 'Clear / Pleasant Winter'
            default_tmax = Decimal('22.0')
            default_tmin = Decimal('10.0')
        elif is_summer:
            default_condition = 'Sunny / Summer Heat'
            default_tmax = Decimal('39.0')
            default_tmin = Decimal('28.0')
        else:
            default_condition = 'Pleasant / Clear'
            default_tmax = Decimal('29.0')
            default_tmin = Decimal('19.0')

        return {
            'weather_code': 0,
            'weather_condition': default_condition,
            'temp_max': default_tmax,
            'temp_min': default_tmin,
            'temp_avg': (default_tmax + default_tmin) / Decimal('2'),
            'precipitation_mm': Decimal('0.00'),
            'rain_probability_percent': 10,
            'humidity_percent': 50,
        }

    @classmethod
    def fetch_7_day_forecast(cls, lat: float = 28.6139, lon: float = 77.2090) -> list:
        """Fetch 7-day upcoming weather forecast."""
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}&forecast_days=7"
            f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code"
            f"&timezone=Asia%2FKolkata"
        )
        results = []
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'ReBill-POS-Weather-Service/1.0'})
            with urllib.request.urlopen(req, timeout=8) as response:
                data = json.loads(response.read().decode('utf-8'))
                daily = data.get('daily', {})
                times = daily.get('time', [])
                for i, dt_str in enumerate(times):
                    wmo = daily.get('weather_code', [0])[i] or 0
                    t_max = daily.get('temperature_2m_max', [30.0])[i]
                    t_min = daily.get('temperature_2m_min', [20.0])[i]
                    precip = daily.get('precipitation_sum', [0.0])[i] or 0.0
                    rain_prob = daily.get('precipitation_probability_max', [0])[i] or 0
                    
                    results.append({
                        'date': dt_str,
                        'weather_code': int(wmo),
                        'weather_condition': cls.get_weather_description(wmo),
                        'temp_max': float(t_max) if t_max is not None else 30.0,
                        'temp_min': float(t_min) if t_min is not None else 20.0,
                        'precipitation_mm': float(precip),
                        'rain_probability_percent': int(rain_prob),
                    })
        except Exception as exc:
            logger.warning(f"Error fetching 7-day forecast: {exc}")
        return results


class CalendarOccasionService:
    """Engine for Indian Holidays, Major Festivals, Long Weekends & Special Events."""

    # Fixed Annual Holidays (MM-DD)
    FIXED_HOLIDAYS = {
        '01-01': ('New Year\'s Day', 'Celebration'),
        '01-14': ('Makar Sankranti / Pongal', 'Festival'),
        '01-26': ('Republic Day (National Holiday)', 'National Holiday'),
        '02-14': ('Valentine\'s Day', 'Special Event'),
        '03-08': ('International Women\'s Day', 'Observance'),
        '04-14': ('Ambedkar Jayanti', 'National Holiday'),
        '05-01': ('May Day / Labour Day', 'Holiday'),
        '08-15': ('Independence Day (National Holiday)', 'National Holiday'),
        '10-02': ('Gandhi Jayanti (National Holiday)', 'National Holiday'),
        '10-31': ('Halloween', 'Special Event'),
        '12-25': ('Christmas Day', 'Festival'),
        '12-31': ('New Year\'s Eve', 'Celebration'),
    }

    # Major Indian Lunisolar & Variable Festival Calendar (2025 - 2027)
    VARIABLE_FESTIVALS = {
        # 2025
        '2025-02-26': ('Maha Shivratri', 'Festival'),
        '2025-03-14': ('Holi (Dhulandi)', 'Festival'),
        '2025-03-31': ('Eid-ul-Fitr', 'Festival'),
        '2025-04-18': ('Good Friday', 'Holiday'),
        '2025-06-07': ('Eid-al-Adha (Bakrid)', 'Festival'),
        '2025-07-06': ('Muharram', 'Holiday'),
        '2025-08-09': ('Raksha Bandhan', 'Festival'),
        '2025-08-16': ('Janmashtami', 'Festival'),
        '2025-08-27': ('Ganesh Chaturthi', 'Festival'),
        '2025-10-02': ('Dussehra (Vijayadashami)', 'Festival'),
        '2025-10-18': ('Karwa Chauth', 'Festival'),
        '2025-10-20': ('Diwali (Deepavali)', 'Festival'),
        '2025-10-22': ('Bhai Dooj / Govardhan Puja', 'Festival'),
        '2025-10-27': ('Chhath Puja', 'Festival'),
        '2025-11-05': ('Guru Nanak Jayanti', 'Festival'),

        # 2026
        '2026-02-15': ('Maha Shivratri', 'Festival'),
        '2026-03-04': ('Holi (Dhulandi)', 'Festival'),
        '2026-03-20': ('Eid-ul-Fitr', 'Festival'),
        '2026-04-03': ('Good Friday', 'Holiday'),
        '2026-05-27': ('Eid-al-Adha (Bakrid)', 'Festival'),
        '2026-06-25': ('Muharram', 'Holiday'),
        '2026-08-28': ('Raksha Bandhan', 'Festival'),
        '2026-09-04': ('Janmashtami', 'Festival'),
        '2026-09-14': ('Ganesh Chaturthi', 'Festival'),
        '2026-10-20': ('Dussehra (Vijayadashami)', 'Festival'),
        '2026-11-08': ('Diwali (Deepavali)', 'Festival'),
        '2026-11-10': ('Bhai Dooj', 'Festival'),
        '2026-11-15': ('Chhath Puja', 'Festival'),
        '2026-11-24': ('Guru Nanak Jayanti', 'Festival'),

        # 2027
        '2027-03-06': ('Maha Shivratri', 'Festival'),
        '2027-03-22': ('Holi', 'Festival'),
        '2027-03-10': ('Eid-ul-Fitr', 'Festival'),
        '2027-10-29': ('Diwali', 'Festival'),
    }

    @classmethod
    def get_occasion_details(cls, target_date: date) -> dict:
        """Determines holiday, weekend, long-weekend, and occasion metadata."""
        date_str = target_date.strftime('%Y-%m-%d')
        mm_dd = target_date.strftime('%m-%d')

        is_holiday = False
        holiday_name = ''
        event_name = ''
        event_category = ''

        # 1. Check Variable Festivals first
        if date_str in cls.VARIABLE_FESTIVALS:
            name, cat = cls.VARIABLE_FESTIVALS[date_str]
            is_holiday = True
            holiday_name = name
            event_name = name
            event_category = cat

        # 2. Check Fixed Holidays
        elif mm_dd in cls.FIXED_HOLIDAYS:
            name, cat = cls.FIXED_HOLIDAYS[mm_dd]
            if cat in ('National Holiday', 'Festival', 'Holiday'):
                is_holiday = True
                holiday_name = name
            event_name = name
            event_category = cat

        # 3. Check Weekend (Saturday=5, Sunday=6)
        is_weekend = target_date.weekday() in (5, 6)

        # 4. Check Long Weekend (Friday holiday or Monday holiday with weekend)
        is_long_weekend = False
        if is_holiday:
            weekday = target_date.weekday()
            if weekday in (4, 0):  # Friday or Monday
                is_long_weekend = True
        elif is_weekend:
            # Check adjacent Friday or Monday
            fri = target_date - timedelta(days=(target_date.weekday() - 4))
            mon = target_date + timedelta(days=(7 - target_date.weekday()))
            fri_str, mon_str = fri.strftime('%Y-%m-%d'), mon.strftime('%Y-%m-%d')
            fri_mmdd, mon_mmdd = fri.strftime('%m-%d'), mon.strftime('%m-%d')
            if (fri_str in cls.VARIABLE_FESTIVALS or fri_mmdd in cls.FIXED_HOLIDAYS or
                mon_str in cls.VARIABLE_FESTIVALS or mon_mmdd in cls.FIXED_HOLIDAYS):
                is_long_weekend = True

        is_event_day = bool(event_name or is_holiday or is_long_weekend)

        return {
            'is_holiday': is_holiday,
            'holiday_name': holiday_name,
            'is_weekend': is_weekend,
            'is_long_weekend': is_long_weekend,
            'is_event_day': is_event_day,
            'event_name': event_name,
            'event_category': event_category,
        }


class DailyContextSyncService:
    """Consolidates Weather + Calendar + POS Footfall into DailyFootfallContextLog."""

    @classmethod
    def sync_single_date(cls, target_date: date, force: bool = False) -> DailyFootfallContextLog:
        """Syncs all dimensions for a given target date."""
        today = timezone.localdate() if hasattr(timezone, 'localdate') else date.today()
        is_future = target_date > today

        # Load outlet coordinates
        settings_obj = RestaurantSettings.load()
        lat = float(settings_obj.latitude or 28.6139)
        lon = float(settings_obj.longitude or 77.2090)

        # Fetch Weather
        weather = WeatherCaptureService.fetch_weather_for_date(target_date, lat=lat, lon=lon)
        
        # Fetch Occasions / Holidays
        occasion = CalendarOccasionService.get_occasion_details(target_date)

        # Query POS sales & footfall if not future
        total_bills = 0
        dine_in_bills = 0
        takeaway_bills = 0
        delivery_bills = 0
        guest_count = 0
        total_sales = Decimal('0.00')
        dine_in_sales = Decimal('0.00')
        delivery_sales = Decimal('0.00')
        peak_hour = None
        top_cat = ''
        top_item = ''

        if not is_future:
            bills = Bill.objects.filter(
                created_at__date=target_date,
                status=BillStatus.PAID
            )
            total_bills = bills.count()

            if total_bills > 0:
                dine_in_bills = bills.filter(order_type=OrderType.DINE_IN).count()
                takeaway_bills = bills.filter(order_type=OrderType.TAKEAWAY).count()
                delivery_bills = bills.filter(order_type='DELIVERY').count() if hasattr(OrderType, 'DELIVERY') else 0

                total_sales = bills.aggregate(s=Sum('net_payable'))['s'] or Decimal('0.00')
                dine_in_sales = bills.filter(order_type=OrderType.DINE_IN).aggregate(s=Sum('net_payable'))['s'] or Decimal('0.00')
                
                # Estimate guest count (dine in * 2.5 pax + takeaway * 1 pax)
                guest_count = (dine_in_bills * 2) + takeaway_bills

                # Peak hour
                hour_stats = bills.annotate(hour=ExtractHour('created_at')).values('hour').annotate(cnt=Count('id')).order_by('-cnt').first()
                if hour_stats:
                    peak_hour = hour_stats.get('hour')

                # Top item sold on this day
                top_item_row = (
                    OrderItem.objects.filter(order__bill__in=bills)
                    .values('item_name')
                    .annotate(qty=Sum('quantity'))
                    .order_by('-qty')
                    .first()
                )
                if top_item_row:
                    top_item = f"{top_item_row['item_name']} (x{top_item_row['qty']})"

        snapshot_type = 'FORECAST' if is_future else 'ACTUAL'

        # Update or create record
        log_obj, _ = DailyFootfallContextLog.objects.update_or_create(
            date=target_date,
            defaults={
                'weather_condition': weather['weather_condition'],
                'weather_code': weather['weather_code'],
                'temp_max': weather['temp_max'],
                'temp_min': weather['temp_min'],
                'temp_avg': weather['temp_avg'],
                'precipitation_mm': weather['precipitation_mm'],
                'rain_probability_percent': weather['rain_probability_percent'],
                'humidity_percent': weather['humidity_percent'],

                'is_holiday': occasion['is_holiday'],
                'holiday_name': occasion['holiday_name'],
                'is_weekend': occasion['is_weekend'],
                'is_long_weekend': occasion['is_long_weekend'],
                'is_event_day': occasion['is_event_day'],
                'event_name': occasion['event_name'],
                'event_category': occasion['event_category'],

                'total_bills': total_bills,
                'dine_in_bills': dine_in_bills,
                'takeaway_bills': takeaway_bills,
                'delivery_bills': delivery_bills,
                'guest_count': guest_count,
                'total_sales': total_sales,
                'dine_in_sales': dine_in_sales,
                'delivery_sales': delivery_sales,
                'peak_hour': peak_hour,
                'top_selling_category': top_cat,
                'top_selling_item': top_item,
                'snapshot_type': snapshot_type,
            }
        )
        return log_obj

    @classmethod
    def sync_range(cls, start_date: date, end_date: date) -> int:
        """Syncs multiple dates in range."""
        current = start_date
        count = 0
        while current <= end_date:
            cls.sync_single_date(current)
            current += timedelta(days=1)
            count += 1
        return count

    @classmethod
    def generate_7_day_demand_forecast(cls) -> dict:
        """Generates 7-day predictive demand outlook using forecast weather and holidays."""
        today = timezone.localdate() if hasattr(timezone, 'localdate') else date.today()
        settings_obj = RestaurantSettings.load()
        lat = float(settings_obj.latitude or 28.6139)
        lon = float(settings_obj.longitude or 77.2090)

        # Baseline historical averages (past 30 days actuals)
        past_30_days = today - timedelta(days=30)
        hist_stats = DailyFootfallContextLog.objects.filter(
            date__gte=past_30_days,
            date__lt=today,
            snapshot_type='ACTUAL',
            total_bills__gt=0
        ).aggregate(
            avg_bills=Avg('total_bills'),
            avg_sales=Avg('total_sales'),
            avg_guests=Avg('guest_count')
        )
        base_bills = float(hist_stats['avg_bills'] or 25.0)
        base_sales = float(hist_stats['avg_sales'] or 12000.0)
        base_guests = float(hist_stats['avg_guests'] or 50.0)

        forecasts = WeatherCaptureService.fetch_7_day_forecast(lat=lat, lon=lon)
        daily_forecast_list = []

        for item in forecasts:
            dt = datetime.strptime(item['date'], '%Y-%m-%d').date()
            occasion = CalendarOccasionService.get_occasion_details(dt)

            # Demand multiplier logic based on weather + occasions
            multiplier = 1.0
            reasons = []

            # Occasion impact
            if occasion['is_holiday']:
                multiplier += 0.35
                reasons.append(f"Holiday surge ({occasion['holiday_name']}) +35%")
            elif occasion['is_weekend']:
                multiplier += 0.25
                reasons.append("Weekend footfall boost +25%")
            
            if occasion['is_long_weekend']:
                multiplier += 0.15
                reasons.append("Long-weekend dining surge +15%")

            # Weather impact
            precip = item.get('precipitation_mm', 0.0)
            t_max = item.get('temp_max', 30.0)
            
            if precip >= 10.0:
                multiplier -= 0.15
                reasons.append("Heavy rain: Dine-in slows down (-15%), delivery/hot snacks demand surges")
            elif precip >= 2.0:
                reasons.append("Moderate rain: Hot beverages & snacks demand rises")

            if t_max >= 40.0:
                reasons.append("Extreme heatwave: Daytime dine-in drops, evening AC & cold beverages surge")
            elif t_max <= 15.0:
                reasons.append("Chilly weather: Hot soups, tea & dinner rush expected")

            exp_bills = round(base_bills * multiplier)
            exp_sales = round(base_sales * multiplier, 2)
            exp_guests = round(base_guests * multiplier)

            daily_forecast_list.append({
                'date': item['date'],
                'day_name': dt.strftime('%A'),
                'weather_condition': item['weather_condition'],
                'temp_max': item['temp_max'],
                'temp_min': item['temp_min'],
                'precipitation_mm': item['precipitation_mm'],
                'rain_probability': item['rain_probability_percent'],
                'holiday_name': occasion['holiday_name'],
                'event_name': occasion['event_name'],
                'is_holiday': occasion['is_holiday'],
                'is_weekend': occasion['is_weekend'],
                'predicted_multiplier': round(multiplier, 2),
                'expected_bills': exp_bills,
                'expected_sales': exp_sales,
                'expected_guest_count': exp_guests,
                'key_insights': reasons or ["Normal expected business flow"],
            })

        return {
            'outlet_city': settings_obj.city,
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'baseline_metrics': {
                'avg_daily_bills': round(base_bills, 1),
                'avg_daily_sales': round(base_sales, 2),
                'avg_daily_guests': round(base_guests, 1),
            },
            'forecast_days': daily_forecast_list,
        }
