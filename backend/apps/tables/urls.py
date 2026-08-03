from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('', views.TableViewSet, basename='table')

urlpatterns = [path('', include(router.urls))]
