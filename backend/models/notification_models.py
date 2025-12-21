# app/models/notification_models.py
import uuid
from datetime import datetime


def create_notification_dict(user_id: str, sensor_id: str, type_: str, message: str, note: str = "", read: bool = False) -> dict:
    """
    Tạo dict Notification
    {
      "message_id": "uuid",
      "user_id": "user_123",  # User nhận notification
      "sensor_id": "sensor_01",  # liên kết sensor
      "type": "warning",  # warning, error, info, success
      "message": "Nhiệt độ vượt quá ngưỡng",
      "note": "",
      "read": false,
      "created_at": datetime
    }
    """
    return {
        "message_id": str(uuid.uuid4()),
        "user_id": user_id,  # User nhận notification
        "sensor_id": sensor_id,  # liên kết sensor
        "type": type_,
        "message": message,
        "note": note,
        "read": read,
        "created_at": datetime.utcnow()
    }
