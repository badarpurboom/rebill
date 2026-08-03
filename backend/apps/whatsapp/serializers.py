from rest_framework import serializers

from .models import (
    Campaign,
    FeedbackRequest,
    MessageTemplate,
    Segment,
    TriggerBinding,
    TriggerType,
    WhatsAppConfig,
    WhatsAppMessage,
)

SECRET_FIELDS = ('access_token', 'app_secret')


def mask(value):
    """Show enough to recognise the value, never enough to use it."""
    if not value:
        return ''
    return f'••••{value[-4:]}' if len(value) > 4 else '••••'


class WhatsAppConfigSerializer(serializers.ModelSerializer):
    """Secrets are write-only.

    A permanent Meta token is as good as the account itself, so it goes in and
    never comes back out. The UI shows a masked hint and an "already set" flag
    so the owner can tell it is stored without being able to read it.
    """

    access_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    app_secret = serializers.CharField(write_only=True, required=False, allow_blank=True)

    access_token_hint = serializers.SerializerMethodField()
    app_secret_hint = serializers.SerializerMethodField()
    has_access_token = serializers.SerializerMethodField()
    has_app_secret = serializers.SerializerMethodField()
    is_configured = serializers.BooleanField(read_only=True)
    webhook_url = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppConfig
        fields = [
            'phone_number_id', 'waba_id', 'app_id', 'verify_token',
            'access_token', 'app_secret',
            'access_token_hint', 'app_secret_hint', 'has_access_token', 'has_app_secret',
            'is_live', 'is_configured', 'webhook_url',
            'send_welcome', 'send_bill_receipt', 'send_feedback_request',
            'send_winback', 'send_birthday', 'send_anniversary',
            'winback_days', 'regular_min_visits', 'public_base_url',
            'last_synced_at', 'updated_at',
        ]
        read_only_fields = ['last_synced_at', 'updated_at']

    def get_access_token_hint(self, obj):
        return mask(obj.access_token)

    def get_app_secret_hint(self, obj):
        return mask(obj.app_secret)

    def get_has_access_token(self, obj):
        return bool(obj.access_token)

    def get_has_app_secret(self, obj):
        return bool(obj.app_secret)

    def get_webhook_url(self, obj):
        request = self.context.get('request')
        path = '/api/whatsapp/webhook/'
        return request.build_absolute_uri(path) if request else path

    def update(self, instance, validated_data):
        # A blank secret means "leave it alone", not "erase it" — the UI cannot
        # prefill what it is never allowed to read.
        for field in SECRET_FIELDS:
            if field in validated_data and not validated_data[field]:
                validated_data.pop(field)
        return super().update(instance, validated_data)

    def validate(self, attrs):
        going_live = attrs.get('is_live', self.instance.is_live if self.instance else False)
        if going_live:
            merged = {
                'phone_number_id': attrs.get('phone_number_id', self.instance.phone_number_id),
                'waba_id': attrs.get('waba_id', self.instance.waba_id),
                'access_token': attrs.get('access_token') or self.instance.access_token,
            }
            missing = [key for key, value in merged.items() if not value]
            if missing:
                raise serializers.ValidationError(
                    {'is_live': f'Live karne se pehle yeh bharo: {", ".join(missing)}'}
                )
        return attrs


class MessageTemplateSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_usable = serializers.BooleanField(read_only=True)

    class Meta:
        model = MessageTemplate
        fields = [
            'id', 'name', 'language', 'category', 'status', 'status_display',
            'header_text', 'body_text', 'footer_text', 'variable_count',
            'is_usable', 'synced_at',
        ]


class TriggerBindingSerializer(serializers.Serializer):
    trigger = serializers.ChoiceField(choices=TriggerType.choices)
    template = serializers.PrimaryKeyRelatedField(
        queryset=MessageTemplate.objects.all(), allow_null=True
    )


class WhatsAppMessageSerializer(serializers.ModelSerializer):
    direction_display = serializers.CharField(source='get_direction_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    trigger_display = serializers.CharField(source='get_trigger_display', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True, default=None)
    bill_number = serializers.CharField(source='bill.bill_number', read_only=True, default=None)

    class Meta:
        model = WhatsAppMessage
        fields = [
            'id', 'customer', 'customer_name', 'phone', 'direction', 'direction_display',
            'trigger', 'trigger_display', 'body', 'status', 'status_display',
            'is_mock', 'error', 'bill_number', 'campaign', 'created_at',
        ]


class CampaignSerializer(serializers.ModelSerializer):
    segment_display = serializers.CharField(source='get_segment_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.username', read_only=True, default=None
    )

    class Meta:
        model = Campaign
        fields = [
            'id', 'name', 'segment', 'segment_display', 'template', 'body',
            'status', 'status_display', 'recipient_count', 'sent_count', 'failed_count',
            'sent_at', 'created_by_name', 'created_at',
        ]
        read_only_fields = [
            'status', 'recipient_count', 'sent_count', 'failed_count', 'sent_at',
        ]

    def validate_body(self, value):
        value = value.strip()
        if len(value) < 10:
            raise serializers.ValidationError('Message thoda lamba likho (kam se kam 10 akshar).')
        return value

    def validate_segment(self, value):
        if value not in dict(Segment.choices):
            raise serializers.ValidationError('Yeh segment nahi hai.')
        return value


class FeedbackRequestSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    bill_number = serializers.CharField(source='bill.bill_number', read_only=True, default=None)
    is_negative = serializers.BooleanField(read_only=True)

    class Meta:
        model = FeedbackRequest
        fields = [
            'id', 'token', 'customer', 'customer_name', 'customer_phone',
            'bill_number', 'rating', 'comment', 'is_negative',
            'requested_at', 'submitted_at',
        ]


class PublicFeedbackSerializer(serializers.ModelSerializer):
    """What the customer's phone sees — no ids, no internals."""

    restaurant_name = serializers.SerializerMethodField()
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    bill_number = serializers.CharField(source='bill.bill_number', read_only=True, default=None)
    bill_total = serializers.DecimalField(
        source='bill.net_payable', max_digits=10, decimal_places=2,
        read_only=True, default=None,
    )

    class Meta:
        model = FeedbackRequest
        fields = [
            'restaurant_name', 'customer_name', 'bill_number', 'bill_total',
            'rating', 'comment', 'submitted_at',
        ]
        read_only_fields = fields

    def get_restaurant_name(self, obj):
        from apps.settings_app.models import RestaurantSettings

        return RestaurantSettings.load().restaurant_name


class SubmitFeedbackSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=1000, required=False, allow_blank=True, default='')
