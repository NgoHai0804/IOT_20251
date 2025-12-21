from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.database import actuators_collection, devices_collection, user_room_devices_collection, sanitize_for_json
from utils.mqtt_client import mqtt_client
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def control_actuator(actuator_id: str, state: bool, user_id: str = None):
    """
    Điều khiển actuator
    POST /actuators/{actuator_id}/control
    {
      "state": true
    }
    """
    try:
        # Kiểm tra actuator tồn tại
        actuator = actuators_collection.find_one({"_id": actuator_id})
        if not actuator:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Actuator not found",
                    "data": None
                }
            )

        device_id = actuator["device_id"]

        # Kiểm tra device có enabled không và thuộc về user (nếu có user_id) - từ bảng user_room_devices
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
        if not device.get("enabled", True):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "Device is disabled. Please enable device first.",
                    "data": None
                }
            )

        # Cập nhật state
        actuators_collection.update_one(
            {"_id": actuator_id},
            {"$set": {"state": state, "updated_at": datetime.utcnow()}}
        )

        # Gửi command qua MQTT
        from utils.database import sensors_collection, actuators_collection as actuators
        all_sensors = list(sensors_collection.find({"device_id": device_id}))
        all_actuators = list(actuators.find({"device_id": device_id}))
        
        command = {
            "device_enabled": device.get("enabled", True),
            "sensors": {s["_id"]: s.get("enabled", True) for s in all_sensors},
            "actuators": {a["_id"]: a.get("state", False) if a["_id"] == actuator_id else a.get("state", False) for a in all_actuators}
        }
        
        # Cập nhật state cho actuator được điều khiển
        command["actuators"][actuator_id] = state
        
        mqtt_client.publish_command(device_id, command, qos=1)
        logger.info(f"Actuator {actuator_id} state được đặt thành: {state}")

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": f"Actuator {'turned on' if state else 'turned off'} successfully",
                "data": {"actuator_id": actuator_id, "state": state}
            }
        )

    except Exception as e:
        logger.error(f"Lỗi điều khiển actuator: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


def get_actuators_by_device(device_id: str, user_id: str = None):
    """Lấy danh sách actuator theo thiết bị - chỉ tìm theo device_id"""
    try:
        # Chỉ query theo device_id, không cần kiểm tra quyền
        actuators = list(actuators_collection.find({"device_id": device_id}))
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Actuators retrieved successfully",
                "data": {"actuators": sanitize_for_json(actuators)}
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
