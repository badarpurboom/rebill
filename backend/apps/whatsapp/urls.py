from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BindTriggerView,
    CampaignViewSet,
    MessageHistoryView,
    PublicFeedbackView,
    SegmentCountsView,
    SendCampaignView,
    SimulateReplyView,
    SubmitFeedbackView,
    SyncTemplatesView,
    TemplateListView,
    TriggerCatalogueView,
    WebhookView,
    WhatsAppConfigView,
)

router = DefaultRouter()
router.register(r'campaigns', CampaignViewSet, basename='campaign')

urlpatterns = [
    path('config/', WhatsAppConfigView.as_view(), name='whatsapp-config'),
    path('templates/', TemplateListView.as_view(), name='whatsapp-templates'),
    path('templates/sync/', SyncTemplatesView.as_view(), name='whatsapp-sync-templates'),
    path('triggers/', TriggerCatalogueView.as_view(), name='whatsapp-triggers'),
    path('triggers/bind/', BindTriggerView.as_view(), name='whatsapp-bind-trigger'),
    path('messages/', MessageHistoryView.as_view(), name='whatsapp-messages'),
    path('simulate-reply/', SimulateReplyView.as_view(), name='whatsapp-simulate-reply'),
    path('segments/counts/', SegmentCountsView.as_view(), name='whatsapp-segment-counts'),
    path('campaigns/<int:pk>/send/', SendCampaignView.as_view(), name='whatsapp-send-campaign'),
    path('webhook/', WebhookView.as_view(), name='whatsapp-webhook'),
    path('feedback/<uuid:token>/', PublicFeedbackView.as_view(), name='public-feedback-detail'),
    path('feedback/<uuid:token>/submit/', SubmitFeedbackView.as_view(), name='public-feedback-submit'),
] + router.urls
