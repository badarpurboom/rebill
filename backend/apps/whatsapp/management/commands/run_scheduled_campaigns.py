import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.whatsapp.models import Campaign, CampaignStatus
from apps.whatsapp.services import send_campaign

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Sends broadcast campaigns that are scheduled for now or in the past.'

    def handle(self, *args, **options):
        now = timezone.now()
        campaigns = Campaign.objects.filter(
            status=CampaignStatus.SCHEDULED,
            scheduled_at__lte=now
        )
        count = campaigns.count()
        if count == 0:
            self.stdout.write('No scheduled campaigns to send.')
            return

        self.stdout.write(f'Found {count} scheduled campaigns to send.')
        for campaign in campaigns:
            try:
                self.stdout.write(f'Sending campaign "{campaign.name}" (ID {campaign.id})...')
                send_campaign(campaign)
                self.stdout.write(f'Successfully sent campaign "{campaign.name}".')
            except Exception as e:
                logger.exception(f'Failed to send scheduled campaign {campaign.id}')
                self.stderr.write(f'Error sending campaign {campaign.id}: {e}')
