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

# ==========================
# get_info_device
# ==========================
def get_info_device(user_data: dict, id_device: str):
    try:
        user_id = str(user_data["_id"])

        # Tìm liên kết
        link = user_devices_collection.find_one({"user_id": user_id, "device_id": id_device})
        if not link:
            return {
                "status": False,
                "message": "Device not linked to this user",
                "data": None
            }

        # Lấy thông tin device
        device = devices_collection.find_one({"device_id": id_device})
        if not device:
            return {
                "status": False,
                "message": "Device not found",
                "data": None
            }

        device["_id"] = str(device["_id"])
        device.pop("device_password", None)  # Ẩn mật khẩu nếu có

        return {
            "status": True,
            "message": "Device info retrieved successfully",
            "data": {"device": device}
        }

    except Exception as e:
        return {
            "status": False,
            "message": f"Unexpected error: {str(e)}",
            "data": None
        }


# ==========================
# get_all_device
# ==========================
def get_all_device(user_data: dict):
    try:
        user_id = str(user_data["_id"])

        # Lấy danh sách device_ids liên kết với user
        linked_devices = user_devices_collection.find({"user_id": user_id})
        device_ids = [link["device_id"] for link in linked_devices]

        if not device_ids:
            return {
                "status": True,
                "message": "No devices found for this user",
                "data": []
            }

        # Lấy detailed info từ devices_collection
        devices = list(devices_collection.find({"device_id": {"$in": device_ids}}))

        for device in devices:
            device["_id"] = str(device["_id"])
            device.pop("device_password", None)

        return {
            "status": True,
            "message": "Devices retrieved successfully",
            "data": {"devices": devices}
        }

    except Exception as e:
        return {
            "status": False,
            "message": f"Unexpected error: {str(e)}",
            "data": None
        }


# ==========================
# update_device
# ==========================
def update_device(user_data: dict, id_device: str, update_data: dict):
    try:
        user_id = str(user_data["_id"])

        # Kiểm tra quyền sở hữu
        link = user_devices_collection.find_one({"user_id": user_id, "device_id": id_device})
        if not link:
            return {
                "status": False,
                "message": "Device not linked to this user",
                "data": None
            }

        # Cập nhật thiết bị
        update_fields = {k: v for k, v in update_data.items() if k in ["device_name", "location", "note", "status"]}
        update_fields["updated_at"] = datetime.utcnow()

        result = devices_collection.update_one(
            {"device_id": id_device},
            {"$set": update_fields}
        )

        if result.modified_count == 0:
            return {
                "status": False,
                "message": "No changes were made",
                "data": None
            }

        return {
            "status": True,
            "message": "Device updated successfully",
            "data": {"device_id": id_device}
        }

    except Exception as e:
        return {
            "status": False,
            "message": f"Unexpected error: {str(e)}",
            "data": None
        }
