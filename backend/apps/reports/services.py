from datetime import datetime, timedelta
from decimal import Decimal
import io

from django.db.models import Avg, Count, F, Q, Sum
from django.utils import timezone

from apps.billing.models import Bill, BillStatus, OrderItem, PaymentMode
from apps.customers.models import Customer
from apps.settings_app.models import RestaurantSettings


def money(val):
    return Decimal(str(val or 0)).quantize(Decimal('0.01'))


def get_daily_report(target_date):
    """Daily Sales Summary for a given date."""
    if isinstance(target_date, str):
        target_date = datetime.strptime(target_date, '%Y-%m-%d').date()

    bills = Bill.objects.filter(
        created_at__date=target_date, status=BillStatus.PAID
    ).select_related('customer', 'order')

    total_bills = bills.count()
    subtotal_total = money(bills.aggregate(Sum('subtotal'))['subtotal__sum'])
    discount_total = money(bills.aggregate(Sum('discount_amount'))['discount_amount__sum'])
    taxable_total = money(bills.aggregate(Sum('taxable_amount'))['taxable_amount__sum'])
    cgst_total = money(bills.aggregate(Sum('cgst_amount'))['cgst_amount__sum'])
    sgst_total = money(bills.aggregate(Sum('sgst_amount'))['sgst_amount__sum'])
    gst_total = cgst_total + sgst_total
    net_sales = money(bills.aggregate(Sum('net_payable'))['net_payable__sum'])
    points_redeemed_total = bills.aggregate(Sum('points_redeemed'))['points_redeemed__sum'] or 0

    # Payment Mode Breakdown
    cash_sales = money(
        bills.filter(payment_mode=PaymentMode.CASH).aggregate(Sum('net_payable'))['net_payable__sum']
    )
    card_sales = money(
        bills.filter(payment_mode=PaymentMode.CARD).aggregate(Sum('net_payable'))['net_payable__sum']
    )
    upi_sales = money(
        bills.filter(payment_mode=PaymentMode.UPI).aggregate(Sum('net_payable'))['net_payable__sum']
    )

    # Cancelled bills audit
    cancelled_count = Bill.objects.filter(
        created_at__date=target_date, status=BillStatus.CANCELLED
    ).count()

    # Top selling items for that day
    order_ids = bills.values_list('order_id', flat=True)
    top_items = (
        OrderItem.objects.filter(order_id__in=order_ids)
        .values('item_name', 'portion')
        .annotate(total_qty=Sum('quantity'), total_revenue=Sum(F('unit_price') * F('quantity')))
        .order_order_by('-total_qty')[:5]
        if hasattr(OrderItem.objects, 'order_order_by')
        else OrderItem.objects.filter(order_id__in=order_ids)
        .values('item_name', 'portion')
        .annotate(total_qty=Sum('quantity'), total_revenue=Sum(F('unit_price') * F('quantity')))
        .order_by('-total_qty')[:5]
    )

    return {
        'date': target_date.strftime('%Y-%m-%d'),
        'total_bills': total_bills,
        'cancelled_count': cancelled_count,
        'subtotal': str(subtotal_total),
        'discount_total': str(discount_total),
        'taxable_total': str(taxable_total),
        'cgst_total': str(cgst_total),
        'sgst_total': str(sgst_total),
        'gst_total': str(gst_total),
        'net_sales': str(net_sales),
        'points_redeemed': points_redeemed_total,
        'payment_modes': {
            'cash': str(cash_sales),
            'card': str(card_sales),
            'upi': str(upi_sales),
        },
        'top_items': [
            {
                'item_name': item['item_name'],
                'portion': item['portion'],
                'total_qty': item['total_qty'],
                'total_revenue': str(money(item['total_revenue'])),
            }
            for item in top_items
        ],
    }


