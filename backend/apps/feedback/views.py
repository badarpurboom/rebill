from django.db.models import Avg, Count
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auth_app.permissions import IsOwnerOrCashier
from apps.whatsapp.models import FeedbackRequest
from apps.whatsapp.serializers import FeedbackRequestSerializer


class FeedbackSummaryView(APIView):
    """Overall feedback stats, average rating, 1-5 star breakdown, and negative alerts (1-2 stars)."""

    permission_classes = [IsOwnerOrCashier]

    def get(self, request):
        qs = FeedbackRequest.objects.filter(submitted_at__isnull=False)

        total_count = qs.count()
        avg_rating = qs.aggregate(Avg('rating'))['rating__avg'] or 0.0

        star_counts = {
            star: qs.filter(rating=star).count() for star in range(1, 6)
        }

        # Negative feedback alerts (1-2 stars)
        negative_alerts = FeedbackRequestSerializer(
            qs.filter(rating__lte=2).order_by('-submitted_at')[:20], many=True
        ).data

        return Response(
            {
                'total_count': total_count,
                'average_rating': round(avg_rating, 1),
                'star_counts': star_counts,
                'negative_alerts_count': len(negative_alerts),
                'negative_alerts': negative_alerts,
            },
            status=status.HTTP_200_OK,
        )


class FeedbackListView(generics.ListAPIView):
    """List of all submitted customer feedbacks."""

    permission_classes = [IsOwnerOrCashier]
    serializer_class = FeedbackRequestSerializer

    def get_queryset(self):
        qs = FeedbackRequest.objects.filter(submitted_at__isnull=False).select_related('customer', 'bill')
        rating = self.request.query_params.get('rating')
        if rating:
            qs = qs.filter(rating=rating)
        if self.request.query_params.get('negative_only') == 'true':
            qs = qs.filter(rating__lte=2)
        return qs.order_by('-submitted_at')
