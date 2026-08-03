"""CSV / Excel billing import helper for historical data migration.

Expected columns (case-insensitive):
    bill_number   - optional (auto-generated if blank e.g. RB-0100)
    date          - YYYY-MM-DD or YYYY-MM-DD HH:MM
    customer_name - optional
    customer_phone- optional
    order_type    - DINE_IN / TAKEAWAY (default: TAKEAWAY)
    payment_mode  - CASH / CARD / UPI (default: CASH)
    total_amount  - required, number
    status        - PAID / UNPAID / CANCELLED (default: PAID)
"""

from decimal import Decimal, InvalidOperation
import pandas as pd
from django.db import transaction
from django.utils import timezone
from datetime import datetime

from apps.billing.models import Bill, BillStatus, Order, OrderStatus, OrderType, PaymentMode
from apps.customers.models import Customer


def _clean(val) -> str:
    return '' if val is None else str(val).strip()


def _amount(val):
    text = _clean(val).replace('₹', '').replace(',', '')
    if not text:
        return Decimal('0.00')
    try:
        return Decimal(text).quantize(Decimal('0.01'))
    except Exception:
        return Decimal('0.00')


@transaction.atomic
def import_bills(file_obj) -> dict:
    """Returns {created, skipped, errors: [{row, message}]}."""
    if file_obj.name.lower().endswith('.csv'):
        df = pd.read_csv(file_obj, dtype=str, keep_default_na=False)
    else:
        df = pd.read_excel(file_obj, dtype=str, keep_default_na=False)

    df.columns = [str(c).strip().lower().replace(' ', '_') for c in df.columns]

    created = 0
    skipped = 0
    errors = []

    for index, row in df.iterrows():
        row_no = index + 2
        try:
            with transaction.atomic():
                total = _amount(row.get('total_amount') or row.get('net_total') or row.get('amount'))
                if total <= 0:
                    skipped += 1
                    continue

                cust_name = _clean(row.get('customer_name'))
                cust_phone = _clean(row.get('customer_phone'))
                customer = None
                if cust_phone:
                    customer, _ = Customer.objects.get_or_create(
                        phone=cust_phone,
                        defaults={'name': cust_name or f'Customer {cust_phone}'}
                    )

                mode_str = _clean(row.get('payment_mode')).upper()
                payment_mode = PaymentMode.CASH
                if 'CARD' in mode_str:
                    payment_mode = PaymentMode.CARD
                elif 'UPI' in mode_str:
                    payment_mode = PaymentMode.UPI

                status_str = _clean(row.get('status')).upper()
                bill_status = BillStatus.PAID
                if 'UNPAID' in status_str:
                    bill_status = BillStatus.UNPAID
                elif 'CANCEL' in status_str:
                    bill_status = BillStatus.CANCELLED

                order_type_str = _clean(row.get('order_type')).upper()
                order_type = OrderType.TAKEAWAY if 'TAKEAWAY' in order_type_str or 'PARCEL' in order_type_str else OrderType.DINE_IN

                # Date parsing
                dt_str = _clean(row.get('date') or row.get('created_at'))
                created_dt = timezone.now()
                if dt_str:
                    try:
                        created_dt = timezone.make_aware(datetime.strptime(dt_str[:10], '%Y-%m-%d'))
                    except Exception:
                        pass

                order = Order.objects.create(
                    order_type=order_type,
                    status=OrderStatus.PAID if bill_status == BillStatus.PAID else OrderStatus.RUNNING,
                    customer=customer,
                    subtotal=total,
                )

                subtotal = (total / Decimal('1.05')).quantize(Decimal('0.01'))
                gst = total - subtotal
                cgst = (gst / Decimal('2')).quantize(Decimal('0.01'))
                sgst = gst - cgst

                bill = Bill.objects.create(
                    order=order,
                    customer=customer,
                    status=bill_status,
                    subtotal=subtotal,
                    cgst_amount=cgst,
                    sgst_amount=sgst,
                    net_payable=total,
                    payment_mode=payment_mode,
                    created_at=created_dt,
                    paid_at=created_dt if bill_status == BillStatus.PAID else None
                )

                custom_no = _clean(row.get('bill_number'))
                if custom_no and not Bill.objects.filter(bill_number=custom_no).exclude(id=bill.id).exists():
                    bill.bill_number = custom_no
                    bill.save(update_fields=['bill_number'])

                created += 1

        except Exception as exc:
            skipped += 1
            errors.append({'row': row_no, 'message': str(exc)})

    return {'created': created, 'skipped': skipped, 'errors': errors}
