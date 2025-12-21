from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.database import devices_collection, user_devices_collection, user_room_devices_collection, sanitize_for_json
from utils.mqtt_client import mqtt_client
from datetime import datetime
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
        # Kiểm tra device tồn tại
        device = devices_collection.find_one({"_id": device_id})
        if not device:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Device not found",
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
                        "message": "Access denied: Device does not belong to user",
                        "data": None
                    }
                )

        # Cập nhật enabled
        devices_collection.update_one(
            {"_id": device_id},
            {"$set": {"enabled": enabled, "updated_at": datetime.utcnow()}}
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
                "message": f"Device {'enabled' if enabled else 'disabled'} successfully",
                "data": {"device_id": device_id, "enabled": enabled}
            }
        )

    except Exception as e:
        logger.error(f"Lỗi điều khiển power thiết bị: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


def get_device(device_id: str, user_id: str = None):
    """Lấy thông tin thiết bị (theo user nếu có)"""
    try:
        device = devices_collection.find_one({"_id": device_id})
        if not device:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Device not found",
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
                        "message": "Access denied: Device does not belong to user",
                        "data": None
                    }
                )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Device retrieved successfully",
                "data": sanitize_for_json(device)
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


def get_devices_by_room(room_id: str, user_id: str = None):
    """Lấy danh sách thiết bị theo phòng (theo user nếu có) - Sử dụng bảng user_room_devices"""
    try:
        from utils.database import rooms_collection
        
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
                    "message": "Room not found",
                    "data": None
                }
            )
        
        # Lấy devices từ bảng user_room_devices
        if not user_id:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "user_id is required",
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
                    "message": "Devices retrieved successfully",
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
