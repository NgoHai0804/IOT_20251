from djongo import models
from datetime import datetime
from .device_models import Device

class Sensor(models.Model):
    sensor_id = models.AutoField(primary_key=True)
    sensor_type = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    note = models.TextField(blank=True)
    device = models.ForeignKey(Device, on_delete=models.CASCADE)
    create_at = models.DateTimeField(default=datetime.now)
    update_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Setting(models.Model):
    sensor = models.OneToOneField(Sensor, on_delete=models.CASCADE)
    min_threshold = models.FloatField()
    max_threshold = models.FloatField()
    unit = models.CharField(max_length=20)
    report_interval = models.IntegerField()
    note = models.TextField(blank=True)
