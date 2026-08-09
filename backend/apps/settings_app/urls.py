from django.urls import path

from . import views

urlpatterns = [
    path('', views.SettingsView.as_view(), name='settings'),
    path('ai-token/', views.AITokenManagerView.as_view(), name='ai-token'),
]
