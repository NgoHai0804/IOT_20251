from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from utils.database import devices_collection, user_devices_collection
from models.user_models import create_user_dict
from utils.auth import create_access_token
import bcrypt


# ==========================
# Add Device
# ==========================
def add_device(user_data: dict, id_device: str, password: str = None):
    try:
        user_id = str(user_data["_id"])

        # Kiểm tra thiết bị tồn tại
        device = devices_collection.find_one({"device_id": id_device})
        if not device:
            return {
                "status": False,
                "message": "Device not found",
                "data": None
            }

        # Kiểm tra mật khẩu
        if device.get("device_password") and device["device_password"] != password:
            return {
                "status": False,
                "message": "Invalid device password",
                "data": None
            }

        # Kiểm tra liên kết
        existing_link = user_devices_collection.find_one({"user_id": user_id, "device_id": id_device})
        if existing_link:
            return {
                "status": False,
                "message": "Device already linked to this user",
                "data": {"device_id": id_device}
            }

        # Lưu liên kết
        user_device = create_user_device_dict(user_id, id_device)
        result = user_devices_collection.insert_one(user_device)

        return {
            "status": True,
            "message": "Device linked successfully",
            "data": {
                "device_link_id": str(result.inserted_id),
                "device_id": id_device,
                "linked_at": user_device["created_at"]
            }
        }

    except Exception as e:
        return {
            "status": False,
            "message": f"Unexpected error: {str(e)}",
            "data": None
        }
