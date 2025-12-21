# user_room_device_models.py
from datetime import datetime
import uuid


def create_user_room_device_dict(user_id: str, device_id: str, room_id: str = None) -> dict:
    """
    Tạo dict UserRoomDevice - Quản lý mối liên kết User-Room-Device
    {
      "_id": "ObjectId",
      "user_id": "user_123",
      "room_id": "room_01",  # Có thể null nếu device không thuộc phòng nào
      "device_id": "device_01",
      "created_at": "2025-12-21T09:30:00Z",
      "updated_at": "2025-12-21T09:30:00Z"
    }
    
    Mục đích:
    - Một device có thể được nhiều user quản lý
    - Một device có thể thuộc nhiều room (mỗi user có thể đặt device vào room khác nhau)
    - Một device có thể không thuộc room nào (room_id = null)
    """
    return {
        "user_id": user_id,
        "device_id": device_id,
        "room_id": room_id,  # Có thể None
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
