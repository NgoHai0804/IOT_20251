# device_models.py
import uuid
from datetime import datetime


def create_device_dict(name: str, room_id: str = None, device_type: str = "esp32", ip: str = "", status: str = "offline", enabled: bool = True) -> dict:
    """
    Tạo dict Device
    {
      "_id": "device_01",
      "name": "ESP32 Phòng Khách",
      "type": "esp32",
      "status": "online",
      "ip": "192.168.1.20",
      "enabled": true
    }
    Note: 
    - room_id đã bị bỏ, thay vào đó Room sẽ chứa device_ids
    - user_id đã bị bỏ, sử dụng bảng user_room_devices để quản lý mối liên kết
    """
    device_dict = {
        "_id": f"device_{str(uuid.uuid4())[:8]}",  # device_01, device_02...
        "name": name,
        "type": device_type,
        "status": status,
        "ip": ip,
        "enabled": enabled,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    # room_id và user_id không còn được sử dụng
    return device_dict


def create_user_device_dict(user_id: str, device_id: str) -> dict:
    """Liên kết User <-> Device"""
    return {
        "user_id": user_id,
        "device_id": device_id,
        "created_at": datetime.utcnow()
    }
