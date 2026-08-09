from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from apps.settings_app.models import RestaurantSettings

class AITokenAuthentication(BaseAuthentication):
    """
    Validates the AI connection token from the Authorization header.
    Format: Authorization: Bearer <token>
    """
    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None
            
        token = auth_header.split(' ')[1]
        settings = RestaurantSettings.load()
        
        if not settings.ai_connection_token or token != settings.ai_connection_token:
            raise AuthenticationFailed('Invalid or missing AI Connection Token')
            
        class AIUser:
            is_authenticated = True
        return (AIUser(), token)
