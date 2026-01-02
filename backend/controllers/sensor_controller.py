from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.database import sensors_collection, devices_collection, user_room_devices_collection, sanitize_for_json
from utils.mqtt_client import mqtt_client
from datetime import datetime
from utils.timezone import get_vietnam_now_naive
import logging

logger = logging.getLogger(__name__)


def control_sensor_enable(sensor_id: str, enabled: bool, user_id: str = None):
    """
    Bật/tắt cảm biến
    POST /sensors/{sensor_id}/enable
    {
      "enabled": false
    }
    """
    try:
        # Kiểm tra sensor tồn tại
        sensor = sensors_collection.find_one({"_id": sensor_id})
        if not sensor:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Không tìm thấy cảm biến",
                    "data": None
                }
            )

        device_id = str(sensor["device_id"])
        
        # Kiểm tra device thuộc về user (nếu có user_id) - từ bảng user_room_devices
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
            device = devices_collection.find_one({"_id": device_id})

        # Cập nhật enabled
        sensors_collection.update_one(
            {"_id": sensor_id},
            {"$set": {"enabled": enabled, "updated_at": get_vietnam_now_naive()}}
        )

        # Gửi command qua MQTT
        device = devices_collection.find_one({"_id": device_id})
        if device and device.get("enabled", True):
            # Chỉ gửi nếu device đang enabled
            from utils.database import sensors_collection as sensors, actuators_collection
            all_sensors = list(sensors.find({"device_id": device_id}))
            all_actuators = list(actuators_collection.find({"device_id": device_id}))
            
            command = {
                "device_enabled": device.get("enabled", True),
                "sensors": {s["_id"]: s.get("enabled", True) for s in all_sensors},
                "actuators": {a["_id"]: a.get("enabled", True) for a in all_actuators}
            }
            
            mqtt_client.publish_command(device_id, command, qos=1)
            logger.info(f"Sensor {sensor_id} enabled được đặt thành: {enabled}")

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": f"Cảm biến đã được {'bật' if enabled else 'tắt'} thành công",
                "data": {"sensor_id": sensor_id, "enabled": enabled}
            }
        )

    except Exception as e:
        logger.error(f"Lỗi điều khiển sensor enable: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )


def get_sensors_by_device(device_id: str, user_id: str = None):
    """Lấy danh sách cảm biến theo thiết bị - chỉ tìm theo device_id"""
    try:
        # Chỉ query theo device_id, không cần kiểm tra quyền
        sensors = list(sensors_collection.find({"device_id": device_id}))
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Lấy danh sách cảm biến thành công",
                "data": {"sensors": sanitize_for_json(sensors)}
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


def get_unit_from_type(sensor_type: str) -> str:
    """Lấy đơn vị tự động dựa trên loại sensor"""
    type_unit_map = {
        "temperature": "°C",
        "humidity": "%",
        "gas": "ppm",
    }
    return type_unit_map.get(sensor_type.lower(), "")


def update_sensor(sensor_id: str, name: str = None, sensor_type: str = None, pin: int = None, user_id: str = None):
    """
    Cập nhật thông tin cảm biến (name, type, pin)
    Unit sẽ tự động được set dựa trên type
    POST /sensors/{sensor_id}/update
    {
      "name": "Nhiệt độ phòng khách",
      "type": "temperature",
      "pin": 4
    }
    """
    try:
        # Kiểm tra sensor tồn tại
        sensor = sensors_collection.find_one({"_id": sensor_id})
        if not sensor:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Không tìm thấy cảm biến",
                    "data": None
                }
            )

        device_id = str(sensor["device_id"])
        
        # Kiểm tra device thuộc về user (nếu có user_id) - từ bảng user_room_devices
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

        # Validate sensor type nếu có
        valid_types = ["temperature", "humidity", "gas"]
        if sensor_type is not None and sensor_type.lower() not in valid_types:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": f"Loại cảm biến không hợp lệ. Phải là một trong: {', '.join(valid_types)}",
                    "data": None
                }
            )

        # Cập nhật thông tin
        update_data = {"updated_at": get_vietnam_now_naive()}
        
        if name is not None:
            update_data["name"] = name
        if sensor_type is not None:
            update_data["type"] = sensor_type.lower()
            # Tự động set unit dựa trên type
            unit = get_unit_from_type(sensor_type)
            if unit:
                update_data["unit"] = unit
        if pin is not None:
            update_data["pin"] = pin

        sensors_collection.update_one(
            {"_id": sensor_id},
            {"$set": update_data}
        )

        # Lấy sensor đã cập nhật để trả về
        updated_sensor = sensors_collection.find_one({"_id": sensor_id})
        if updated_sensor:
            updated_sensor["_id"] = str(updated_sensor["_id"])
            # Sanitize để convert datetime objects thành string
            updated_sensor = sanitize_for_json(updated_sensor)

        logger.info(f"Đã cập nhật sensor {sensor_id}: name={name}, type={sensor_type}, pin={pin}")

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Cập nhật cảm biến thành công",
                "data": updated_sensor
            }
        )

    except Exception as e:
        logger.error(f"Lỗi cập nhật sensor: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )


def update_sensor_threshold(sensor_id: str, min_threshold: float = None, max_threshold: float = None, user_id: str = None):
    """
    Cập nhật ngưỡng nguy hiểm của cảm biến (ngưỡng trên và dưới)
    POST /sensors/{sensor_id}/threshold
    {
      "min_threshold": 10.0,  // null để xóa ngưỡng dưới
      "max_threshold": 50.0   // null để xóa ngưỡng trên
    }
    """
    try:
        # Kiểm tra sensor tồn tại
        sensor = sensors_collection.find_one({"_id": sensor_id})
        if not sensor:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Không tìm thấy cảm biến",
                    "data": None
                }
            )

        device_id = str(sensor["device_id"])
        
        # Kiểm tra device thuộc về user (nếu có user_id) - từ bảng user_room_devices
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

        # Kiểm tra min_threshold <= max_threshold nếu cả 2 đều có
        if min_threshold is not None and max_threshold is not None and min_threshold > max_threshold:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "min_threshold must be less than or equal to max_threshold",
                    "data": None
                }
            )

        # Cập nhật thresholds
        update_data = {"updated_at": get_vietnam_now_naive()}
        unset_data = {}
        
        if min_threshold is None:
            unset_data["min_threshold"] = ""
        else:
            update_data["min_threshold"] = min_threshold
            
        if max_threshold is None:
            unset_data["max_threshold"] = ""
        else:
            update_data["max_threshold"] = max_threshold

        update_query = {"$set": update_data}
        if unset_data:
            update_query["$unset"] = unset_data
            
        sensors_collection.update_one(
            {"_id": sensor_id},
            update_query
        )

        logger.info(f"Đã cập nhật ngưỡng sensor {sensor_id}: min={min_threshold}, max={max_threshold}")

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Cập nhật ngưỡng cảm biến thành công",
                "data": {"sensor_id": sensor_id, "min_threshold": min_threshold, "max_threshold": max_threshold}
            }
        )

    except Exception as e:
        logger.error(f"Lỗi cập nhật ngưỡng sensor: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )
