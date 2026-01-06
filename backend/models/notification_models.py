import uuid
from datetime import datetime
from utils.timezone import get_vietnam_now_naive


def create_notification_dict(user_id: str, sensor_id: str, type_: str, message: str, note: str = "", read: bool = False) -> dict:
    """
    Tạo dict Notification
    {
      "message_id": "uuid",
      "user_id": "user_123",
      "sensor_id": "sensor_01",
      "type": "warning",
      "message": "Nhiệt độ vượt quá ngưỡng",
      "note": "",
      "read": false,
      "created_at": datetime
    }
    """
    return {
        "message_id": str(uuid.uuid4()),
        "user_id": user_id,
        "sensor_id": sensor_id,
        "type": type_,
        "message": message,
        "note": note,
        "read": read,
        "created_at": get_vietnam_now_naive()
    }
