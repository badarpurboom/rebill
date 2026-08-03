from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('categories', views.CategoryViewSet, basename='category')
router.register('items', views.MenuItemViewSet, basename='menu-item')

urlpatterns = [path('', include(router.urls))]
