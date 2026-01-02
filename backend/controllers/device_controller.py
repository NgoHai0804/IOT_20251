from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.database import devices_collection, user_devices_collection, user_room_devices_collection, rooms_collection, sensors_collection, actuators_collection, sanitize_for_json
from utils.mqtt_client import mqtt_client
from datetime import datetime
from utils.timezone import get_vietnam_now_naive
import logging

logger = logging.getLogger(__name__)


def control_device_power(device_id: str, enabled: bool, user_id: str = None):
    """
    Bật/tắt thiết bị
    POST /devices/{device_id}/power
    {
      "enabled": false
    }
    """
    try:
        # Đảm bảo device_id là string
        device_id = str(device_id)
        # Kiểm tra device tồn tại
        device = devices_collection.find_one({"_id": device_id})
        if not device:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Không tìm thấy thiết bị",
                    "data": None
                }
            )
        
        # Kiểm tra quyền truy cập từ bảng user_room_devices (nếu có user_id)
        if user_id:
            link = user_room_devices_collection.find_one({"user_id": user_id, "device_id": device_id})
            if not link:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "status": False,
                        "message": "Truy cập bị từ chối: Thiết bị không thuộc về người dùng này",
                        "data": None
                    }
                )

        # Cập nhật enabled
        devices_collection.update_one(
            {"_id": device_id},
            {"$set": {"enabled": enabled, "updated_at": get_vietnam_now_naive()}}
        )

        # Gửi command qua MQTT
        command = {
            "device_enabled": enabled,
            "sensors": {},
            "actuators": {}
        }
        
        # Lấy danh sách sensors và actuators của device
        from utils.database import sensors_collection, actuators_collection
        sensors = list(sensors_collection.find({"device_id": device_id}))
        actuators = list(actuators_collection.find({"device_id": device_id}))
        
        # Thêm trạng thái sensors
        for sensor in sensors:
            command["sensors"][sensor["_id"]] = sensor.get("enabled", True) if enabled else False
        
        # Thêm trạng thái actuators
        for actuator in actuators:
            command["actuators"][actuator["_id"]] = actuator.get("enabled", True) if enabled else False
        
        mqtt_client.publish_command(device_id, command, qos=1)
        logger.info(f"Thiết bị {device_id} power được đặt thành: {enabled}")

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": f"Thiết bị đã được {'bật' if enabled else 'tắt'} thành công",
                "data": {"device_id": device_id, "enabled": enabled}
            }
        )

    except Exception as e:
        logger.error(f"Lỗi điều khiển power thiết bị: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )


def get_device(device_id: str, user_id: str = None):
    """Lấy thông tin thiết bị (theo user nếu có)"""
    try:
        # Đảm bảo device_id là string
        device_id = str(device_id)
        device = devices_collection.find_one({"_id": device_id})
        if not device:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Không tìm thấy thiết bị",
                    "data": None
                }
            )
        
        # Kiểm tra quyền truy cập từ bảng user_room_devices (nếu có user_id)
        if user_id:
            link = user_room_devices_collection.find_one({"user_id": user_id, "device_id": device_id})
            if not link:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "status": False,
                        "message": "Truy cập bị từ chối: Thiết bị không thuộc về người dùng này",
                        "data": None
                    }
                )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Lấy thông tin thiết bị thành công",
                "data": sanitize_for_json(device)
            }
        )

    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )


