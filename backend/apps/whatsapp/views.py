from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auth_app.permissions import IsOwner, IsOwnerOrCashier
from apps.customers.models import Customer

from .models import (
    Campaign,
    Direction,
    FeedbackRequest,
    MessageStatus,
    MessageTemplate,
    TriggerBinding,
    WhatsAppConfig,
    WhatsAppMessage,
)
from .serializers import (
    CampaignSerializer,
    FeedbackRequestSerializer,
    MessageTemplateSerializer,
    PublicFeedbackSerializer,
    SubmitFeedbackSerializer,
    TriggerBindingSerializer,
    WhatsAppConfigSerializer,
    WhatsAppMessageSerializer,
)
from .services import (
    segment_counts,
    send_campaign,
    sync_templates,
    trigger_catalogue,
)


class WhatsAppConfigView(generics.RetrieveUpdateAPIView):
    """Owner settings for WhatsApp credentials and trigger switches."""

    serializer_class = WhatsAppConfigSerializer
    permission_classes = [IsOwner]

    def get_object(self):
        return WhatsAppConfig.load()


class TemplateListView(generics.ListAPIView):
    """Local mirror of Meta templates."""

    queryset = MessageTemplate.objects.all()
    serializer_class = MessageTemplateSerializer
    permission_classes = [IsOwner]
    pagination_class = None


class SyncTemplatesView(APIView):
    """Pull approved templates from Meta WABA API."""

    permission_classes = [IsOwner]

    def post(self, request):
        try:
            res = sync_templates()
            return Response(res, status=status.HTTP_200_OK)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class TriggerCatalogueView(APIView):
    """List 6 automated triggers with default text and bound templates."""

    permission_classes = [IsOwner]

    def get(self, request):
        data = trigger_catalogue()
        return Response(data, status=status.HTTP_200_OK)


class BindTriggerView(APIView):
    """Bind an approved template to a trigger type."""

    permission_classes = [IsOwner]

    def post(self, request):
        serializer = TriggerBindingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trigger = serializer.validated_data['trigger']
        template = serializer.validated_data['template']

        binding, _ = TriggerBinding.objects.update_or_create(
            trigger=trigger,
            defaults={'template': template},
        )
        return Response(
            {
                'trigger': binding.trigger,
                'template': binding.template_id,
                'template_name': binding.template.name if binding.template else None,
            },
            status=status.HTTP_200_OK,
        )


class MessageHistoryView(generics.ListAPIView):
    """Message log, including simulated messages."""

    serializer_class = WhatsAppMessageSerializer
    permission_classes = [IsOwnerOrCashier]

    def get_queryset(self):
        qs = WhatsAppMessage.objects.select_related('customer', 'bill', 'template').all()
        phone = self.request.query_params.get('phone')
        if phone:
            digits = ''.join(ch for ch in phone if ch.isdigit())
            qs = qs.filter(phone__contains=digits)
        direction = self.request.query_params.get('direction')
        if direction:
            qs = qs.filter(direction=direction)
        return qs[:100]  # Return last 100 for fast UI


class SimulateReplyView(APIView):
    """On-screen simulator helper to simulate a customer reply."""

    permission_classes = [IsOwnerOrCashier]

    def post(self, request):
        phone = request.data.get('phone', '').strip()
        body = request.data.get('body', '').strip()
        if not phone or not body:
            return Response(
                {'detail': 'Both phone number and message body are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        digits = ''.join(ch for ch in phone if ch.isdigit())
        customer = Customer.objects.filter(phone=digits[-10:]).first() if len(digits) >= 10 else None

        message = WhatsAppMessage.objects.create(
            customer=customer,
            phone=phone,
            direction=Direction.IN,
            body=body,
            status=MessageStatus.RECEIVED,
            is_mock=True,
        )
        return Response(WhatsAppMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class SegmentCountsView(APIView):
    """Recipient count per customer segment for broadcast campaigns."""

    permission_classes = [IsOwner]

    def get(self, request):
        return Response(segment_counts(), status=status.HTTP_200_OK)


class CampaignViewSet(viewsets.ModelViewSet):
    """Campaign CRUD."""

    serializer_class = CampaignSerializer
    permission_classes = [IsOwner]

    def get_queryset(self):
        return Campaign.objects.select_related('template', 'created_by').all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SendCampaignView(APIView):
    """Execute a broadcast campaign."""

    permission_classes = [IsOwner]

    def post(self, request, pk=None):
        campaign = get_object_or_404(Campaign, pk=pk)
        if campaign.status == 'SENT':
            return Response(
                {'detail': 'This campaign has already been sent.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated = send_campaign(campaign, user=request.user)
        return Response(CampaignSerializer(updated).data, status=status.HTTP_200_OK)


class WebhookView(APIView):
    """Meta Webhook endpoint for challenge verification and incoming message events."""

    permission_classes = [AllowAny]

    def get(self, request):
        config = WhatsAppConfig.load()
        mode = request.query_params.get('hub.mode')
        token = request.query_params.get('hub.verify_token')
        challenge = request.query_params.get('hub.challenge')

        if mode == 'subscribe' and token and token == config.verify_token:
            return HttpResponse(challenge, content_type='text/plain', status=200)
        return HttpResponse('Verification failed', status=403)

    def post(self, request):
        # Process Meta Webhook payload if received
        payload = request.data
        try:
            entries = payload.get('entry', [])
            for entry in entries:
                for change in entry.get('changes', []):
                    value = change.get('value', {})
                    messages = value.get('messages', [])
                    for msg in messages:
                        from_phone = msg.get('from', '')
                        msg_type = msg.get('type')
                        body = ''
                        if msg_type == 'text':
                            body = msg.get('text', {}).get('body', '')

                        if from_phone and body:
                            digits = ''.join(ch for ch in from_phone if ch.isdigit())
                            customer = (
                                Customer.objects.filter(phone=digits[-10:]).first()
                                if len(digits) >= 10
                                else None
                            )
                            WhatsAppMessage.objects.create(
                                customer=customer,
                                phone=from_phone,
                                direction=Direction.IN,
                                body=body,
                                status=MessageStatus.RECEIVED,
                                is_mock=False,
                                wa_message_id=msg.get('id', ''),
                            )
        except Exception:
            pass  # Always return 200 to Meta so webhook doesn't get disabled
        return HttpResponse('EVENT_RECEIVED', status=200)


class PublicFeedbackView(generics.RetrieveAPIView):
    """Customer-facing feedback link info."""

    permission_classes = [AllowAny]
    serializer_class = PublicFeedbackSerializer
    lookup_field = 'token'
    queryset = FeedbackRequest.objects.select_related('customer', 'bill').all()


class SubmitFeedbackView(APIView):
    """Customer submits 1-5 star rating and comment."""

    permission_classes = [AllowAny]

    def post(self, request, token=None):
        feedback_req = get_object_or_404(FeedbackRequest, token=token)
        if feedback_req.is_submitted:
            return Response(
                {'detail': 'You have already submitted your rating. Thank you!'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SubmitFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        feedback_req.rating = serializer.validated_data['rating']
        feedback_req.comment = serializer.validated_data.get('comment', '')
        feedback_req.submitted_at = timezone.now()
        feedback_req.save(update_fields=['rating', 'comment', 'submitted_at'])

        return Response(
            PublicFeedbackSerializer(feedback_req).data,
            status=status.HTTP_200_OK,
        )
