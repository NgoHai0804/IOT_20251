from djongo import models
from datetime import datetime
from .sensor_models import Sensor


class SensorData(models.Model):
    sensor_data_id = models.AutoField(primary_key=True)
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(default=datetime.now)
    value = models.FloatField()
    extra = models.CharField(max_length=200, blank=True)
    note = models.TextField(blank=True)
