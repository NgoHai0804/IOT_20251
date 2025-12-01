from datetime import datetime
import uuid


def create_sensor_data_dict(sensor_id: str, device_id: str, value: float, sensor_type: str = "", extra: dict = None, note: str = "") -> dict:
    """
    Tạo dict sensor data để lưu vào MongoDB
    """
    return {
        "sensor_data_id": str(uuid.uuid4()),
        "sensor_id": sensor_id,
        "device_id": device_id,
        "sensor_type": sensor_type,
        "value": value,
        "extra": extra or {},
        "note": note,
        "timestamp": datetime.utcnow(),
        "created_at": datetime.utcnow()
    }
