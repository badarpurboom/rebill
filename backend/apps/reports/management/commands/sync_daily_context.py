from datetime import datetime, timedelta, date
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.reports.context_capture import DailyContextSyncService


class Command(BaseCommand):
    help = 'Syncs daily weather, calendar occasions, and restaurant footfall data into DailyFootfallContextLog.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=str,
            help='Target date to sync in YYYY-MM-DD format. Defaults to today.',
        )
        parser.add_argument(
            '--days',
            type=int,
            default=1,
            help='Number of past days to backfill/sync (e.g. --days 30).',
        )

    def handle(self, *args, **options):
        date_str = options.get('date')
        days = options.get('days', 1)

        if date_str:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            self.stdout.write(f"Syncing context for specific date: {target_date}...")
            log_obj = DailyContextSyncService.sync_single_date(target_date)
            self.stdout.write(self.style.SUCCESS(f"Successfully synced {target_date}: {log_obj}"))
            return

        today = timezone.localdate() if hasattr(timezone, 'localdate') else date.today()
        
        if days > 1:
            start_date = today - timedelta(days=days - 1)
            self.stdout.write(f"Syncing past {days} days of context from {start_date} to {today}...")
            count = DailyContextSyncService.sync_range(start_date, today)
            self.stdout.write(self.style.SUCCESS(f"Successfully synced {count} days of context logs!"))
        else:
            self.stdout.write(f"Syncing today's context ({today})...")
            log_obj = DailyContextSyncService.sync_single_date(today)
            self.stdout.write(self.style.SUCCESS(f"Successfully synced today: {log_obj}"))
