from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'college'
    
    def ready(self):
        from services.face_recognition import warmup_face_model
        warmup_face_model()
