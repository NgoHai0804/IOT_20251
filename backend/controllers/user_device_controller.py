from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.database import devices_collection, user_devices_collection, user_room_devices_collection, rooms_collection, sanitize_for_json
from models.device_models import create_user_device_dict
from models.user_room_device_models import create_user_room_device_dict
from utils.mqtt_client import mqtt_client
from datetime import datetime
from utils.timezone import get_vietnam_now_naive
import logging

logger = logging.getLogger(__name__)

# ==========================
# Add Device
# ==========================
def add_device(user_data: dict, device_id: str, device_password: str = None, device_name: str = None, location: str = None, note: str = None):
    """
    Thêm thiết bị cho người dùng
    - device_id: ID của thiết bị (bắt buộc)
    - device_password: Mật khẩu thiết bị (tùy chọn - để trống nếu thiết bị không có mật khẩu)
    - device_name: Tên thiết bị (để hiển thị cho user)
    - location: Phòng/vị trí thiết bị (tên phòng)
    - note: Ghi chú (tùy chọn)
    
    LƯU Ý QUAN TRỌNG: Chỉ tạo liên kết trong bảng user_room_devices, KHÔNG tạo thiết bị mới trong bảng devices
    
    Logic:
    - Tìm device bằng device_id trong hệ thống
    - Nếu không tìm thấy → trả về lỗi (KHÔNG tạo thiết bị mới)
    - Kiểm tra device_password:
      * Nếu device có password: user phải nhập đúng password
      * Nếu device không có password: user phải để trống password
    - Nếu device tồn tại và password đúng → tạo liên kết mới trong user_room_devices
    - Nếu device không tồn tại hoặc password sai → trả về lỗi
    """
    try:
        user_id = str(user_data["_id"])
        # Đảm bảo device_id là string
        device_id = str(device_id)

        # Tìm device bằng device_id trong hệ thống
        device = devices_collection.find_one({"_id": device_id})
        
        # Kiểm tra device có tồn tại không
        if not device:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Thiết bị không tồn tại trong hệ thống. Vui lòng kiểm tra lại device ID.",
                    "data": None
                }
            )
        
        # Kiểm tra mật khẩu
        stored_password = device.get("device_password")
        # Chuẩn hóa device_password: None hoặc rỗng đều coi như không có mật khẩu
        provided_password = device_password.strip() if device_password and device_password.strip() else None
        
        # Nếu device có mật khẩu
        if stored_password:
            # User phải cung cấp mật khẩu và phải đúng
            if not provided_password:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "status": False,
                        "message": "Thiết bị yêu cầu mật khẩu. Vui lòng nhập mật khẩu.",
                        "data": None
                    }
                )
            # Kiểm tra mật khẩu có đúng không
            if stored_password != provided_password:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={
                        "status": False,
                        "message": "Mật khẩu thiết bị không đúng. Vui lòng kiểm tra lại.",
                        "data": None
                    }
                )
        else:
            # Device không có mật khẩu - user không được nhập mật khẩu (hoặc để trống)
            if provided_password:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "status": False,
                        "message": "Thiết bị không có mật khẩu. Vui lòng để trống mật khẩu.",
                        "data": None
                    }
                )
            # Cả device và user đều không có mật khẩu → cho phép liên kết
        
        # Lấy device_id từ _id (vì đã tìm bằng device_id)
        device_id = str(device["_id"])
        
        # Xử lý room_id từ location (nếu có)
        room_id = None
        if location and location.strip():
            # Tìm room theo tên và user_id
            room = rooms_collection.find_one({"name": location.strip(), "user_id": user_id})
            if room:
                room_id = room["_id"]
                logger.info(f"Đã tìm thấy phòng: {location} (room_id: {room_id})")
            else:
                logger.info(f"Không tìm thấy phòng '{location}' cho user {user_id}, thiết bị sẽ được thêm mà không có phòng")
        
        # LƯU Ý: Chỉ tạo liên kết trong bảng user_room_devices, KHÔNG cập nhật bảng devices
        # Kiểm tra xem device đã được liên kết với user này chưa
        existing_link = user_room_devices_collection.find_one({"user_id": user_id, "device_id": device_id})
        
        if existing_link:
            # Device đã được liên kết, cập nhật room_id nếu có thay đổi
            if existing_link.get("room_id") != room_id:
                user_room_devices_collection.update_one(
                    {"user_id": user_id, "device_id": device_id},
                    {"$set": {"room_id": room_id, "updated_at": get_vietnam_now_naive()}}
                )
                logger.info(f"Đã cập nhật liên kết user-room-device: user={user_id}, device={device_id}, room_id={room_id}")
            else:
                logger.info(f"Device {device_id} đã được liên kết với user {user_id}")
        else:
            # Tạo liên kết mới với room_id (có thể là None nếu không có location)
            # LƯU Ý: Chỉ tạo liên kết, KHÔNG tạo thiết bị mới trong bảng devices
            user_room_device = create_user_room_device_dict(user_id, device_id, room_id=room_id)
            user_room_devices_collection.insert_one(user_room_device)
            logger.info(f"Đã tạo liên kết user-room-device: user={user_id}, device={device_id}, room_id={room_id}")
        
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
        logger.error(f"Lỗi khi thêm thiết bị: {str(e)}")
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
        # Đảm bảo id_device là string
        id_device = str(id_device)

        # Tìm liên kết
        link = user_devices_collection.find_one({"user_id": user_id, "device_id": id_device})
        if not link:
            return {
                "status": False,
                "message": "Device not linked to this user",
                "data": None
            }

        # Lấy thông tin device (tìm bằng _id)
        device = devices_collection.find_one({"_id": id_device})
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
        linked_devices = list(user_room_devices_collection.find({"user_id": user_id}))
        device_ids = list(set([str(link["device_id"]) for link in linked_devices if "device_id" in link and link["device_id"]]))  # Loại bỏ duplicate và đảm bảo là string

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

        # Tạo mapping từ device_id -> room_id từ linked_devices
        # Ưu tiên link có room_id (không phải None) nếu có nhiều links cho cùng một device
        device_room_map = {}
        for link in linked_devices:
            device_id = link.get("device_id")
            room_id = link.get("room_id")
            if device_id:
                # Nếu device chưa có trong map, thêm vào
                if device_id not in device_room_map:
                    device_room_map[device_id] = room_id
                # Nếu đã có nhưng room_id hiện tại là None và link mới có room_id, cập nhật
                elif device_room_map[device_id] is None and room_id is not None:
                    device_room_map[device_id] = room_id

        # Lấy thông tin room cho các room_id không phải None
        room_ids = list(set([room_id for room_id in device_room_map.values() if room_id is not None]))
        rooms_map = {}
        if room_ids:
            rooms = list(rooms_collection.find({"_id": {"$in": room_ids}}))
            for room in rooms:
                rooms_map[str(room["_id"])] = {
                    "room_id": str(room["_id"]),
                    "room_name": room.get("name", "")
                }

        # Thêm thông tin room vào mỗi device
        for device in devices:
            device["_id"] = str(device["_id"])
            device.pop("device_password", None)
            
            # Thêm thông tin room từ mapping
            device_id = device["_id"]
            room_id = device_room_map.get(device_id)
            
            if room_id is not None:
                room_info = rooms_map.get(str(room_id))
                if room_info:
                    device["room_id"] = room_info["room_id"]
                    device["room"] = room_info["room_name"]
                else:
                    device["room_id"] = None
                    device["room"] = None
            else:
                device["room_id"] = None
                device["room"] = None

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Devices retrieved successfully",
                "data": {"devices": sanitize_for_json(devices)}
            }
        )

    except Exception as e:
        logger.error(f"Error in get_all_device: {str(e)}")
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

        # Đảm bảo id_device là string
        id_device = str(id_device)
        
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

        # Kiểm tra thiết bị tồn tại (tìm bằng _id)
        device = devices_collection.find_one({"_id": id_device})
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
        
        # Map device_name to name field (frontend sends device_name but database uses name)
        if "device_name" in update_fields:
            update_fields["name"] = update_fields.pop("device_name")
        
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
                    {"$set": {"room_id": room_id_to_set, "updated_at": get_vietnam_now_naive()}}
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
        update_fields["updated_at"] = get_vietnam_now_naive()

        # Cập nhật thiết bị (tìm bằng _id)
        result = devices_collection.update_one(
            {"_id": id_device},
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
        # Sử dụng cùng query như khi update để đảm bảo tìm đúng device
        updated_device = devices_collection.find_one({"_id": id_device})
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
                    "updated_fields": [field if field != "name" else "device_name" for field in update_fields.keys()],
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
