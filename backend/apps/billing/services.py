"""Bill maths — the single source of truth.

The POS preview the cashier stares at and the bill that gets printed both call
`compute_totals`. If these ever diverged, a customer would be charged something
other than what was quoted, so there is exactly one implementation.

Order of operations (standard Indian restaurant bill):
    subtotal        = Σ (unit_price × qty)
    discount_amount = subtotal × discount%          ← discount before tax
    taxable_amount  = subtotal − discount_amount
    CGST            = taxable × 2.5%
    SGST            = taxable × 2.5%
    total           = taxable + CGST + SGST         ← the GST invoice value
    redeem_amount   = points × redeem value         ← tender, applied AFTER tax
    net_payable     = total − redeem_amount         ← what the customer hands over

Points sit after the tax line on purpose. Treating them as a discount would
shrink the taxable value and under-collect GST on a sale that actually happened.
"""

from decimal import ROUND_HALF_UP, Decimal

PAISE = Decimal('0.01')
ZERO = Decimal('0.00')


def money(value):
    """Round to paise, half-up — the way a till rounds, not the way floats do."""
    return Decimal(value).quantize(PAISE, rounding=ROUND_HALF_UP)


def compute_totals(subtotal, discount_percent, settings, redeem_points=0):
    subtotal = money(subtotal)
    discount_percent = Decimal(discount_percent or 0)

    discount_amount = money(subtotal * discount_percent / Decimal('100'))
    taxable_amount = money(subtotal - discount_amount)

    cgst_amount = money(taxable_amount * settings.cgst_percent / Decimal('100'))
    sgst_amount = money(taxable_amount * settings.sgst_percent / Decimal('100'))
    total = money(taxable_amount + cgst_amount + sgst_amount)

    redeem_points = max(0, int(redeem_points or 0))
    redeem_amount = money(settings.redeem_value_of(redeem_points)) if redeem_points else ZERO
    redeem_amount = min(redeem_amount, total)
    net_payable = money(total - redeem_amount)

    return {
        'subtotal': subtotal,
        'discount_percent': discount_percent.quantize(PAISE),
        'discount_amount': discount_amount,
        'taxable_amount': taxable_amount,
        'cgst_percent': settings.cgst_percent,
        'cgst_amount': cgst_amount,
        'sgst_percent': settings.sgst_percent,
        'sgst_amount': sgst_amount,
        'gst_amount': money(cgst_amount + sgst_amount),
        'total': total,
        'points_redeemed': redeem_points,
        'redeem_amount': redeem_amount,
        'net_payable': net_payable,
        'points_earned': settings.points_for_spend(total),
    }


def max_redeemable_points(total, customer, settings):
    """How many points this customer may actually spend on this bill.

    Three independent ceilings: the balance they hold, the owner's per-bill cap,
    and the bill itself. The smallest one wins.
    """
    if not settings.loyalty_enabled or customer is None:
        return 0

    balance = max(0, customer.points_balance)
    if balance < settings.loyalty_min_redeem_points:
        return 0

    cap_amount = money(money(total) * settings.loyalty_max_redeem_percent / Decimal('100'))
    if settings.loyalty_redeem_value <= 0:
        return 0

    affordable = int(cap_amount / settings.loyalty_redeem_value)
    return max(0, min(balance, affordable))
