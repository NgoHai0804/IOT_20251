from djongo import models
from datetime import datetime
from .user_models import User

class Device(models.Model):
    device_serial = models.CharField(primary_key=True, max_length=50)
    device_name = models.CharField(max_length=100)
    device_type = models.CharField(max_length=50)
    location = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=10, choices=[('online', 'Online'), ('offline', 'Offline')])
    create_at = models.DateTimeField(default=datetime.now)
    update_at = models.DateTimeField(auto_now=True)
    note = models.TextField(blank=True)

    def __str__(self):
        return f"{self.device_name} ({self.device_serial})"


class UserDevice(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    device = models.ForeignKey(Device, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('user', 'device')
