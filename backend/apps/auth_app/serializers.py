from django.apps import apps
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import CustomRole, Role

User = get_user_model()


class CustomRoleSerializer(serializers.ModelSerializer):
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = CustomRole
        fields = ['id', 'name', 'description', 'permissions', 'is_system', 'user_count']

    def get_user_count(self, obj):
        return obj.users.count()

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError('Role name is required.')
        qs = CustomRole.objects.filter(name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f'Role "{name}" already exists.')
        return name


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    full_name = serializers.SerializerMethodField()
    custom_role = serializers.SerializerMethodField()
    is_owner = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'role_display', 'custom_role', 'phone', 'is_active',
            'is_superuser', 'is_owner', 'date_joined', 'last_login',
        ]
        read_only_fields = ['id', 'date_joined', 'last_login', 'is_superuser', 'is_owner']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_custom_role(self, obj):
        if not obj.custom_role:
            return None
        return {
            'id': obj.custom_role.id,
            'name': obj.custom_role.name,
            'description': obj.custom_role.description,
            'permissions': obj.custom_role.permissions,
        }


class UserWriteSerializer(serializers.ModelSerializer):
    """Owner-side user management: create staff, edit roles, reset passwords."""

    password = serializers.CharField(write_only=True, required=False, min_length=4)
    email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password', 'first_name', 'last_name',
            'role', 'custom_role', 'phone', 'is_active',
        ]

    def validate_username(self, value):
        username = value.strip()
        if len(username) < 3:
            raise serializers.ValidationError('Username must be at least 3 characters.')
        qs = User.objects.filter(username__iexact=username)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f'Username "{username}" is already taken.')
        return username

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'Password is required to create a new user.'})
        
        custom_role = validated_data.get('custom_role')
        if custom_role and 'role' not in validated_data:
            role_name = custom_role.name.upper()
            if role_name in [Role.OWNER, Role.CASHIER, Role.WAITER]:
                validated_data['role'] = role_name
            else:
                validated_data['role'] = Role.CASHIER

        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        custom_role = validated_data.get('custom_role', instance.custom_role)
        
        if custom_role and 'role' not in validated_data:
            role_name = custom_role.name.upper()
            if role_name in [Role.OWNER, Role.CASHIER, Role.WAITER]:
                validated_data['role'] = role_name

        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class AdminPasswordResetSerializer(serializers.Serializer):
    """Admin resetting staff password."""
    new_password = serializers.CharField(min_length=4, write_only=True)

    def validate_new_password(self, value):
        if len(value) < 4:
            raise serializers.ValidationError('Password must be at least 4 characters.')
        return value


class ReBillTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Embeds the role in the JWT payload so React can gate routes offline."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        if user.custom_role:
            token['custom_role'] = user.custom_role.name
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class PasswordConfirmSerializer(serializers.Serializer):
    """Used when a cashier's discount exceeds the owner-set limit."""

    username = serializers.CharField()
    password = serializers.CharField()

