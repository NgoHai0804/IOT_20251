# app/models/notification_models.py
import uuid
from datetime import datetime

def create_notification_dict(sensor_id: str, type_: str, message: str, note: str = "") -> dict:
    """Tạo dict notification"""
    return {
        "message_id": str(uuid.uuid4()),
        "sensor_id": sensor_id,  # liên kết sensor
        "type": type_,
        "message": message,
        "note": note,
        "created_at": datetime.utcnow()
    }
