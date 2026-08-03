from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.auth_app.permissions import IsOwner, IsOwnerOrCashier

from .models import Customer, LoyaltyReason, LoyaltyTransaction
from .serializers import (
    AdjustPointsSerializer,
    CustomerSerializer,
    LoyaltyTransactionSerializer,
)


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsOwnerOrCashier]

    def get_queryset(self):
        qs = Customer.objects.all()
        if search := self.request.query_params.get('search'):
            search = search.strip()
            qs = qs.filter(Q(name__icontains=search) | Q(phone__contains=search))
        if self.request.query_params.get('active') == 'true':
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        customer = serializer.save(created_by=self.request.user)
        try:
            from apps.whatsapp.models import TriggerType
            from apps.whatsapp.services import send_if_enabled

            send_if_enabled(TriggerType.WELCOME, customer=customer)
        except Exception:
            pass

    def perform_destroy(self, instance):
        # Bills point at customers; deleting one would orphan spend history.
        # Deactivating keeps the ledger intact and hides them from the POS.
        instance.is_active = False
        instance.save(update_fields=['is_active'])

    @action(detail=False, methods=['get'])
    def lookup(self, request):
        """Phone-first lookup for the POS: exact hit, or close matches to pick from."""
        phone = ''.join(ch for ch in request.query_params.get('phone', '') if ch.isdigit())
        if len(phone) < 4:
            raise ValidationError('Enter at least 4 digits.')

        exact = Customer.objects.filter(phone=phone[-10:]).first() if len(phone) >= 10 else None
        partial = Customer.objects.filter(phone__contains=phone)[:8]
        return Response(
            {
                'exact': CustomerSerializer(exact).data if exact else None,
                'matches': CustomerSerializer(partial, many=True).data,
            }
        )

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Visits + points ledger for one customer."""
        from apps.billing.serializers import BillListSerializer

        customer = self.get_object()
        bills = (
            customer.bills.select_related('order__table', 'created_by')
            .order_by('-created_at')[:50]
        )
        ledger = customer.loyalty_transactions.select_related('bill', 'created_by')[:50]
        return Response(
            {
                'customer': CustomerSerializer(customer).data,
                'bills': BillListSerializer(bills, many=True).data,
                'loyalty': LoyaltyTransactionSerializer(ledger, many=True).data,
            }
        )

    @action(detail=True, methods=['post'], url_path='adjust-points', permission_classes=[IsOwner])
    @transaction.atomic
    def adjust_points(self, request, pk=None):
        """Owner-only manual correction. Never allowed to push a balance negative."""
        customer = Customer.objects.select_for_update().get(pk=self.get_object().pk)
        serializer = AdjustPointsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        points = serializer.validated_data['points']

        if customer.points_balance + points < 0:
            raise ValidationError(
                f'{customer.name} only has {customer.points_balance} points available.'
            )

        entry = LoyaltyTransaction.post(
            customer,
            points,
            LoyaltyReason.ADJUST,
            note=serializer.validated_data['note'],
            user=request.user,
        )
        return Response(
            {
                'customer': CustomerSerializer(customer).data,
                'transaction': LoyaltyTransactionSerializer(entry).data,
            },
            status=status.HTTP_201_CREATED,
        )
