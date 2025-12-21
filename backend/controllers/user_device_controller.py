from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.database import devices_collection, user_devices_collection, user_room_devices_collection, rooms_collection, sanitize_for_json
from models.device_models import create_user_device_dict
from models.user_room_device_models import create_user_room_device_dict
from utils.mqtt_client import mqtt_client
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# ==========================
# Add Device
# ==========================
def add_device(user_data: dict, device_id: str, device_name: str, location: str, note: str = None):
    """
    Thêm thiết bị cho người dùng
    - device_id: ID thiết bị (có thể là _id hoặc device_id cũ)
    - device_name: Tên thiết bị
    - location: Phòng/vị trí thiết bị (tên phòng)
    - note: Ghi chú (tùy chọn)
    
    Logic mới:
    - Tìm device bằng _id hoặc device_id (backward compatible)
    - Nếu chưa tồn tại → tạo device mới với user_id
    - Tìm hoặc tạo room từ location
    - Link device với user
    """
    try:
        user_id = str(user_data["_id"])

        # Tìm device bằng _id hoặc device_id (backward compatible)
        device = devices_collection.find_one({"_id": device_id}) or \
                 devices_collection.find_one({"device_id": device_id})
        
        # Xử lý room_id từ location (nếu có)
        room_id = None
        if location and location.strip():
            # Tìm room theo tên và user_id
            from utils.database import rooms_collection
            room = rooms_collection.find_one({"name": location.strip(), "user_id": user_id})
            if room:
                room_id = room["_id"]
                logger.info(f"Đã tìm thấy phòng: {location} (room_id: {room_id})")
            else:
                logger.info(f"Không tìm thấy phòng '{location}' cho user {user_id}, thiết bị sẽ được thêm mà không có phòng")
        
        if not device:
            # Thiết bị chưa tồn tại → tạo mới (KHÔNG có room_id và user_id)
            from models.device_models import create_device_dict
            device = create_device_dict(
                name=device_name,
                room_id=None,  # Không thuộc phòng nào
                device_type="esp32",
                ip="",
                status="offline",
                enabled=True
            )
            # Sử dụng device_id từ request làm _id nếu hợp lệ, hoặc dùng generated ID
            if device_id and not device_id.startswith("device_"):
                # Nếu device_id không phải format chuẩn, dùng generated ID
                device_id = device["_id"]
            else:
                device["_id"] = device_id
            
            devices_collection.insert_one(device)
            logger.info(f" Created new device: {device_id} for user {user_id}")
        else:
            # Thiết bị đã tồn tại, cập nhật thông tin (KHÔNG cập nhật room_id và user_id)
            update_fields = {
                "name": device_name,
                "updated_at": datetime.utcnow()
            }
            # KHÔNG cập nhật room_id và user_id - sử dụng bảng user_room_devices
                
            if note is not None:
                update_fields["note"] = note
            
            # Cập nhật bằng _id
            devices_collection.update_one(
                {"_id": device.get("_id", device_id)},
                {"$set": update_fields}
            )
            device_id = device.get("_id", device_id)

        # Tạo hoặc cập nhật liên kết trong bảng user_room_devices
        existing_link = user_room_devices_collection.find_one({"user_id": user_id, "device_id": device_id})
        if existing_link:
            # Cập nhật room_id nếu có thay đổi
            if existing_link.get("room_id") != room_id:
                user_room_devices_collection.update_one(
                    {"user_id": user_id, "device_id": device_id},
                    {"$set": {"room_id": room_id, "updated_at": datetime.utcnow()}}
                )
                logger.info(f"Đã cập nhật liên kết user-room-device: user={user_id}, device={device_id}, room_id={room_id}")
        else:
            # Tạo liên kết mới với room_id (có thể là None nếu không có location)
            user_room_device = create_user_room_device_dict(user_id, device_id, room_id=room_id)
            user_room_devices_collection.insert_one(user_room_device)
            logger.info(f"Đã tạo liên kết user-room-device: user={user_id}, device={device_id}, room_id={room_id}")
            
            # Không cần cập nhật room.device_ids nữa - chỉ sử dụng bảng user_room_devices
        
        # Giữ lại legacy user_devices_collection để tương thích
        existing_legacy_link = user_devices_collection.find_one({"user_id": user_id, "device_id": device_id})
        if not existing_legacy_link:
            user_device = create_user_device_dict(user_id, device_id)
            user_devices_collection.insert_one(user_device)

        response_data = {
            "device_id": device_id,
            "device_name": device_name,
            "note": note
        }
        
        # Trả về room_id nếu có
        if room_id:
            response_data["room_id"] = room_id
            response_data["room_name"] = location.strip() if location else None
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Thêm thiết bị thành công",
                "data": sanitize_for_json(response_data)
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

        # Lấy danh sách device_ids từ bảng user_room_devices (cấu trúc mới)
        linked_devices = user_room_devices_collection.find({"user_id": user_id})
        device_ids = list(set([link["device_id"] for link in linked_devices]))  # Loại bỏ duplicate

        if not device_ids:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "No devices found for this user",
                    "data": {"devices": []}
                }
            )

        # Lấy detailed info từ devices_collection (sử dụng _id thay vì device_id)
        devices = list(devices_collection.find({"_id": {"$in": device_ids}}))

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

        # Kiểm tra thiết bị tồn tại (tìm bằng _id hoặc device_id để backward compatible)
        device = devices_collection.find_one({"_id": id_device}) or \
                 devices_collection.find_one({"device_id": id_device})
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
        allowed_fields = ["device_name", "device_password", "location", "note", "status", "cloud_status"]
        update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
        
        # Xử lý location để cập nhật room_id trong bảng user_room_devices
        # Chỉ xử lý nếu location được truyền vào trong update_data
        room_id_to_set = None
        location_updated = False
        
        if "location" in update_data:
            location_value = update_data.get("location")
            
            if location_value and location_value.strip():
                # Nếu có location, tìm room theo _id hoặc name
                room = rooms_collection.find_one({
                    "$or": [
                        {"_id": location_value.strip(), "user_id": user_id},
                        {"name": location_value.strip(), "user_id": user_id}
                    ]
                })
                if room:
                    room_id_to_set = room["_id"]
                    logger.info(f" Found room: {location_value} (room_id: {room_id_to_set})")
                else:
                    logger.info(f"Không tìm thấy phòng '{location_value}' cho user {user_id}, sẽ đặt room_id thành null")
                    room_id_to_set = None
            else:
                # Nếu location là null hoặc rỗng, set room_id về null
                room_id_to_set = None
                logger.info(f"Location trống hoặc null, sẽ đặt room_id thành null cho thiết bị {id_device}")
            
            # Cập nhật room_id trong bảng user_room_devices
            existing_user_room_device = user_room_devices_collection.find_one({
                "user_id": user_id,
                "device_id": id_device
            })
            
            if existing_user_room_device:
                # Cập nhật room_id
                user_room_devices_collection.update_one(
                    {"user_id": user_id, "device_id": id_device},
                    {"$set": {"room_id": room_id_to_set, "updated_at": datetime.utcnow()}}
                )
                logger.info(f"Đã cập nhật liên kết user-room-device: user={user_id}, device={id_device}, room_id={room_id_to_set}")
            else:
                # Tạo liên kết mới nếu chưa tồn tại
                user_room_device = create_user_room_device_dict(user_id, id_device, room_id=room_id_to_set)
                user_room_devices_collection.insert_one(user_room_device)
                logger.info(f" Created user-room-device link: user={user_id}, device={id_device}, room_id={room_id_to_set}")
            
            location_updated = True
        
        # Loại bỏ location khỏi update_fields vì đã xử lý riêng
        if "location" in update_fields:
            update_fields.pop("location")
        
        # Nếu không có trường nào để cập nhật (sau khi loại bỏ location)
        if not update_fields:
            # Vẫn trả về thành công nếu chỉ cập nhật room_id
            if location_updated:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": True,
                        "message": "Device room updated successfully",
                        "data": {
                            "device_id": id_device,
                            "room_id": room_id_to_set
                        }
                    }
                )
            else:
                # Nếu không có trường nào để cập nhật và không cập nhật location
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": False,
                        "message": "No valid fields to update",
                        "data": None
                    }
                )

        # Kiểm tra nếu cloud_status thay đổi, gửi command qua MQTT
        old_cloud_status = device.get("cloud_status", "off")
        new_cloud_status = update_fields.get("cloud_status")
        
        # Thêm thời gian cập nhật
        update_fields["updated_at"] = datetime.utcnow()

        # Cập nhật thiết bị (tìm bằng _id hoặc device_id)
        # Sử dụng _id nếu device được tìm thấy bằng _id, ngược lại dùng device_id
        device_query = {"_id": id_device} if device.get("_id") == id_device else {"device_id": id_device}
        result = devices_collection.update_one(
            device_query,
            {"$set": update_fields}
        )

        # Nếu cloud_status thay đổi, gửi command qua MQTT đến thiết bị
        if new_cloud_status is not None and new_cloud_status != old_cloud_status:
            try:
                command = {
                    "action": "set_cloud_status",
                    "cloud_status": new_cloud_status
                }
                mqtt_success = mqtt_client.publish_command(id_device, command, qos=1)
                if mqtt_success:
                    logger.info(f"Đã gửi command đến thiết bị {id_device} qua MQTT: {command}")
                else:
                    logger.warning(f"Gửi command đến thiết bị {id_device} qua MQTT thất bại")
            except Exception as e:
                logger.error(f"Lỗi gửi command qua MQTT: {str(e)}")
                # Không throw exception, vì database đã cập nhật thành công

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
