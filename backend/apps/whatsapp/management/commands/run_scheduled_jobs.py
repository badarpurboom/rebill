from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.customers.models import Customer
from apps.whatsapp.models import TriggerType, WhatsAppConfig
from apps.whatsapp.services import segment_queryset, send_if_enabled


class Command(BaseCommand):
    help = 'Run daily automated scheduled jobs (Birthday, Anniversary, Win-back triggers)'

    def handle(self, *args, **options):
        now = timezone.now()
        today = now.date()
        self.stdout.write(self.style.SUCCESS(f'Running scheduled jobs for {today}...'))

        config = WhatsAppConfig.load()
        birthday_count = 0
        anniversary_count = 0
        winback_count = 0

        # 1. Birthday Check
        if config.send_birthday:
            birthday_customers = Customer.objects.filter(
                is_active=True,
                dob__month=today.month,
                dob__day=today.day,
            )
            for c in birthday_customers:
                res = send_if_enabled(TriggerType.BIRTHDAY, customer=c)
                if res:
                    birthday_count += 1

        # 2. Anniversary Check
        if config.send_anniversary:
            anniversary_customers = Customer.objects.filter(
                is_active=True,
                anniversary__month=today.month,
                anniversary__day=today.day,
            )
            for c in anniversary_customers:
                res = send_if_enabled(TriggerType.ANNIVERSARY, customer=c)
                if res:
                    anniversary_count += 1

        # 3. Win-back Inactive Check
        if config.send_winback:
            inactive_customers = segment_queryset('INACTIVE')
            for c in inactive_customers:
                res = send_if_enabled(
                    TriggerType.WINBACK,
                    customer=c,
                    context={'days': config.winback_days, 'balance': c.points_balance},
                )
                if res:
                    winback_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Jobs Complete! Sent: Birthday={birthday_count}, Anniversary={anniversary_count}, Win-back={winback_count}'
            )
        )
