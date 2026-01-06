import uuid
from datetime import datetime
from utils.timezone import get_vietnam_now_naive


def create_device_dict(name: str, room_id: str = None, device_type: str = "esp32", ip: str = "", status: str = "offline", enabled: bool = True, device_password: str = None, location: str = None, note: str = None) -> dict:
    """
    Tạo dict Device
    {
      "_id": "device_01",
      "name": "ESP32 Phòng Khách",
      "type": "esp32",
      "status": "online",
      "ip": "192.168.1.20",
      "enabled": true,
      "device_password": "password123" (optional)
    }
    Note: 
    - room_id đã bị bỏ, thay vào đó Room sẽ chứa device_ids
    - user_id đã bị bỏ, sử dụng bảng user_room_devices để quản lý mối liên kết
    - device_password: Mật khẩu thiết bị (tùy chọn)
    - _id: ID của thiết bị (device tự tạo và gửi lên)
    """
    device_dict = {
        "_id": f"device_{str(uuid.uuid4())[:8]}",
        "name": name,
        "type": device_type,
        "status": status,
        "ip": ip,
        "enabled": enabled,
        "created_at": get_vietnam_now_naive(),
        "updated_at": get_vietnam_now_naive()
    }
    
    if device_password:
        device_dict["device_password"] = device_password
    
    if location:
        device_dict["location"] = location
    if note:
        device_dict["note"] = note
    
    return device_dict

