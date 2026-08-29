"""Offline Sync Views for ReBill Hybrid POS Architecture.

Handles batch synchronization of transactions (customers, orders, bills, payments)
performed locally on client devices when offline.
"""

from decimal import Decimal
import logging
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.customers.models import Customer, LoyaltyReason, LoyaltyTransaction
from apps.menu.models import MenuItemVariant, Portion
from apps.settings_app.models import RestaurantSettings
from apps.tables.models import RestaurantTable, TableStatus

from .models import (
    Bill,
    BillStatus,
    KOT,
    Order,
    OrderItem,
    OrderStatus,
    OrderType,
    PaymentMode,
)
from .services import compute_totals

logger = logging.getLogger(__name__)


class SyncPingView(APIView):
    """Lightweight endpoint for frontend to check real connectivity and clock sync."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'status': 'ok',
            'server_time': timezone.now().isoformat(),
            'app': 'ReBill Hybrid Sync',
        })


class SyncBatchView(APIView):
    """Batch Sync Endpoint for Offline-created transactions.

    Accepts an array of actions recorded by the client during offline periods.
    Processes each action atomically and returns status mapping.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        batch_id = data.get('batch_id', '')
        actions = data.get('actions', [])

        if not isinstance(actions, list):
            return Response(
                {'detail': 'actions must be a list'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = []
        settings_row = RestaurantSettings.load()
        user = request.user

        # Customer temp_id to real Customer instance mapping within this batch
        temp_customer_map = {}

        for item in actions:
            tx_id = item.get('tx_id')
            action_type = item.get('action_type')
            payload = item.get('payload', {})

            if not tx_id or not action_type:
                results.append({
                    'tx_id': tx_id,
                    'status': 'error',
                    'error': 'Missing tx_id or action_type',
                })
                continue

            try:
                if action_type == 'CREATE_CUSTOMER':
                    res = self._sync_customer(payload, user, temp_customer_map)
                    res['tx_id'] = tx_id
                    results.append(res)

                elif action_type in ('CREATE_AND_PAY_BILL', 'SYNC_BILL'):
                    res = self._sync_bill(payload, user, settings_row, temp_customer_map)
                    res['tx_id'] = tx_id
                    results.append(res)

                else:
                    results.append({
                        'tx_id': tx_id,
                        'status': 'skipped',
                        'detail': f'Unknown action_type: {action_type}',
                    })
            except Exception as exc:
                logger.exception('Failed to sync action %s: %s', tx_id, exc)
                results.append({
                    'tx_id': tx_id,
                    'status': 'error',
                    'error': str(exc),
                })

        return Response({
            'status': 'success',
            'batch_id': batch_id,
            'processed_count': len(results),
            'results': results,
            'server_time': timezone.now().isoformat(),
        })

    def _sync_customer(self, payload, user, temp_customer_map):
        temp_id = payload.get('temp_id')
        phone = (payload.get('phone') or '').strip()
        name = (payload.get('name') or '').strip() or 'Guest'
        dob = payload.get('dob') or None
        anniversary = payload.get('anniversary') or None
        note = payload.get('note') or ''

        if not phone:
            raise ValueError('Customer phone is required')

        with transaction.atomic():
            customer = Customer.objects.filter(phone=phone).first()
            created = False
            if customer is None:
                customer = Customer.objects.create(
                    name=name,
                    phone=phone,
                    dob=dob,
                    anniversary=anniversary,
                    note=note,
                    created_by=user,
                )
                created = True

                # Send WhatsApp Welcome message if enabled
                try:
                    from apps.whatsapp.models import TriggerType
                    from apps.whatsapp.services import send_if_enabled
                    send_if_enabled(
                        TriggerType.WELCOME,
                        customer=customer,
                        context={'name': customer.name},
                    )
                except Exception:
                    pass
            else:
                fields_to_update = []
                if not customer.dob and dob:
                    customer.dob = dob
                    fields_to_update.append('dob')
                if not customer.anniversary and anniversary:
                    customer.anniversary = anniversary
                    fields_to_update.append('anniversary')
                if fields_to_update:
                    customer.save(update_fields=fields_to_update)

            if temp_id:
                temp_customer_map[temp_id] = customer

            return {
                'status': 'synced',
                'customer_id': customer.pk,
                'temp_id': temp_id,
                'is_new': created,
                'name': customer.name,
                'phone': customer.phone,
                'points_balance': customer.points_balance,
            }

    def _sync_bill(self, payload, user, settings_row, temp_customer_map):
        with transaction.atomic():
            customer = None
            customer_id = payload.get('customer_id')
            customer_temp_id = payload.get('customer_temp_id')
            customer_phone = (payload.get('customer_phone') or '').strip()

            if customer_temp_id and customer_temp_id in temp_customer_map:
                customer = temp_customer_map[customer_temp_id]
            elif customer_id:
                customer = Customer.objects.filter(pk=customer_id, is_active=True).first()
            elif customer_phone:
                customer = Customer.objects.filter(phone=customer_phone, is_active=True).first()

            order_type = payload.get('order_type', OrderType.DINE_IN)
            table_id = payload.get('table_id')
            table = RestaurantTable.objects.filter(pk=table_id).first() if table_id else None
            tag_name = payload.get('tag_name', '')

            order = Order.objects.create(
                order_type=order_type,
                table=table,
                customer=customer,
                status=OrderStatus.PAID,
                tag_name=tag_name,
                created_by=user,
            )

            raw_items = payload.get('items', [])
            for it in raw_items:
                variant_id = it.get('variant_id')
                variant = MenuItemVariant.objects.filter(pk=variant_id).first() if variant_id else None
                portion_val = it.get('portion', Portion.FULL)
                unit_price_val = Decimal(str(it.get('unit_price', '0.00')))
                qty = max(1, int(it.get('quantity', 1)))

                OrderItem.objects.create(
                    order=order,
                    variant=variant,
                    item_name=it.get('item_name', 'Item'),
                    portion=portion_val,
                    food_type=it.get('food_type', ''),
                    unit_price=unit_price_val,
                    quantity=qty,
                    note=it.get('note', ''),
                )

            raw_kots = payload.get('kots', [])
            for k in raw_kots:
                kot_num = k.get('kot_number')
                if kot_num:
                    kot_obj, _ = KOT.objects.get_or_create(
                        order=order,
                        number=kot_num,
                        defaults={'created_by': user},
                    )

            bill_data = payload.get('bill', {})
            discount_percent = Decimal(str(bill_data.get('discount_percent', '0.00')))
            redeem_points = max(0, int(bill_data.get('redeem_points', 0)))
            
            subtotal = order.subtotal
            totals = compute_totals(subtotal, discount_percent, settings_row, redeem_points)

            offline_bill_no = bill_data.get('offline_bill_number', '')
            bill_number = RestaurantSettings.take_bill_number()

            payment_mode = bill_data.get('payment_mode', PaymentMode.CASH)
            if payment_mode not in PaymentMode.values:
                payment_mode = PaymentMode.CASH

            bill = Bill.objects.create(
                order=order,
                order_type=order_type,
                bill_number=bill_number,
                customer=customer,
                subtotal=totals['subtotal'],
                discount_percent=totals['discount_percent'],
                discount_amount=totals['discount_amount'],
                taxable_amount=totals['taxable_amount'],
                cgst_percent=totals['cgst_percent'],
                cgst_amount=totals['cgst_amount'],
                sgst_percent=totals['sgst_percent'],
                sgst_amount=totals['sgst_amount'],
                total=totals['total'],
                points_redeemed=totals['points_redeemed'],
                redeem_amount=totals['redeem_amount'],
                net_payable=totals['net_payable'],
                points_earned=totals['points_earned'] if customer else 0,
                status=BillStatus.PAID,
                payment_mode=payment_mode,
                paid_at=timezone.now(),
                created_by=user,
                restaurant_name=settings_row.restaurant_name,
                restaurant_address=settings_row.address,
                gstin=settings_row.gstin,
            )

            if customer:
                customer = Customer.objects.select_for_update().get(pk=customer.pk)
                customer.record_visit(bill.total)

                if bill.points_redeemed:
                    LoyaltyTransaction.post(
                        customer,
                        -bill.points_redeemed,
                        LoyaltyReason.REDEEM,
                        bill=bill,
                        note=f'Bill {bill.bill_number} (Offline Sync: {offline_bill_no})',
                        user=user,
                    )

                if bill.points_earned:
                    LoyaltyTransaction.post(
                        customer,
                        bill.points_earned,
                        LoyaltyReason.EARN,
                        bill=bill,
                        note=f'Bill {bill.bill_number} (Offline Sync: {offline_bill_no})',
                        user=user,
                    )

                try:
                    from apps.whatsapp.models import FeedbackRequest, TriggerType, WhatsAppConfig
                    from apps.whatsapp.services import send_if_enabled

                    send_if_enabled(
                        TriggerType.BILL_RECEIPT,
                        customer=customer,
                        bill=bill,
                        context={
                            'bill_number': bill.bill_number,
                            'bill_amount': str(bill.net_payable),
                            'earned_points': bill.points_earned,
                            'available_points': customer.points_balance,
                        },
                    )

                    feedback_req, _ = FeedbackRequest.objects.get_or_create(
                        customer=customer, bill=bill
                    )
                    wa_config = WhatsAppConfig.load()
                    feedback_link = f"{wa_config.public_base_url.rstrip('/')}/feedback/{feedback_req.token}"
                    send_if_enabled(
                        TriggerType.FEEDBACK,
                        customer=customer,
                        bill=bill,
                        context={'link': feedback_link},
                    )
                except Exception as wa_err:
                    logger.warning('WhatsApp trigger failed on synced bill %s: %s', bill.bill_number, wa_err)

            if table:
                table.mark(TableStatus.AVAILABLE)

            return {
                'status': 'synced',
                'order_id': order.pk,
                'bill_id': bill.pk,
                'bill_number': bill.bill_number,
                'offline_bill_number': offline_bill_no,
                'net_payable': str(bill.net_payable),
                'customer_id': customer.pk if customer else None,
            }
