# app/models/user_models.py
import uuid
from datetime import datetime

def create_user_dict(full_name: str, email: str, password_hash: str, phone: str = "") -> dict:
    """
    Tạo dict user để lưu vào MongoDB
    """
    return {
        "user_id": str(uuid.uuid4()),   # UUID thay cho Django UUIDField
        "full_name": full_name,
        "email": email,
        "password_hash": password_hash,
        "phone": phone,
        "created_at": datetime.utcnow(),
        "is_active": True
    }
