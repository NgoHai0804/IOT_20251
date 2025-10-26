from djongo import models
from datetime import datetime
from .sensor_models import Sensor

class Notification(models.Model):
    message_id = models.AutoField(primary_key=True)
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE)
    type = models.CharField(max_length=50)
    message = models.TextField()
    note = models.TextField(blank=True)
    create_at = models.DateTimeField(default=datetime.now)

    def __str__(self):
        return f"[{self.type}] {self.message[:40]}"
