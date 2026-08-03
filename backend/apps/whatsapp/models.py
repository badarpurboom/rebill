import uuid

from django.conf import settings as django_settings
from django.db import models


class TriggerType(models.TextChoices):
    """The six automated messages from the requirements, plus broadcast."""

    WELCOME = 'WELCOME', 'Welcome — naya customer'
    BILL_RECEIPT = 'BILL_RECEIPT', 'Bill receipt — checkout ke baad'
    FEEDBACK = 'FEEDBACK', 'Feedback — 1-5 star link'
    WINBACK = 'WINBACK', 'Win-back — kaafi din se nahi aaye'
    BIRTHDAY = 'BIRTHDAY', 'Birthday offer'
    ANNIVERSARY = 'ANNIVERSARY', 'Anniversary offer'
    BROADCAST = 'BROADCAST', 'Broadcast campaign'


class WhatsAppConfig(models.Model):
    """Meta Cloud API credentials and trigger switches — one row.

    Secrets live here rather than in .env because the requirements put them on
    the owner's Settings page. They are never returned by the API in full; the
    serialiser masks them and only accepts writes.
    """

    SINGLETON_ID = 1

    # ── Meta credentials (Settings page) ─────────────────────────────────
    phone_number_id = models.CharField(max_length=40, blank=True)
    waba_id = models.CharField(max_length=40, blank=True, verbose_name='WABA ID')
    access_token = models.TextField(blank=True)
    app_id = models.CharField(max_length=40, blank=True)
    app_secret = models.CharField(max_length=80, blank=True)
    verify_token = models.CharField(
        max_length=60, blank=True, help_text='Owner khud set karega — Meta pe wahi daalna hai'
    )

    # Off until the owner has pasted real credentials. While off, every send
    # lands in the on-screen simulator instead of going to Meta.
    is_live = models.BooleanField(default=False)

    # ── Trigger switches ─────────────────────────────────────────────────
    send_welcome = models.BooleanField(default=True)
    send_bill_receipt = models.BooleanField(default=True)
    send_feedback_request = models.BooleanField(default=True)
    send_winback = models.BooleanField(default=True)
    send_birthday = models.BooleanField(default=True)
    send_anniversary = models.BooleanField(default=True)

    winback_days = models.PositiveIntegerField(
        default=30, help_text='Itne din na aane par win-back message jayega'
    )
    regular_min_visits = models.PositiveIntegerField(
        default=2, help_text='Itni visits ke baad customer "Regular" mana jayega'
    )

    # Where the 1-5 star feedback link points. Meta needs a public URL; on a
    # laptop this stays localhost and the link only works on the same machine.
    public_base_url = models.CharField(
        max_length=200,
        default='http://localhost:3000',
        help_text='Feedback link isi URL se banega',
    )

    last_synced_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'whatsapp_config'
        verbose_name = 'WhatsApp config'
        verbose_name_plural = 'WhatsApp config'

    def __str__(self):
        return f'WhatsApp ({"live" if self.is_live else "mock"})'

    def save(self, *args, **kwargs):
        self.pk = self.SINGLETON_ID
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=cls.SINGLETON_ID)
        return obj

    @property
    def is_configured(self):
        return bool(self.phone_number_id and self.access_token and self.waba_id)

    def trigger_enabled(self, trigger):
        return {
            TriggerType.WELCOME: self.send_welcome,
            TriggerType.BILL_RECEIPT: self.send_bill_receipt,
            TriggerType.FEEDBACK: self.send_feedback_request,
            TriggerType.WINBACK: self.send_winback,
            TriggerType.BIRTHDAY: self.send_birthday,
            TriggerType.ANNIVERSARY: self.send_anniversary,
            TriggerType.BROADCAST: True,
        }.get(trigger, False)


class TemplateStatus(models.TextChoices):
    APPROVED = 'APPROVED', 'Approved'
    PENDING = 'PENDING', 'Pending'
    REJECTED = 'REJECTED', 'Rejected'
    PAUSED = 'PAUSED', 'Paused'


class MessageTemplate(models.Model):
    """A template as Meta knows it.

    Never authored here — the owner creates and gets it approved on Meta, then
    presses Sync. This table is a local mirror so the app can bind templates to
    triggers and preview them without a round trip.
    """

    name = models.CharField(max_length=120)
    language = models.CharField(max_length=10, default='hi')
    category = models.CharField(max_length=30, blank=True)
    status = models.CharField(
        max_length=10, choices=TemplateStatus.choices, default=TemplateStatus.PENDING
    )
    header_text = models.TextField(blank=True)
    body_text = models.TextField(blank=True, help_text='{{1}}, {{2}} … placeholders')
    footer_text = models.TextField(blank=True)
    variable_count = models.PositiveSmallIntegerField(default=0)
    meta_id = models.CharField(max_length=60, blank=True)
    synced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'whatsapp_templates'
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['name', 'language'], name='uniq_template_name_lang')
        ]

    def __str__(self):
        return f'{self.name} ({self.language})'

    @property
    def is_usable(self):
        return self.status == TemplateStatus.APPROVED


