"""Sending, template sync and segmentation for the Meta Cloud API.

Two paths, one entry point:

  MOCK  (`config.is_live` off)  — the message is rendered and stored, and shows
        up in the on-screen simulator. Nothing leaves the machine. This is the
        default until the owner pastes real Meta credentials.

  LIVE  (`config.is_live` on)   — the same rendered text is sent to Meta as an
        approved template. Meta refuses free-form business-initiated messages,
        so a trigger with no bound template fails loudly instead of silently
        sending nothing.

A send never raises into the caller. Billing must not fail because WhatsApp is
down — the failure is recorded on the message row and the bill still closes.
"""

import logging

import requests
from django.conf import settings as django_settings
from django.db.models import Q
from django.utils import timezone

from apps.settings_app.models import RestaurantSettings

from .messages import TRIGGER_MESSAGES, render_default, render_template, template_variables
from .models import (
    Direction,
    MessageStatus,
    MessageTemplate,
    Segment,
    TemplateStatus,
    TriggerBinding,
    TriggerType,
    WhatsAppConfig,
    WhatsAppMessage,
)

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 15  # seconds — a slow Meta must not hold up a checkout


def _api_base(config):
    version = django_settings.WHATSAPP_API_VERSION
    return f'{django_settings.WHATSAPP_API_BASE}/{version}'


def to_e164(phone):
    """10-digit Indian mobile → the 91XXXXXXXXXX form Meta expects."""
    digits = ''.join(ch for ch in str(phone) if ch.isdigit())
    if len(digits) == 10:
        return f'91{digits}'
    return digits


def bound_template(trigger):
    binding = (
        TriggerBinding.objects.select_related('template').filter(trigger=trigger).first()
    )
    template = binding.template if binding else None
    return template if template and template.is_usable else None


def build_context(customer=None, extra=None):
    """Values every message may reference. Extra keys win."""
    settings_row = RestaurantSettings.load()
    context = {
        'restaurant': settings_row.restaurant_name,
        'restaurant_name': settings_row.restaurant_name,
        'name': customer.name if customer else 'Grahak',
        'customer_name': customer.name if customer else 'Grahak',
        'balance': customer.points_balance if customer else 0,
        'available_points': customer.points_balance if customer else 0,
    }
    context.update(extra or {})
    return context


def send(trigger, *, phone, customer=None, context=None, bill=None, campaign=None, body=None):
    """Render and deliver one message. Returns the stored WhatsAppMessage."""
    config = WhatsAppConfig.load()
    context = build_context(customer, context)
    template = bound_template(trigger)

    if body is None:
        body = (
            render_template(template, context, trigger)
            if template
            else render_default(trigger, context)
        )

    message = WhatsAppMessage.objects.create(
        customer=customer,
        phone=phone,
        direction=Direction.OUT,
        trigger=trigger,
        template=template,
        body=body,
        bill=bill,
        campaign=campaign,
        status=MessageStatus.QUEUED,
        is_mock=True,
    )

    use_live = config.is_live and config.is_configured and not django_settings.WHATSAPP_MOCK_MODE
    if not use_live:
        # Simulator delivery — instantly "sent", clearly flagged as mock.
        message.status = MessageStatus.SENT
        message.save(update_fields=['status', 'updated_at'])
        return message

    message.is_mock = False
    if template is None:
        _fail(
            message,
            'Meta business-initiated message ke liye approved template zaroori hai. '
            'Is trigger par template bind karo.',
        )
        return message

    try:
        response = requests.post(
            f'{_api_base(config)}/{config.phone_number_id}/messages',
            headers={
                'Authorization': f'Bearer {config.access_token}',
                'Content-Type': 'application/json',
            },
            json={
                'messaging_product': 'whatsapp',
                'to': to_e164(phone),
                'type': 'template',
                'template': {
                    'name': template.name,
                    'language': {'code': template.language},
                    'components': [
                        {
                            'type': 'body',
                            'parameters': [
                                {'type': 'text', 'parameter_name': name, 'text': str(context.get(name, ''))}
                                for name in TRIGGER_MESSAGES.get(trigger, {}).get('variables', [])
                            ],
                        }
                    ],
                },
            },
            timeout=REQUEST_TIMEOUT,
        )
        payload = response.json()
    except requests.RequestException as exc:
        _fail(message, f'Meta tak pahunch nahi paye: {exc}')
        return message
    except ValueError:
        _fail(message, 'Meta se samajh na aane wala jawab mila.')
        return message

    if response.status_code >= 400:
        detail = payload.get('error', {}).get('message', response.text[:300])
        _fail(message, f'Meta ne mana kiya: {detail}')
        return message

    message.status = MessageStatus.SENT
    message.wa_message_id = (payload.get('messages') or [{}])[0].get('id', '')
    message.save(update_fields=['status', 'wa_message_id', 'updated_at'])
    return message


def _fail(message, error):
    message.status = MessageStatus.FAILED
    message.error = error[:1000]
    message.save(update_fields=['status', 'error', 'is_mock', 'updated_at'])
    logger.warning('WhatsApp send failed for %s: %s', message.phone, error)


