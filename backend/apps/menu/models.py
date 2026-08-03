from django.core.validators import MinValueValidator
from django.db import models


class Category(models.Model):
    """Starters / Main Course / Desserts / Drinks — owner can add more."""

    name = models.CharField(max_length=60, unique=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'menu_categories'
        verbose_name_plural = 'categories'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class FoodType(models.TextChoices):
    VEG = 'VEG', 'Veg'
    NON_VEG = 'NON_VEG', 'Non-Veg'


class MenuItem(models.Model):
    """A dish. Price lives on the variants, never on the item itself.

    Every item has at least a FULL variant; HALF is optional and priced
    manually by the owner (no auto half-of-full calculation).
    """

    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='items')
    name = models.CharField(max_length=120)
    food_type = models.CharField(max_length=8, choices=FoodType.choices, default=FoodType.VEG)
    description = models.CharField(max_length=255, blank=True)
    is_available = models.BooleanField(default=True, help_text='Out of stock ke liye off karo')
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'menu_items'
        ordering = ['category__sort_order', 'sort_order', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['category', 'name'], name='uniq_item_name_per_category'
            )
        ]

    def __str__(self):
        return self.name

    @property
    def is_veg(self):
        return self.food_type == FoodType.VEG


class Portion(models.TextChoices):
    HALF = 'HALF', 'Half'
    FULL = 'FULL', 'Full'


class MenuItemVariant(models.Model):
    """Half / Full pricing row for a menu item."""

    item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='variants')
    portion = models.CharField(max_length=4, choices=Portion.choices, default=Portion.FULL)
    price = models.DecimalField(
        max_digits=8, decimal_places=2, validators=[MinValueValidator(0)]
    )
    is_available = models.BooleanField(default=True)

    class Meta:
        db_table = 'menu_item_variants'
        ordering = ['item', '-portion']  # FULL sorts before HALF
        constraints = [
            models.UniqueConstraint(
                fields=['item', 'portion'], name='uniq_portion_per_item'
            )
        ]

    def __str__(self):
        return f'{self.item.name} — {self.get_portion_display()} ₹{self.price}'
