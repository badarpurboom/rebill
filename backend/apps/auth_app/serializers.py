from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'full_name',
            'role', 'role_display', 'phone', 'is_active', 'date_joined',
        ]
        read_only_fields = ['id', 'date_joined']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class UserWriteSerializer(serializers.ModelSerializer):
    """Owner-side user management: create staff, reset passwords."""

    password = serializers.CharField(write_only=True, required=False, min_length=4)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'password', 'first_name', 'last_name',
            'role', 'phone', 'is_active',
        ]

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'Naya user banane ke liye password zaroori hai.'})
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class ReBillTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Embeds the role in the JWT payload so React can gate routes offline."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class PasswordConfirmSerializer(serializers.Serializer):
    """Used when a cashier's discount exceeds the owner-set limit."""

    username = serializers.CharField()
    password = serializers.CharField()
