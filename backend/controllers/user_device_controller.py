from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.database import devices_collection, user_devices_collection, sanitize_for_json
from models.device_models import create_user_device_dict
from datetime import datetime

# ==========================
# Add Device
# ==========================
def add_device(user_data: dict, device_serial: str, password: str = None):
    """
    Thêm thiết bị cho người dùng
    - device_serial: ID vật lý của thiết bị (serial number)
    - password: Mật khẩu của thiết bị (nếu có)
    
    Logic:
    - 1 người có thể quản lý nhiều thiết bị
    - 1 thiết bị có thể được quản lý bởi nhiều người
    """
    try:
        user_id = str(user_data["_id"])

        # Tìm thiết bị theo device_serial (ID vật lý)
        device = devices_collection.find_one({"device_serial": device_serial})
        if not device:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "Device not found",
                    "data": None
                }
            )

        # Lấy device_id (UUID) từ device đã tìm thấy
        device_id = device.get("device_id")
        if not device_id:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "Device ID not found",
                    "data": None
                }
            )

        # Kiểm tra mật khẩu
        if device.get("device_password") and device["device_password"] != password:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "Invalid device password",
                    "data": None
                }
            )

        # Kiểm tra liên kết đã tồn tại chưa
        existing_link = user_devices_collection.find_one({"user_id": user_id, "device_id": device_id})
        if existing_link:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "Device already linked to this user",
                    "data": {"device_id": device_id, "device_serial": device_serial}
                }
            )

        # Lưu liên kết User-Device (sử dụng device_id UUID)
        user_device = create_user_device_dict(user_id, device_id)
        result = user_devices_collection.insert_one(user_device)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Device linked successfully",
                "data": sanitize_for_json({
                    "device_link_id": str(result.inserted_id),
                    "device_id": device_id,
                    "device_serial": device_serial,
                    "linked_at": user_device["created_at"]
                })
            }
        )

    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )

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

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Device info retrieved successfully",
                "data": {"device": sanitize_for_json(device)}
            }
        )

    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


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
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "No devices found for this user",
                    "data": {"devices": []}
                }
            )

        # Lấy detailed info từ devices_collection
        devices = list(devices_collection.find({"device_id": {"$in": device_ids}}))

        for device in devices:
            device["_id"] = str(device["_id"])
            device.pop("device_password", None)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Devices retrieved successfully",
                "data": {"devices": sanitize_for_json(devices)}
            }
        )

    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


# ==========================
# update_device
# ==========================
def update_device(user_data: dict, id_device: str, update_data: dict):
    """
    Cập nhật thông tin thiết bị
    Cho phép cập nhật:
    - device_name: Tên thiết bị
    - device_password: Mật khẩu thiết bị
    - location: Vị trí/phòng của thiết bị
    - note: Ghi chú
    - status: Trạng thái thiết bị
    """
    try:
        user_id = str(user_data["_id"])

        # Kiểm tra quyền sở hữu - chỉ người đã liên kết với thiết bị mới có thể cập nhật
        link = user_devices_collection.find_one({"user_id": user_id, "device_id": id_device})
        if not link:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "Device not linked to this user",
                    "data": None
                }
            )

        # Kiểm tra thiết bị tồn tại
        device = devices_collection.find_one({"device_id": id_device})
        if not device:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "Device not found",
                    "data": None
                }
            )

        # Các trường được phép cập nhật
        allowed_fields = ["device_name", "device_password", "location", "note", "status"]
        update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
        
        # Nếu không có trường nào để cập nhật
        if not update_fields:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "No valid fields to update",
                    "data": None
                }
            )

        # Thêm thời gian cập nhật
        update_fields["updated_at"] = datetime.utcnow()

        # Cập nhật thiết bị
        result = devices_collection.update_one(
            {"device_id": id_device},
            {"$set": update_fields}
        )

        if result.modified_count == 0:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "No changes were made",
                    "data": None
                }
            )

        # Lấy thông tin thiết bị đã cập nhật (không bao gồm mật khẩu)
        updated_device = devices_collection.find_one({"device_id": id_device})
        if updated_device:
            updated_device["_id"] = str(updated_device["_id"])
            updated_device.pop("device_password", None)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Device updated successfully",
                "data": {
                    "device_id": id_device,
                    "updated_fields": list(update_fields.keys()),
                    "device": sanitize_for_json(updated_device) if updated_device else None
                }
            }
        )

    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )
