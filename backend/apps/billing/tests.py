from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from apps.tables.models import RestaurantTable, TableStatus
from apps.menu.models import Category, MenuItem, Portion, MenuItemVariant
from apps.customers.models import Customer
from apps.settings_app.models import RestaurantSettings
from apps.billing.models import Order, OrderItem, Bill, KOT, OrderType, OrderStatus, BillStatus, PaymentMode

User = get_user_model()


class DineInAndTakeawayEdgeCaseTests(TestCase):
    def setUp(self):
        # Create Owner & Cashier Users
        self.owner = User.objects.create_user(
            username='test_owner',
            password='password123',
            role='OWNER',
            first_name='Owner',
            last_name='User'
        )
        self.cashier = User.objects.create_user(
            username='test_cashier',
            password='password123',
            role='CASHIER',
            first_name='Cashier',
            last_name='User'
        )

        # Settings
        self.settings = RestaurantSettings.load()
        self.settings.max_discount_percent = Decimal('10.00')
        self.settings.cgst_percent = Decimal('2.50')
        self.settings.sgst_percent = Decimal('2.50')
        self.settings.save()

        # Create Table
        self.table = RestaurantTable.objects.create(number='101', seats=4)

        # Create Category & Menu Items
        self.category = Category.objects.create(name='Main Course')
        self.item_paneer = MenuItem.objects.create(
            name='Paneer Butter Masala',
            category=self.category,
            food_type='VEG'
        )
        self.variant_full = MenuItemVariant.objects.create(
            item=self.item_paneer,
            portion=Portion.FULL,
            price=Decimal('250.00')
        )
        self.variant_half = MenuItemVariant.objects.create(
            item=self.item_paneer,
            portion=Portion.HALF,
            price=Decimal('150.00')
        )

        # Create Customer
        self.customer = Customer.objects.create(
            name='Rahul Sharma',
            phone='9876543210'
        )

        # API Client
        self.client = APIClient()
        self.client.force_authenticate(user=self.cashier)

    # 1. Full Dine-In Lifecycle Test
    def test_dine_in_full_lifecycle(self):
        # Open order on Table 101
        res = self.client.post('/api/billing/orders/open/', {'table': self.table.id})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order_id = res.data['id']

        # Verify Table status changed to OCCUPIED
        self.table.refresh_from_db()
        self.assertEqual(self.table.status, TableStatus.OCCUPIED)

        # Add Full Portion item
        res = self.client.post(f'/api/billing/orders/{order_id}/items/', {
            'variant': self.variant_full.id,
            'quantity': 2,
            'note': 'Extra butter'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Send KOT
        res = self.client.post(f'/api/billing/orders/{order_id}/kot/')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['items'][0]['quantity'], 2)

        # Attach Customer
        res = self.client.post(f'/api/billing/orders/{order_id}/customer/', {'customer': self.customer.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Generate Bill with 5% discount
        res = self.client.post(f'/api/billing/orders/{order_id}/generate-bill/', {
            'discount_percent': '5.00'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        bill_id = res.data['id']

        # Verify Table status changed to BILLED
        self.table.refresh_from_db()
        self.assertEqual(self.table.status, TableStatus.BILLED)

        # Pay Bill via Cash
        res = self.client.post(f'/api/billing/bills/{bill_id}/pay/', {'payment_mode': 'CASH'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Verify Table status changed back to AVAILABLE
        self.table.refresh_from_db()
        self.assertEqual(self.table.status, TableStatus.AVAILABLE)

    # 2. Full Takeaway Lifecycle Test
    def test_takeaway_full_lifecycle(self):
        initial_available_count = RestaurantTable.objects.filter(status=TableStatus.AVAILABLE).count()

        # Start Takeaway Order (no table)
        res = self.client.post('/api/billing/orders/takeaway/')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order_id = res.data['id']
        self.assertEqual(res.data['order_type'], OrderType.TAKEAWAY)
        self.assertIsNone(res.data['table'])

        # Add Half Portion item
        res = self.client.post(f'/api/billing/orders/{order_id}/items/', {
            'variant': self.variant_half.id,
            'quantity': 3
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Send KOT
        res = self.client.post(f'/api/billing/orders/{order_id}/kot/')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['table_number'], 'Takeaway')

        # Attach Customer
        self.client.post(f'/api/billing/orders/{order_id}/customer/', {'customer': self.customer.id})

        # Generate Bill
        res = self.client.post(f'/api/billing/orders/{order_id}/generate-bill/', {
            'discount_percent': '0.00'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        bill_id = res.data['id']
        self.assertEqual(res.data['order_type'], OrderType.TAKEAWAY)

        # Verify tables floor map was NOT affected at all
        final_available_count = RestaurantTable.objects.filter(status=TableStatus.AVAILABLE).count()
        self.assertEqual(initial_available_count, final_available_count)

        # Pay Bill via UPI
        res = self.client.post(f'/api/billing/bills/{bill_id}/pay/', {'payment_mode': 'UPI'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], BillStatus.PAID)

    # 3. Concurrent Table Open (Idempotence Edge Case)
    def test_dine_in_concurrent_open_same_table(self):
        # Cashier 1 opens table 101
        res1 = self.client.post('/api/billing/orders/open/', {'table': self.table.id})
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Cashier 2 opens same table 101 concurrently -> must return existing open order
        res2 = self.client.post('/api/billing/orders/open/', {'table': self.table.id})
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data['id'], res2.data['id'])

    # 4. Incremental KOT Generation Edge Case
    def test_incremental_kot_generation(self):
        # Open order
        res = self.client.post('/api/billing/orders/open/', {'table': self.table.id})
        order_id = res.data['id']

        # Add item 1
        self.client.post(f'/api/billing/orders/{order_id}/items/', {
            'variant': self.variant_full.id,
            'quantity': 1
        })

        # Send KOT 1
        kot1_res = self.client.post(f'/api/billing/orders/{order_id}/kot/')
        self.assertEqual(len(kot1_res.data['items']), 1)

        # Add item 2
        self.client.post(f'/api/billing/orders/{order_id}/items/', {
            'variant': self.variant_half.id,
            'quantity': 2
        })

        # Send KOT 2 -> Should ONLY contain item 2!
        kot2_res = self.client.post(f'/api/billing/orders/{order_id}/kot/')
        self.assertEqual(len(kot2_res.data['items']), 1)
        self.assertEqual(kot2_res.data['items'][0]['portion'], Portion.HALF)

    # 5. Discount Over-limit Edge Case
    def test_discount_over_limit_requires_owner_approval(self):
        res = self.client.post('/api/billing/orders/open/', {'table': self.table.id})
        order_id = res.data['id']

        self.client.post(f'/api/billing/orders/{order_id}/items/', {
            'variant': self.variant_full.id,
            'quantity': 2
        })

        # Attempt 20% discount (limit is 10%) without owner password -> Expect HTTP 400
        res = self.client.post(f'/api/billing/orders/{order_id}/generate-bill/', {
            'discount_percent': '20.00'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Attempt 20% discount with valid owner credentials -> Expect success
        res = self.client.post(f'/api/billing/orders/{order_id}/generate-bill/', {
            'discount_percent': '20.00',
            'owner_username': 'test_owner',
            'owner_password': 'password123'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(res.data['discount_percent']), Decimal('20.00'))
