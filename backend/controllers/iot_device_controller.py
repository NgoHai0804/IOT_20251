from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.database import devices_collection, sensors_collection, sanitize_for_json
from models.device_models import create_device_dict
from models.sensor_models import create_sensor_dict
from datetime import datetime
from utils.timezone import get_vietnam_now_naive
import uuid


def register_device(device_id: str, device_name: str, device_type: str, 
                   device_password: str = None, location: str = None, note: str = None):
    try:
        device_id = str(device_id)
        existing_device = devices_collection.find_one({"_id": device_id})
        
        if existing_device:
            existing_device_id = existing_device.get("_id")
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "Thiết bị đã được đăng ký",
                    "data": {
                        "device_id": str(existing_device_id),
                        "device_name": existing_device.get("name"),
                        "device_type": existing_device.get("type"),
                        "status": existing_device.get("status", "offline")
                    }
                }
            )
        
        device = create_device_dict(
            name=device_name,
            device_type=device_type,
            status="offline",
            device_password=device_password,
            location=location,
            note=note
        )
        
        device["_id"] = str(device_id)
        
        result = devices_collection.insert_one(device)
        
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "status": True,
                "message": "Đăng ký thiết bị thành công",
                "data": {
                    "device_id": str(device_id),
                    "device_name": device_name,
                    "device_type": device_type,
                    "status": "offline"
                }
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


def add_sensor(device_id: str, sensor_id: str, name: str, sensor_type: str, note: str = None):
    try:
        device_id = str(device_id)
        sensor_id = str(sensor_id)
        device = devices_collection.find_one({"_id": device_id})
        if not device:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "Không tìm thấy thiết bị",
                    "data": None
                }
            )
        
        existing_sensor = sensors_collection.find_one({
            "_id": sensor_id,
            "device_id": device_id
        })
        
        if existing_sensor:
            update_fields = {
                "name": name,
                "sensor_type": sensor_type,
                "updated_at": get_vietnam_now_naive()
            }
            if note is not None:
                update_fields["note"] = note
            
            sensors_collection.update_one(
                {"_id": sensor_id, "device_id": device_id},
                {"$set": update_fields}
            )
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "Cập nhật sensor thành công",
                    "data": {
                        "sensor_id": str(sensor_id),
                        "name": name,
                        "sensor_type": sensor_type,
                        "device_id": str(device_id)
                    }
                }
            )
        
        sensor = {
            "_id": str(sensor_id),
            "device_id": str(device_id),
            "type": sensor_type,
            "name": name,
            "unit": "",
            "pin": 0,
            "enabled": True,
            "created_at": get_vietnam_now_naive(),
            "updated_at": get_vietnam_now_naive()
        }
        
        from models.sensor_models import get_default_thresholds
        default_min, default_max = get_default_thresholds(sensor_type)
        if default_min is not None:
            sensor["min_threshold"] = default_min
        if default_max is not None:
            sensor["max_threshold"] = default_max
        
        if note is not None:
            sensor["note"] = note
        
        sensors_collection.insert_one(sensor)
        
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "status": True,
                "message": "Thêm sensor thành công",
                "data": {
                    "sensor_id": sensor_id,
                    "name": name,
                    "sensor_type": sensor_type,
                    "device_id": device_id
                }
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


def get_device_status(device_id: str):
    try:
        device_id = str(device_id)
        device = devices_collection.find_one({"_id": device_id})
        if not device:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "Không tìm thấy thiết bị",
                    "data": None
                }
            )
        
        devices_collection.update_one(
            {"_id": device_id},
            {"$set": {"status": "online", "updated_at": get_vietnam_now_naive()}}
        )
        
        cloud_status = device.get("cloud_status", "off")
        commands = device.get("pending_commands", [])
        
        if commands:
            devices_collection.update_one(
                {"_id": device_id},
                {"$set": {"pending_commands": []}}
            )
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Lấy trạng thái thiết bị thành công",
                "data": {
                    "device_id": str(device_id),
                    "cloud_status": cloud_status,
                    "commands": commands,
                    "device_status": device.get("status", "offline")
                }
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
