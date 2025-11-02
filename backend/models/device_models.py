# app/models/device_models.py
import uuid
from datetime import datetime

def create_device_dict(device_serial: str, device_name: str, device_type: str, user_id: str, location: str = "", status: str = "offline", note: str = "") -> dict:
    """
    Tạo dict device
    """
    return {
        "device_id": str(uuid.uuid4()),   # UUID cho device
        "device_serial": device_serial,
        "device_name": device_name,
        "device_type": device_type,
        "user_id": user_id,               # liên kết với user
        "location": location,
        "status": status,
        "note": note,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

def create_user_device_dict(user_id: str, device_id: str) -> dict:
    """Liên kết User <-> Device"""
    return {
        "user_id": user_id,
        "device_id": device_id
    }
