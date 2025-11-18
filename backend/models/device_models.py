# app/models/device_models.py
import uuid
from datetime import datetime

def create_device_dict(device_serial: str, device_name: str, device_type: str, location: str = "", status: str = "offline", note: str = "", device_password: str = None) -> dict:
    """
    Tạo dict device với mật khẩu nếu có
    """
    return {
        "device_id": str(uuid.uuid4()),   # UUID cho device
        "device_serial": device_serial,
        "device_name": device_name,
        "device_type": device_type,
        "location": location,
        "status": status,
        "note": note,
        "device_password": device_password,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }


# ==========================
# Add a Device for a User
# ==========================
def create_user_device_dict(user_id: str, device_id: str) -> dict:
    """Liên kết User <-> Device"""
    return {
        "user_id": user_id,
        "device_id": device_id,
        "created_at": datetime.utcnow().isoformat()
    }