def get_weekly_report(start_date):
    """7-day sales breakdown from start_date."""
    if isinstance(start_date, str):
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()

    end_date = start_date + timedelta(days=6)
    days_data = []
    total_weekly_sales = Decimal('0.00')
    total_weekly_bills = 0

    curr = start_date
    while curr <= end_date:
        daily = get_daily_report(curr)
        days_data.append({
            'date': curr.strftime('%Y-%m-%d'),
            'day_name': curr.strftime('%a'),
            'bills': daily['total_bills'],
            'sales': daily['net_sales'],
            'gst': daily['gst_total'],
        })
        total_weekly_sales += Decimal(daily['net_sales'])
        total_weekly_bills += daily['total_bills']
        curr += timedelta(days=1)

    avg_bill = (
        money(total_weekly_sales / total_weekly_bills) if total_weekly_bills > 0 else Decimal('0.00')
    )

    return {
        'start_date': start_date.strftime('%Y-%m-%d'),
        'end_date': end_date.strftime('%Y-%m-%d'),
        'total_sales': str(total_weekly_sales),
        'total_bills': total_weekly_bills,
        'average_bill_value': str(avg_bill),
        'days': days_data,
    }


def get_monthly_report(year, month):
    """Day-by-day sales trend for a given month."""
    year, month = int(year), int(month)
    import calendar
    _, num_days = calendar.monthrange(year, month)

    start_date = datetime(year, month, 1).date()
    end_date = datetime(year, month, num_days).date()

    days_data = []
    total_monthly_sales = Decimal('0.00')
    total_monthly_gst = Decimal('0.00')
    total_monthly_bills = 0

    curr = start_date
    while curr <= end_date:
        daily = get_daily_report(curr)
        days_data.append({
            'date': curr.strftime('%Y-%m-%d'),
            'day': curr.day,
            'bills': daily['total_bills'],
            'sales': daily['net_sales'],
            'gst': daily['gst_total'],
        })
        total_monthly_sales += Decimal(daily['net_sales'])
        total_monthly_gst += Decimal(daily['gst_total'])
        total_monthly_bills += daily['total_bills']
        curr += timedelta(days=1)

    new_customers = Customer.objects.filter(
        created_at__year=year, created_at__month=month
    ).count()

    return {
        'year': year,
        'month': month,
        'month_name': start_date.strftime('%B %Y'),
        'total_sales': str(total_monthly_sales),
        'total_gst': str(total_monthly_gst),
        'total_bills': total_monthly_bills,
        'new_customers_count': new_customers,
        'days': days_data,
    }


def get_gst_report(from_date, to_date):
    """GST Compliance Register (CGST 2.5% + SGST 2.5% = 5%)."""
    if isinstance(from_date, str):
        from_date = datetime.strptime(from_date, '%Y-%m-%d').date()
    if isinstance(to_date, str):
        to_date = datetime.strptime(to_date, '%Y-%m-%d').date()

    bills = (
        Bill.objects.filter(
            created_at__date__gte=from_date,
            created_at__date__lte=to_date,
            status=BillStatus.PAID,
        )
        .select_related('customer')
        .order_by('created_at')
    )

    taxable_sum = money(bills.aggregate(Sum('taxable_amount'))['taxable_amount__sum'])
    cgst_sum = money(bills.aggregate(Sum('cgst_amount'))['cgst_amount__sum'])
    sgst_sum = money(bills.aggregate(Sum('sgst_amount'))['sgst_amount__sum'])
    total_gst = cgst_sum + sgst_sum
    total_invoice_val = money(bills.aggregate(Sum('total'))['total__sum'])

    bill_rows = []
    for b in bills:
        bill_rows.append({
            'bill_number': b.bill_number,
            'date': b.created_at.strftime('%Y-%m-%d'),
            'customer_name': b.customer.name if b.customer else 'Guest',
            'taxable_amount': str(b.taxable_amount),
            'cgst_amount': str(b.cgst_amount),
            'sgst_amount': str(b.sgst_amount),
            'total_gst': str(b.cgst_amount + b.sgst_amount),
            'total_invoice': str(b.total),
        })

    settings_row = RestaurantSettings.load()

    return {
        'from_date': from_date.strftime('%Y-%m-%d'),
        'to_date': to_date.strftime('%Y-%m-%d'),
        'gstin': settings_row.gstin,
        'restaurant_name': settings_row.restaurant_name,
        'total_bills': len(bill_rows),
        'taxable_turnover': str(taxable_sum),
        'cgst_total': str(cgst_sum),
        'sgst_total': str(sgst_sum),
        'total_gst': str(total_gst),
        'total_invoice_value': str(total_invoice_val),
        'bills': bill_rows,
    }


