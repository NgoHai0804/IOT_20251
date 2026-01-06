from datetime import datetime
import uuid
from utils.timezone import get_vietnam_now_naive


def create_sensor_data_dict(sensor_id: str, value: float, timestamp: datetime = None, device_id: str = None) -> dict:
    """
    Tạo dict SensorData
    {
      "sensor_data_id": "uuid",
      "sensor_id": "sensor_01",
      "device_id": "device_01",
      "value": 30,
      "timestamp": "2025-12-21T09:30:00Z"
    }
    """
    sensor_data = {
        "sensor_data_id": str(uuid.uuid4()),
        "sensor_id": sensor_id,
        "value": value,
        "timestamp": timestamp or get_vietnam_now_naive(),
        "created_at": get_vietnam_now_naive()
    }
    if device_id:
        sensor_data["device_id"] = device_id
    return sensor_data
