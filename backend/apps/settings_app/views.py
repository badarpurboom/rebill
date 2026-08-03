from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated

from apps.auth_app.permissions import IsOwner

from .models import RestaurantSettings
from .serializers import RestaurantSettingsSerializer


class SettingsView(RetrieveUpdateAPIView):
    """GET /api/settings/ — any staff (POS needs GST rates + discount limit).
    PATCH — Owner only.
    """

    serializer_class = RestaurantSettingsSerializer

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [IsOwner()]
        return [IsAuthenticated()]

    def get_object(self):
        return RestaurantSettings.load()
