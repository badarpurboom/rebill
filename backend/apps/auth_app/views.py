from django.contrib.auth import authenticate, get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Role, CustomRole
from .permissions import IsOwner, has_perm
from .serializers import (
    ReBillTokenObtainPairSerializer,
    UserSerializer,
    UserWriteSerializer,
    CustomRoleSerializer,
)

User = get_user_model()


class LoginView(TokenObtainPairView):
    """POST /api/auth/login/ → access + refresh + user profile."""

    serializer_class = ReBillTokenObtainPairSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Who am I? React calls this on boot to restore the session."""
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_owner(request):
    """Owner override — e.g. a discount above the configured max limit.

    Returns 200 only if the supplied credentials belong to an active Owner.
    Nothing is logged in or swapped; this is a one-shot approval check.
    """
    serializer = PasswordConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = authenticate(
        request,
        username=serializer.validated_data['username'],
        password=serializer.validated_data['password'],
    )
    if user is None or not user.is_active or not has_perm(user, 'owner_override'):
        return Response(
            {'approved': False, 'detail': 'Invalid owner username or password.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    return Response({'approved': True, 'approved_by': user.username})


class UserViewSet(viewsets.ModelViewSet):
    """Owner-only staff management."""

    queryset = User.objects.all()
    permission_classes = [IsOwner]
    pagination_class = None

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return UserSerializer
        return UserWriteSerializer

class CustomRoleViewSet(viewsets.ModelViewSet):
    """Owner-only role management."""
    queryset = CustomRole.objects.all()
    serializer_class = CustomRoleSerializer
    permission_classes = [IsOwner]
    pagination_class = None

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            return Response({'detail': 'Cannot delete system roles.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(custom_role=role).exists():
            return Response({'detail': 'Cannot delete role assigned to users.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)
