from djongo import models
from datetime import datetime

class User(models.Model):
    user_id = models.AutoField(primary_key=True)
    full_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True)
    create_at = models.DateTimeField(default=datetime.now)
    update_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name
