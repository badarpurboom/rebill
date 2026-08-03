from django.urls import path

from .views import FeedbackListView, FeedbackSummaryView

urlpatterns = [
    path('summary/', FeedbackSummaryView.as_view(), name='feedback-summary'),
    path('', FeedbackListView.as_view(), name='feedback-list'),
]
