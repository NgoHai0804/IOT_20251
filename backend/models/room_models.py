# room_models.py
from datetime import datetime
import uuid


def create_room_dict(name: str, description: str = "", user_id: str = None) -> dict:
    """
    Tạo dict Room
    {
      "_id": "room_01",
      "name": "Phòng khách",
      "description": "Tầng 1",
      "user_id": "user_123"
    }
    Note: device_ids đã bị bỏ, sử dụng bảng user_room_devices để quản lý mối liên kết
    """
    room_dict = {
        "_id": f"room_{str(uuid.uuid4())[:8]}",  # room_01, room_02...
        "name": name,
        "description": description,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    if user_id:
        room_dict["user_id"] = user_id
    return room_dict
