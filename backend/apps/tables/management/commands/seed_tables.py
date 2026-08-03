"""Seed the floor map with tables and create the settings row.

    python manage.py seed_tables            # 20 tables default
    python manage.py seed_tables --count 20 --reset

Safe to re-run: aligns tables cleanly in a 5-column grid.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.settings_app.models import RestaurantSettings
from apps.tables.models import RestaurantTable

GRID_COLUMNS = 5


class Command(BaseCommand):
    help = 'Seed restaurant tables (default 20) and align floor map grid.'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=20)
        parser.add_argument('--seats', type=int, default=4)
        parser.add_argument('--reset', action='store_true', help='Reset floor layout to clean 20 tables grid')

    @transaction.atomic
    def handle(self, *args, **options):
        settings_row = RestaurantSettings.load()
        self.stdout.write(
            f'settings: {settings_row.restaurant_name} · prefix {settings_row.bill_prefix} '
            f'· GST {settings_row.gst_percent}% · max discount {settings_row.max_discount_percent}%'
        )

        target_count = options['count']

        # Update tables 1 to target_count to be active and positioned in clean 5-column grid
        for index in range(target_count):
            number = str(index + 1)
            pos_x = index % GRID_COLUMNS
            pos_y = index // GRID_COLUMNS
            seats = 2 if index % 5 == 0 else (6 if index % 8 == 0 else options['seats'])

            table, _created = RestaurantTable.objects.get_or_create(
                number=number,
                defaults={'seats': seats, 'pos_x': pos_x, 'pos_y': pos_y, 'is_active': True}
            )
            table.pos_x = pos_x
            table.pos_y = pos_y
            table.is_active = True
            table.seats = seats
            table.save(update_fields=['pos_x', 'pos_y', 'is_active', 'seats'])

        # Deactivate tables > target_count so default floor map has exactly target_count active tables
        if options['reset']:
            all_tables = RestaurantTable.objects.all()
            for t in all_tables:
                try:
                    num = int(t.number)
                    if num > target_count:
                        t.is_active = False
                        t.save(update_fields=['is_active'])
                except ValueError:
                    pass

        active_count = RestaurantTable.objects.filter(is_active=True).count()
        self.stdout.write(
            self.style.SUCCESS(
                f'Floor map updated: {active_count} active tables arranged cleanly in a {GRID_COLUMNS}-column grid.'
            )
        )
