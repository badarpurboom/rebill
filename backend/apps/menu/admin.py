from django.contrib import admin

from .models import Category, MenuItem, MenuItemVariant


class VariantInline(admin.TabularInline):
    model = MenuItemVariant
    extra = 1


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'sort_order', 'is_active']
    list_editable = ['sort_order', 'is_active']


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'food_type', 'is_available']
    list_filter = ['category', 'food_type', 'is_available']
    search_fields = ['name']
    inlines = [VariantInline]