def send_if_enabled(trigger, *, customer, **kwargs):
    """Trigger entry point used by billing and customer registration.

    Silently does nothing when the trigger is switched off or the customer has
    no usable phone. Never raises — a WhatsApp problem must not fail a checkout.
    """
    try:
        config = WhatsAppConfig.load()
        if not config.trigger_enabled(trigger):
            return None
        if not customer or not customer.phone or not customer.is_active:
            return None
        return send(trigger, phone=customer.phone, customer=customer, **kwargs)
    except Exception:  # noqa: BLE001 - a broken message must never block billing
        logger.exception('WhatsApp trigger %s crashed', trigger)
        return None


# ── Template sync ────────────────────────────────────────────────────────
def sync_templates():
    """Pull approved templates from Meta into the local mirror.

    Returns {created, updated, total} or raises ValueError with a readable
    reason the owner can act on.
    """
    config = WhatsAppConfig.load()
    if not config.waba_id or not config.access_token:
        raise ValueError('Pehle WABA ID aur Access Token daalo, phir sync karo.')

    try:
        response = requests.get(
            f'{_api_base(config)}/{config.waba_id}/message_templates',
            headers={'Authorization': f'Bearer {config.access_token}'},
            params={'limit': 100},
            timeout=REQUEST_TIMEOUT,
        )
        payload = response.json()
    except requests.RequestException as exc:
        raise ValueError(f'Meta tak pahunch nahi paye: {exc}') from exc
    except ValueError as exc:
        raise ValueError('Meta se samajh na aane wala jawab mila.') from exc

    if response.status_code >= 400:
        detail = payload.get('error', {}).get('message', response.text[:300])
        raise ValueError(f'Meta ne mana kiya: {detail}')

    created = updated = 0
    for entry in payload.get('data', []):
        header = body = footer = ''
        for component in entry.get('components', []):
            kind = component.get('type', '').upper()
            if kind == 'HEADER':
                header = component.get('text', '')
            elif kind == 'BODY':
                body = component.get('text', '')
            elif kind == 'FOOTER':
                footer = component.get('text', '')

        _, was_created = MessageTemplate.objects.update_or_create(
            name=entry.get('name', ''),
            language=entry.get('language', 'hi'),
            defaults={
                'category': entry.get('category', ''),
                'status': entry.get('status', TemplateStatus.PENDING),
                'header_text': header,
                'body_text': body,
                'footer_text': footer,
                'variable_count': body.count('{{'),
                'meta_id': str(entry.get('id', '')),
                'synced_at': timezone.now(),
            },
        )
        created += was_created
        updated += not was_created

    config.last_synced_at = timezone.now()
    config.save(update_fields=['last_synced_at', 'updated_at'])
    return {'created': created, 'updated': updated, 'total': created + updated}


# ── Segments ─────────────────────────────────────────────────────────────
def segment_queryset(segment):
    """Customers in one segment.

    NEW      — registered but at most one visit
    REGULAR  — enough visits and seen recently
    INACTIVE — has visited before, but not within the win-back window
    """
    from apps.customers.models import Customer

    config = WhatsAppConfig.load()
    cutoff = timezone.now() - timezone.timedelta(days=config.winback_days)
    qs = Customer.objects.filter(is_active=True).exclude(phone='')

    if segment == Segment.NEW:
        return qs.filter(visit_count__lte=1)
    if segment == Segment.REGULAR:
        return qs.filter(visit_count__gte=config.regular_min_visits, last_visit_at__gte=cutoff)
    if segment == Segment.INACTIVE:
        return qs.filter(Q(last_visit_at__lt=cutoff) & Q(visit_count__gte=1))
    return qs


def segment_counts():
    return {
        segment.value: segment_queryset(segment.value).count() for segment in Segment
    }


def send_campaign(campaign, user=None):
    """Broadcast to every customer in the segment. Returns the updated campaign."""
    from .models import CampaignStatus

    recipients = list(segment_queryset(campaign.segment))
    sent = failed = 0

    for customer in recipients:
        message = send(
            TriggerType.BROADCAST,
            phone=customer.phone,
            customer=customer,
            campaign=campaign,
            context={'message': campaign.body},
            body=_personalise(campaign.body, customer),
        )
        if message.status == MessageStatus.FAILED:
            failed += 1
        else:
            sent += 1

    campaign.recipient_count = len(recipients)
    campaign.sent_count = sent
    campaign.failed_count = failed
    campaign.status = CampaignStatus.SENT
    campaign.sent_at = timezone.now()
    campaign.save(
        update_fields=['recipient_count', 'sent_count', 'failed_count', 'status', 'sent_at']
    )
    return campaign


def _personalise(body, customer):
    settings_row = RestaurantSettings.load()
    return (
        body.replace('{name}', customer.name)
        .replace('{restaurant}', settings_row.restaurant_name)
        .replace('{points}', str(customer.points_balance))
    )


def trigger_catalogue():
    """Everything the Triggers screen needs, in one call."""
    bindings = {b.trigger: b for b in TriggerBinding.objects.select_related('template')}
    config = WhatsAppConfig.load()
    rows = []
    for trigger, spec in TRIGGER_MESSAGES.items():
        binding = bindings.get(trigger)
        rows.append(
            {
                'trigger': trigger,
                'label': spec['label'],
                'display': TriggerType(trigger).label,
                'default_body': spec['body'],
                'variables': spec['variables'],
                'enabled': config.trigger_enabled(trigger),
                'template': binding.template_id if binding else None,
                'template_name': binding.template.name if binding and binding.template else None,
                'template_usable': bool(binding and binding.template and binding.template.is_usable),
            }
        )
    return rows
