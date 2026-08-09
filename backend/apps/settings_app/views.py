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

import secrets
from rest_framework.views import APIView
from rest_framework.response import Response

class AITokenManagerView(APIView):
    """POST generates a new token. DELETE revokes it. Only Owner."""
    permission_classes = [IsOwner]

    def post(self, request):
        settings = RestaurantSettings.load()
        # Generate a random 32 character hex string, prefixed with POS-
        token = "POS-" + secrets.token_hex(16)
        settings.ai_connection_token = token
        settings.save()
        return Response({"token": token, "message": "New AI connection token generated."})
        
    def delete(self, request):
        settings = RestaurantSettings.load()
        settings.ai_connection_token = None
        settings.save()
        return Response({"message": "AI connection token revoked."})