class TriggerBinding(models.Model):
    """Which approved template each trigger fires.

    Unbound triggers still work in mock mode using the built-in Hindi text, so
    the flow can be demoed before Meta approves anything.
    """

    trigger = models.CharField(max_length=20, choices=TriggerType.choices, unique=True)
    template = models.ForeignKey(
        MessageTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='bindings'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'whatsapp_trigger_bindings'
        ordering = ['trigger']

    def __str__(self):
        return f'{self.get_trigger_display()} → {self.template or "default text"}'


class Direction(models.TextChoices):
    OUT = 'OUT', 'Bheja'
    IN = 'IN', 'Aaya'


class MessageStatus(models.TextChoices):
    QUEUED = 'QUEUED', 'Queued'
    SENT = 'SENT', 'Sent'
    DELIVERED = 'DELIVERED', 'Delivered'
    READ = 'READ', 'Read'
    FAILED = 'FAILED', 'Failed'
    RECEIVED = 'RECEIVED', 'Received'


class WhatsAppMessage(models.Model):
    """Every message in or out, including simulated ones.

    `body` holds the rendered Hindi text that actually went out, not the
    template with placeholders — so the simulator and the history show exactly
    what the customer saw.
    """

    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='whatsapp_messages',
    )
    phone = models.CharField(max_length=15)
    direction = models.CharField(max_length=3, choices=Direction.choices)
    trigger = models.CharField(max_length=20, choices=TriggerType.choices, blank=True)
    template = models.ForeignKey(
        MessageTemplate, on_delete=models.SET_NULL, null=True, blank=True
    )
    body = models.TextField()
    status = models.CharField(
        max_length=10, choices=MessageStatus.choices, default=MessageStatus.QUEUED
    )
    is_mock = models.BooleanField(default=True)
    wa_message_id = models.CharField(max_length=80, blank=True)
    error = models.TextField(blank=True)

    bill = models.ForeignKey(
        'billing.Bill', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='whatsapp_messages',
    )
    campaign = models.ForeignKey(
        'whatsapp.Campaign', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='messages',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'whatsapp_messages'
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['phone', '-created_at'])]

    def __str__(self):
        return f'{self.direction} {self.phone}: {self.body[:40]}'


class Segment(models.TextChoices):
    ALL = 'ALL', 'Sab customers'
    NEW = 'NEW', 'New — pehli baar aaye'
    REGULAR = 'REGULAR', 'Regular — baar baar aate hain'
    INACTIVE = 'INACTIVE', 'Inactive — kaafi din se nahi aaye'


class CampaignStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SENT = 'SENT', 'Bheja ja chuka'


class Campaign(models.Model):
    """A one-shot broadcast to a customer segment (trigger #6)."""

    name = models.CharField(max_length=120)
    segment = models.CharField(max_length=10, choices=Segment.choices, default=Segment.ALL)
    template = models.ForeignKey(
        MessageTemplate, on_delete=models.SET_NULL, null=True, blank=True
    )
    body = models.TextField(help_text='Hindi message — {name} customer ke naam se badal jayega')
    status = models.CharField(
        max_length=6, choices=CampaignStatus.choices, default=CampaignStatus.DRAFT
    )

    recipient_count = models.PositiveIntegerField(default=0)
    sent_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    sent_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'whatsapp_campaigns'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} → {self.get_segment_display()}'


class FeedbackRequest(models.Model):
    """The 1-5 star link sent after a bill.

    The token is the whole authentication: whoever holds the link can rate that
    one bill, once. No login on a customer's phone.
    """

    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    customer = models.ForeignKey(
        'customers.Customer', on_delete=models.CASCADE, related_name='feedback_requests'
    )
    bill = models.OneToOneField(
        'billing.Bill', on_delete=models.CASCADE, null=True, blank=True,
        related_name='feedback_request',
    )
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    comment = models.TextField(blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'feedback_requests'
        ordering = ['-requested_at']

    def __str__(self):
        return f'{self.customer.name}: {self.rating or "pending"}★'

    @property
    def is_submitted(self):
        return self.submitted_at is not None

    @property
    def is_negative(self):
        return self.rating is not None and self.rating <= 2
