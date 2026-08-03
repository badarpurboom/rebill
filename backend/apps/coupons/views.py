from decimal import Decimal
from django.shortcuts import get_object_or_404
from rest_framework import generics, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auth_app.permissions import IsOwner, IsOwnerOrCashier
from apps.customers.models import Customer
from apps.whatsapp.services import segment_queryset

from .models import Coupon, CouponUsage, generate_coupon_code
from .serializers import (
    CouponSerializer,
    CouponUsageSerializer,
    ValidateCouponSerializer,
)


class CouponViewSet(viewsets.ModelViewSet):
    """CRUD for coupons."""

    serializer_class = CouponSerializer
    permission_classes = [IsOwnerOrCashier]

    def get_queryset(self):
        qs = Coupon.objects.all()
        if self.request.query_params.get('active_only') == 'true':
            qs = [c for c in qs if c.is_valid_now]
        return qs

    def perform_create(self, serializer):
        code = serializer.validated_data.get('code')
        if not code:
            code = generate_coupon_code()
        serializer.save(code=code, created_by=self.request.user)


class ValidateCouponView(APIView):
    """POS validation endpoint for coupon application."""

    permission_classes = [IsOwnerOrCashier]

    def post(self, request):
        serializer = ValidateCouponSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        code = serializer.validated_data['code'].strip().upper()
        subtotal = serializer.validated_data['subtotal']
        customer_id = serializer.validated_data.get('customer_id')

        coupon = Coupon.objects.filter(code=code).first()
        if not coupon:
            return Response(
                {'valid': False, 'detail': 'Ghalat coupon code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not coupon.is_valid_now:
            return Response(
                {'valid': False, 'detail': 'Yeh coupon expire ho chuka hai ya inactive hai.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if subtotal < coupon.min_order_amount:
            return Response(
                {
                    'valid': False,
                    'detail': f'Yeh coupon minimum ₹{coupon.min_order_amount} ke order par chalega.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check customer segment eligibility
        if coupon.segment != 'ALL':
            if not customer_id:
                return Response(
                    {
                        'valid': False,
                        'detail': f'Yeh coupon sirf {coupon.get_segment_display()} ke liye hai. Customer select karein.',
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            customer = Customer.objects.filter(pk=customer_id).first()
            eligible_qs = segment_queryset(coupon.segment)
            if not customer or not eligible_qs.filter(pk=customer.pk).exists():
                return Response(
                    {
                        'valid': False,
                        'detail': f'Yeh customer {coupon.get_segment_display()} segment me nahi aate.',
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        discount_amount = coupon.calculate_discount(subtotal)
        return Response(
            {
                'valid': True,
                'coupon_id': coupon.id,
                'code': coupon.code,
                'discount_type': coupon.discount_type,
                'discount_value': str(coupon.discount_value),
                'discount_amount': str(discount_amount),
            },
            status=status.HTTP_200_OK,
        )


class CouponUsageHistoryView(generics.ListAPIView):
    """Log of all coupon redemptions."""

    serializer_class = CouponUsageSerializer
    permission_classes = [IsOwnerOrCashier]

    def get_queryset(self):
        return CouponUsage.objects.select_related('coupon', 'customer', 'bill').all()[:100]


class GenerateCodeView(APIView):
    """Returns a random 6-character unique coupon code."""

    permission_classes = [IsOwnerOrCashier]

    def get(self, request):
        code = generate_coupon_code()
        while Coupon.objects.filter(code=code).exists():
            code = generate_coupon_code()
        return Response({'code': code}, status=status.HTTP_200_OK)
