from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from . import views

router = DefaultRouter()
router.register('users', views.UserViewSet, basename='user')

urlpatterns = [
    path('login/', views.LoginView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('verify/', TokenVerifyView.as_view(), name='token-verify'),
    path('me/', views.me, name='me'),
    path('verify-owner/', views.verify_owner, name='verify-owner'),
    path('', include(router.urls)),
]
