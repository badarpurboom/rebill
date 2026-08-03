"""Seed a handful of demo customers so the POS lookup has something to find.

    python manage.py seed_customers

Only names, phones and birthdays are seeded. Visit counts, spend and points
stay at zero — those are earned through real bills, never faked, so the loyalty
ledger always matches the balance.
"""

from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.customers.models import Customer

# (name, phone, dob, anniversary)
DEMO_CUSTOMERS = [
    ('Ankit Gupta', '9811122233', date(1992, 3, 14), None),
    ('Neha Sharma', '9822233344', date(1988, 7, 2), date(2015, 11, 26)),
    ('Rohit Malhotra', '9833344455', None, None),
    ('Sneha Iyer', '9844455566', date(1995, 12, 9), None),
    ('Vikram Singh', '9855566677', None, date(2019, 2, 18)),
    ('Pooja Nair', '9866677788', date(1990, 5, 21), date(2018, 5, 21)),
]


class Command(BaseCommand):
    help = 'Seed demo customers for POS lookup.'

    @transaction.atomic
    def handle(self, *args, **options):
        created = 0
        for name, phone, dob, anniversary in DEMO_CUSTOMERS:
            _, was_new = Customer.objects.get_or_create(
                phone=phone,
                defaults={'name': name, 'dob': dob, 'anniversary': anniversary},
            )
            created += was_new

        self.stdout.write(
            self.style.SUCCESS(
                f'{created} naye customers bane ({Customer.objects.count()} total).'
            )
        )
