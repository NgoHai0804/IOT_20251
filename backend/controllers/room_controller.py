from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.database import devices_collection, user_devices_collection, sanitize_for_json
from datetime import datetime


# ==========================
# Update Room Name
# ==========================
def update_room_name(user_data: dict, old_room_name: str, new_room_name: str):
    """
    Cập nhật tên phòng
    - old_room_name: Tên phòng cũ
    - new_room_name: Tên phòng mới
    Tất cả devices trong phòng cũ sẽ được chuyển sang phòng mới
    """
    try:
        user_id = str(user_data["_id"])

        # Lấy danh sách device_ids của user
        linked_devices = user_devices_collection.find({"user_id": user_id})
        device_ids = [link["device_id"] for link in linked_devices]

        if not device_ids:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "No devices found for this user",
                    "data": None
                }
            )

        # Tìm tất cả devices của user có location = old_room_name
        devices_to_update = list(devices_collection.find({
            "device_id": {"$in": device_ids},
            "location": old_room_name
        }))

        if not devices_to_update:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": f"Room '{old_room_name}' not found or has no devices",
                    "data": None
                }
            )

        # Cập nhật location cho tất cả devices trong phòng
        result = devices_collection.update_many(
            {
                "device_id": {"$in": device_ids},
                "location": old_room_name
            },
            {
                "$set": {
                    "location": new_room_name,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": f"Room name updated successfully",
                "data": {
                    "old_room_name": old_room_name,
                    "new_room_name": new_room_name,
                    "devices_updated": result.modified_count
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


# ==========================
# Delete Room
# ==========================
def delete_room(user_data: dict, room_name: str):
    """
    Xóa phòng
    - room_name: Tên phòng cần xóa
    Tất cả devices trong phòng sẽ được chuyển sang phòng "Không xác định"
    """
    try:
        user_id = str(user_data["_id"])

        # Lấy danh sách device_ids của user
        linked_devices = user_devices_collection.find({"user_id": user_id})
        device_ids = [link["device_id"] for link in linked_devices]

        if not device_ids:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "No devices found for this user",
                    "data": None
                }
            )

        # Tìm tất cả devices của user có location = room_name
        devices_to_update = list(devices_collection.find({
            "device_id": {"$in": device_ids},
            "location": room_name
        }))

        if not devices_to_update:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": f"Room '{room_name}' not found or has no devices",
                    "data": None
                }
            )

        # Chuyển tất cả devices sang phòng "Không xác định"
        result = devices_collection.update_many(
            {
                "device_id": {"$in": device_ids},
                "location": room_name
            },
            {
                "$set": {
                    "location": "Không xác định",
                    "updated_at": datetime.utcnow()
                }
            }
        )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": f"Room deleted successfully. Devices moved to 'Không xác định'",
                "data": {
                    "deleted_room": room_name,
                    "devices_moved": result.modified_count,
                    "new_location": "Không xác định"
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