def get_device_detail(device_id: str, user_id: str = None):
    """Lấy thông tin chi tiết thiết bị kèm sensors và actuators"""
    try:
        # Đảm bảo device_id là string
        device_id = str(device_id)
        device = devices_collection.find_one({"_id": device_id})
        if not device:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Không tìm thấy thiết bị",
                    "data": None
                }
            )
        
        # Kiểm tra quyền truy cập từ bảng user_room_devices (nếu có user_id)
        if user_id:
            link = user_room_devices_collection.find_one({"user_id": user_id, "device_id": device_id})
            if not link:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "status": False,
                        "message": "Truy cập bị từ chối: Thiết bị không thuộc về người dùng này",
                        "data": None
                    }
                )
        
        # Lấy sensors và actuators của device
        sensors = list(sensors_collection.find({"device_id": device_id}))
        actuators = list(actuators_collection.find({"device_id": device_id}))
        
        # Thêm sensors và actuators vào device
        device["sensors"] = sensors
        device["actuators"] = actuators
        
        # Xóa device_password nếu có
        device.pop("device_password", None)
        device["_id"] = str(device["_id"])

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Lấy thông tin chi tiết thiết bị thành công",
                "data": sanitize_for_json(device)
            }
        )

    except Exception as e:
        logger.error(f"Lỗi khi lấy thông tin chi tiết thiết bị: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )


def get_all_devices(user_id: str = None):
    """
    Lấy tất cả thiết bị mà user đang quản lý thông qua bảng user_room_devices
    Trả về danh sách thiết bị kèm thông tin room (nếu có)
    """
    try:
        if not user_id:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "Cần có user_id",
                    "data": None
                }
            )

        # Lấy danh sách device_ids từ bảng user_room_devices (cấu trúc mới)
        linked_devices = list(user_room_devices_collection.find({"user_id": user_id}))
        device_ids = list(set([str(link["device_id"]) for link in linked_devices if "device_id" in link and link["device_id"]]))  # Loại bỏ duplicate và đảm bảo là string

        if not device_ids:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "Không tìm thấy thiết bị nào cho người dùng này",
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
                "message": "Lấy danh sách thiết bị thành công",
                "data": {"devices": sanitize_for_json(devices)}
            }
        )

    except Exception as e:
        logger.error(f"Lỗi khi lấy danh sách thiết bị: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )


def get_devices_by_room(room_id: str, user_id: str = None):
    """Lấy danh sách thiết bị theo phòng (theo user nếu có) - Sử dụng bảng user_room_devices"""
    try:
        # Kiểm tra room tồn tại
        room_query = {"_id": room_id}
        if user_id:
            room_query["user_id"] = user_id
        room = rooms_collection.find_one(room_query)
        
        if not room:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Không tìm thấy phòng",
                    "data": None
                }
            )
        
        # Lấy devices từ bảng user_room_devices
        if not user_id:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "Cần có user_id",
                    "data": None
                }
            )
        
        user_room_device_links = list(user_room_devices_collection.find({
            "user_id": user_id,
            "room_id": room_id
        }))
        
        if not user_room_device_links:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "Lấy danh sách thiết bị thành công",
                    "data": {"devices": []}
                }
            )
        
        # Lấy device_ids từ links
        device_ids = [link["device_id"] for link in user_room_device_links]
        
        # Lấy devices
        devices = list(devices_collection.find({"_id": {"$in": device_ids}}))
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Lấy danh sách thiết bị thành công",
                "data": {"devices": sanitize_for_json(devices)}
            }
        )

    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )


def delete_device(device_id: str, user_id: str = None):
    """
    Xóa liên kết thiết bị khỏi user (chỉ xóa trong bảng user_room_devices)
    Không xóa thiết bị, sensors, actuators, sensor_data
    DELETE /devices/{device_id}
    """
    try:
        # Đảm bảo device_id là string
        device_id = str(device_id)
        
        # Kiểm tra device tồn tại
        device = devices_collection.find_one({"_id": device_id})
        if not device:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Không tìm thấy thiết bị",
                    "data": None
                }
            )
        
        # Kiểm tra quyền truy cập từ bảng user_room_devices (phải có user_id)
        if not user_id:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "Cần có ID người dùng",
                    "data": None
                }
            )
        
        # Kiểm tra user có liên kết với device này không
        link = user_room_devices_collection.find_one({"user_id": user_id, "device_id": device_id})
        if not link:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Không tìm thấy thiết bị trong phòng của người dùng",
                    "data": None
                }
            )

        # Chỉ xóa liên kết trong user_room_devices (xóa tất cả links của user với device này)
        # KHÔNG xóa device, sensors, actuators, sensor_data
        user_room_devices_result = user_room_devices_collection.delete_many({
            "user_id": user_id,
            "device_id": device_id
        })
        
        deleted_count = user_room_devices_result.deleted_count
        
        if deleted_count == 0:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "status": False,
                    "message": "Không thể xóa liên kết thiết bị",
                    "data": None
                }
            )

        logger.info(f"Đã xóa {deleted_count} liên kết của user {user_id} với device {device_id} (device vẫn tồn tại)")

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Đã xóa liên kết thiết bị thành công (thiết bị vẫn tồn tại)",
                "data": {
                    "device_id": device_id,
                    "links_removed": deleted_count
                }
            }
        )

    except Exception as e:
        logger.error(f"Lỗi xóa liên kết thiết bị: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )
