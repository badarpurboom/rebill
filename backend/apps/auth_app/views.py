from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Role, CustomRole
from .permissions import IsOwner, has_perm
from .permissions_spec import PERMISSION_MODULES, ALL_PERMISSIONS
from .serializers import (
    AdminPasswordResetSerializer,
    CustomRoleSerializer,
    PasswordConfirmSerializer,
    ReBillTokenObtainPairSerializer,
    UserSerializer,
    UserWriteSerializer,
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_permissions(request):
    """Return all available system permissions grouped by functional module."""
    return Response({
        'modules': PERMISSION_MODULES,
        'all_permissions': ALL_PERMISSIONS,
    })


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
    """Owner/Admin staff management with search, filters, and safety guards."""

    queryset = User.objects.all().select_related('custom_role')
    permission_classes = [IsOwner]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        role_id = self.request.query_params.get('role', '').strip()
        is_active = self.request.query_params.get('is_active', '').strip()

        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(email__icontains=search)
            )

        if role_id:
            if role_id.isdigit():
                qs = qs.filter(custom_role_id=int(role_id))
            else:
                qs = qs.filter(Q(role__iexact=role_id) | Q(custom_role__name__iexact=role_id))

        if is_active.lower() in ('true', '1'):
            qs = qs.filter(is_active=True)
        elif is_active.lower() in ('false', '0'):
            qs = qs.filter(is_active=False)

        return qs

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return UserSerializer
        return UserWriteSerializer

    def perform_update(self, serializer):
        user = self.get_object()
        if user.pk == self.request.user.pk:
            if serializer.validated_data.get('is_active') is False:
                raise serializer.ValidationError({'is_active': 'Aap apna account deactivate nahi kar sakte.'})
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response(
                {'detail': 'Aap apna khud ka account delete nahi kar sakte.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = AdminPasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'detail': f'User "{user.username}" ka password successfully change ho gaya.'})


class CustomRoleViewSet(viewsets.ModelViewSet):
    """Owner/Admin role management with safety protection for system and assigned roles."""

    queryset = CustomRole.objects.all().prefetch_related('users')
    serializer_class = CustomRoleSerializer
    permission_classes = [IsOwner]
    pagination_class = None

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            return Response(
                {'detail': f'System role "{role.name}" cannot be deleted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        assigned_users = User.objects.filter(custom_role=role)
        if assigned_users.exists():
            user_names = list(assigned_users.values_list('username', flat=True)[:5])
            suffix = '...' if assigned_users.count() > 5 else ''
            return Response(
                {
                    'detail': f'Cannot delete role "{role.name}" because it is assigned to {assigned_users.count()} staff member(s): {", ".join(user_names)}{suffix}. Please reassign them first.'
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

