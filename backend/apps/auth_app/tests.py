from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import CustomRole, Role

User = get_user_model()


class StaffAndRoleManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Owner Role
        self.owner_role, _ = CustomRole.objects.get_or_create(
            name="Owner",
            defaults={
                "description": "Full system administrator access",
                "is_system": True,
                "permissions": {"view_dashboard": True, "manage_staff": True, "view_settings": True},
            },
        )

        # Create Cashier Role
        self.cashier_role, _ = CustomRole.objects.get_or_create(
            name="Cashier",
            defaults={
                "description": "Floor cashier for taking orders and settling bills",
                "is_system": True,
                "permissions": {"view_pos": True, "punch_order": True, "settle_bill": True},
            },
        )

        # Create Owner User
        self.owner_user = User.objects.create_user(
            username="owner_admin",
            password="ownerpassword123",
            first_name="Owner",
            last_name="Boss",
            role=Role.OWNER,
            custom_role=self.owner_role,
        )

        # Create Cashier User
        self.cashier_user = User.objects.create_user(
            username="cashier_rahul",
            password="cashierpassword123",
            first_name="Rahul",
            last_name="Sharma",
            role=Role.CASHIER,
            custom_role=self.cashier_role,
        )

    def test_permissions_endpoint(self):
        self.client.force_authenticate(user=self.owner_user)
        response = self.client.get("/api/auth/permissions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("modules", response.data)
        self.assertIn("all_permissions", response.data)
        self.assertTrue(len(response.data["modules"]) > 0)

    def test_create_staff_user(self):
        self.client.force_authenticate(user=self.owner_user)
        payload = {
            "username": "waiter_amit",
            "password": "waiterpass123",
            "first_name": "Amit",
            "last_name": "Kumar",
            "phone": "9876543210",
            "email": "amit@example.com",
            "custom_role": self.cashier_role.id,
            "is_active": True,
        }
        response = self.client.post("/api/auth/users/", payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "waiter_amit")
        self.assertTrue(User.objects.filter(username="waiter_amit").exists())

    def test_create_staff_duplicate_username_fails(self):
        self.client.force_authenticate(user=self.owner_user)
        payload = {
            "username": "cashier_rahul",
            "password": "somepassword",
            "custom_role": self.cashier_role.id,
        }
        response = self.client.post("/api/auth/users/", payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_reset_password(self):
        self.client.force_authenticate(user=self.owner_user)
        url = f"/api/auth/users/{self.cashier_user.id}/reset-password/"
        response = self.client.post(url, {"new_password": "brandnewpassword999"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify new password works
        self.cashier_user.refresh_from_db()
        self.assertTrue(self.cashier_user.check_password("brandnewpassword999"))

    def test_prevent_self_deletion(self):
        self.client.force_authenticate(user=self.owner_user)
        url = f"/api/auth/users/{self.owner_user.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(User.objects.filter(username="owner_admin").exists())

    def test_create_and_manage_custom_role(self):
        self.client.force_authenticate(user=self.owner_user)
        role_payload = {
            "name": "Kitchen Head",
            "description": "Manages kitchen orders and inventory",
            "permissions": {"view_kot": True, "manage_kot": True},
        }
        response = self.client.post("/api/auth/roles/", role_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        role_id = response.data["id"]

        # Create user with this role
        kitchen_user = User.objects.create_user(
            username="chef_suresh",
            password="chefpass123",
            custom_role_id=role_id,
        )

        # Dynamic permission check
        self.assertTrue(kitchen_user.has_perm_dynamic("view_kot"))
        self.assertFalse(kitchen_user.has_perm_dynamic("settle_bill"))

        # Cannot delete role while user is assigned
        del_response = self.client.delete(f"/api/auth/roles/{role_id}/")
        self.assertEqual(del_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("chef_suresh", del_response.data["detail"])

        # Reassign user, now deletion should succeed
        kitchen_user.custom_role = self.cashier_role
        kitchen_user.save()

        del_response_2 = self.client.delete(f"/api/auth/roles/{role_id}/")
        self.assertEqual(del_response_2.status_code, status.HTTP_204_NO_CONTENT)

    def test_cannot_delete_system_role(self):
        self.client.force_authenticate(user=self.owner_user)
        response = self.client.delete(f"/api/auth/roles/{self.owner_role.id}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