def get_ltv_report():
    """Customer Lifetime Value Leaderboard."""
    customers = Customer.objects.filter(is_active=True).order_by('-total_spent')[:50]

    rows = []
    for c in customers:
        rows.append({
            'id': c.id,
            'name': c.name,
            'phone': c.phone,
            'visit_count': c.visit_count,
            'total_spend': str(c.total_spent),
            'average_spend': str(c.average_bill),
            'points_balance': c.points_balance,
            'last_visit': c.last_visit_at.strftime('%Y-%m-%d') if c.last_visit_at else '—',
        })

    return {
        'total_registered_customers': Customer.objects.filter(is_active=True).count(),
        'leaderboard': rows,
    }


def generate_report_pdf(report_type, params):
    """Generate a clean downloadable PDF using ReportLab."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    elements = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=colors.HexColor('#065f46'),
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#475569'),
        spaceAfter=14,
    )

    settings_row = RestaurantSettings.load()

    if report_type == 'daily':
        data = get_daily_report(params.get('date', timezone.now().strftime('%Y-%m-%d')))
        elements.append(Paragraph(f"{settings_row.restaurant_name} — Daily Sales Report", title_style))
        elements.append(Paragraph(f"Date: {data['date']} | Total Bills: {data['total_bills']}", subtitle_style))

        table_data = [
            ['Metric', 'Amount (₹)'],
            ['Subtotal', data['subtotal']],
            ['Discount Total', data['discount_total']],
            ['Taxable Amount', data['taxable_total']],
            ['CGST (2.5%)', data['cgst_total']],
            ['SGST (2.5%)', data['sgst_total']],
            ['Total GST (5%)', data['gst_total']],
            ['Net Payable Sales', data['net_sales']],
            ['Cash Sales', data['payment_modes']['cash']],
            ['Card Sales', data['payment_modes']['card']],
            ['UPI Sales', data['payment_modes']['upi']],
        ]

    elif report_type == 'gst':
        data = get_gst_report(
            params.get('from_date', timezone.now().strftime('%Y-%m-%d')),
            params.get('to_date', timezone.now().strftime('%Y-%m-%d')),
        )
        elements.append(Paragraph(f"{settings_row.restaurant_name} — GST Compliance Tax Register", title_style))
        elements.append(Paragraph(f"Period: {data['from_date']} to {data['to_date']} | GSTIN: {data['gstin'] or 'N/A'}", subtitle_style))

        table_data = [
            ['Bill No', 'Date', 'Customer', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'Total GST (₹)'],
        ]
        for b in data['bills'][:40]:
            table_data.append([
                b['bill_number'], b['date'], b['customer_name'][:12],
                b['taxable_amount'], b['cgst_amount'], b['sgst_amount'], b['total_gst']
            ])
        table_data.append([
            'TOTAL', '', f"{data['total_bills']} Bills",
            data['taxable_turnover'], data['cgst_total'], data['sgst_total'], data['total_gst']
        ])

    else:
        elements.append(Paragraph(f"{settings_row.restaurant_name} — Sales Report", title_style))
        elements.append(Paragraph(f"Generated at: {timezone.now().strftime('%Y-%m-%d %H:%M')}", subtitle_style))
        table_data = [['Report', 'Status'], [report_type.upper(), 'Generated']]

    t = Table(table_data, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#065f46')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
    ]))

    elements.append(t)
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
