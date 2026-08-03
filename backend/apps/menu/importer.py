"""CSV / Excel menu import.

Expected columns (case-insensitive, extra columns ignored):

    category     — required, created if missing
    name         — required
    food_type    — veg / non-veg / non veg / nonveg   (default: veg)
    full_price   — required, number
    half_price   — optional, number; blank = no Half variant
    description  — optional

Rows are upserted: an existing item in the same category is updated in place
rather than duplicated, so an owner can re-import a corrected sheet.
"""

from decimal import Decimal, InvalidOperation

import pandas as pd
from django.db import transaction

from .models import Category, FoodType, MenuItem, MenuItemVariant, Portion

REQUIRED_COLUMNS = {'category', 'name', 'full_price'}
NON_VEG_TOKENS = {'non-veg', 'non veg', 'nonveg', 'non_veg', 'n', 'nv', 'no'}


def _read(file_obj) -> pd.DataFrame:
    if file_obj.name.lower().endswith('.csv'):
        return pd.read_csv(file_obj, dtype=str, keep_default_na=False)
    return pd.read_excel(file_obj, dtype=str, keep_default_na=False)


def _clean(value) -> str:
    return '' if value is None else str(value).strip()


def _price(value):
    text = _clean(value).replace('₹', '').replace(',', '')
    if not text:
        return None
    try:
        amount = Decimal(text)
    except InvalidOperation:
        raise ValueError(f'"{value}" ek valid price nahi hai')
    if amount < 0:
        raise ValueError('Price negative nahi ho sakta')
    return amount.quantize(Decimal('0.01'))


def _food_type(value) -> str:
    return FoodType.NON_VEG if _clean(value).lower() in NON_VEG_TOKENS else FoodType.VEG


@transaction.atomic
def import_menu(file_obj) -> dict:
    """Returns {created, updated, skipped, errors: [{row, message}]}."""
    df = _read(file_obj)
    df.columns = [str(c).strip().lower().replace(' ', '_') for c in df.columns]

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(
            'Yeh columns file me nahi mile: ' + ', '.join(sorted(missing))
        )

    category_cache = {c.name.lower(): c for c in Category.objects.all()}
    created = updated = skipped = 0
    errors = []

    for index, row in df.iterrows():
        row_no = index + 2  # +1 for zero-index, +1 for the header line
        try:
            # Savepoint per row: one bad row rolls back alone, the sheet lives on.
            with transaction.atomic():
                category_name = _clean(row.get('category'))
                item_name = _clean(row.get('name'))
                if not category_name or not item_name:
                    skipped += 1
                    continue

                full_price = _price(row.get('full_price'))
                if full_price is None:
                    raise ValueError('full_price khaali hai')
                half_price = _price(row.get('half_price')) if 'half_price' in df.columns else None

                key = category_name.lower()
                category = category_cache.get(key)
                if category is None:
                    category = Category.objects.create(
                        name=category_name, sort_order=len(category_cache)
                    )
                    category_cache[key] = category

                item, was_created = MenuItem.objects.update_or_create(
                    category=category,
                    name=item_name,
                    defaults={
                        'food_type': _food_type(row.get('food_type')),
                        'description': _clean(row.get('description'))[:255],
                    },
                )
                created += was_created
                updated += not was_created

                MenuItemVariant.objects.update_or_create(
                    item=item, portion=Portion.FULL, defaults={'price': full_price}
                )
                if half_price is not None:
                    MenuItemVariant.objects.update_or_create(
                        item=item, portion=Portion.HALF, defaults={'price': half_price}
                    )
                else:
                    item.variants.filter(portion=Portion.HALF).delete()

        except Exception as exc:  # one bad row must not kill the whole sheet
            skipped += 1
            errors.append({'row': row_no, 'message': str(exc)})
            # A rolled-back savepoint may have discarded a freshly made category.
            category_cache = {c.name.lower(): c for c in Category.objects.all()}

    return {'created': created, 'updated': updated, 'skipped': skipped, 'errors': errors}
