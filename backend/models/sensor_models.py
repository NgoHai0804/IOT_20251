# sensor_models.py
from datetime import datetime
import uuid


def create_sensor_dict(name: str, sensor_type: str, device_id: str, note: str = "") -> dict:
    return {
        "sensor_id": str(uuid.uuid4()),
        "name": name,
        "sensor_type": sensor_type,
        "device_id": device_id,
        "note": note,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

def create_setting_dict(sensor_id: str, min_threshold: float, max_threshold: float, unit: str, report_interval: int, note: str = "") -> dict:
    return {
        "sensor_id": sensor_id,
        "min_threshold": min_threshold,
        "max_threshold": max_threshold,
        "unit": unit,
        "report_interval": report_interval,
        "note": note
    }
