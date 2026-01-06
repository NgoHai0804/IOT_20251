import uuid
from datetime import datetime
from utils.timezone import get_vietnam_now_naive


def create_user_dict(full_name: str, email: str, password_hash: str, phone: str = "") -> dict:
    return {
        "user_id": str(uuid.uuid4()),
        "full_name": full_name,
        "email": email,
        "password_hash": password_hash,
        "phone": phone,
        "created_at": get_vietnam_now_naive().isoformat(),
        "is_active": True
    }
