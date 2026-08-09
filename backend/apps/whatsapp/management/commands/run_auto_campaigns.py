import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import F, Q, OuterRef, Exists
from django.utils import timezone

from apps.customers.models import Customer
from apps.whatsapp.models import (
    AutoCampaignRule,
    AutoCampaignLog,
    AutoTriggerEvent,
    WhatsAppConfig,
)
from apps.whatsapp.services import send_template_message

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Runs daily to send WhatsApp messages based on Auto Campaign Rules.'

    def handle(self, *args, **options):
        config = WhatsAppConfig.load()
        if not config.is_live:
            self.stdout.write(self.style.WARNING("WhatsApp is in MOCK mode. Messages will be simulated."))
        
        rules = AutoCampaignRule.objects.filter(is_active=True, template__isnull=False)
        if not rules.exists():
            self.stdout.write("No active auto campaign rules found.")
            return

        today = timezone.now().date()
        total_sent = 0

        for rule in rules:
            self.stdout.write(f"Processing Rule: {rule.name} ({rule.trigger_event})")
            
            if rule.trigger_event == AutoTriggerEvent.DAYS_SINCE_LAST_VISIT:
                # Target: Customers whose last visit is older than or equal to target_days ago.
                # Cutoff: If target_days is 30, we want people who visited on or BEFORE (today - 30 days).
                cutoff_date = today - timedelta(days=rule.target_days)
                
                # Check for existing logs for THIS rule sent AFTER their last visit.
                # If they visited again, last_visit_at moves forward, so old logs don't prevent new sends.
                recent_logs = AutoCampaignLog.objects.filter(
                    customer=OuterRef('pk'),
                    rule=rule,
                    sent_at__gt=OuterRef('last_visit_at')
                )

                eligible_customers = Customer.objects.filter(
                    is_active=True,
                    last_visit_at__date__lte=cutoff_date
                ).annotate(
                    has_recent_log=Exists(recent_logs)
                ).filter(
                    has_recent_log=False
                )

                count = 0
                for customer in eligible_customers:
                    # Send message
                    try:
                        msg = send_template_message(
                            customer=customer,
                            phone=customer.phone,
                            template=rule.template,
                            trigger_name=f"AUTO_RULE_{rule.id}"
                        )
                        AutoCampaignLog.objects.create(
                            rule=rule,
                            customer=customer,
                            message=msg
                        )
                        count += 1
                    except Exception as e:
                        logger.error(f"Failed to send auto rule {rule.id} to {customer.phone}: {e}")
                        self.stdout.write(self.style.ERROR(f"Failed: {customer.phone} - {e}"))
                
                self.stdout.write(self.style.SUCCESS(f"Sent {count} messages for rule '{rule.name}'"))
                total_sent += count
            
            else:
                self.stdout.write(self.style.WARNING(f"Unknown trigger event: {rule.trigger_event}"))

        self.stdout.write(self.style.SUCCESS(f"Finished auto campaigns. Total messages sent: {total_sent}"))
