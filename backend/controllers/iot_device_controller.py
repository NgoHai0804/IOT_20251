from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.database import devices_collection, sensors_collection, sanitize_for_json
from models.device_models import create_device_dict
from models.sensor_models import create_sensor_dict
from datetime import datetime
import uuid


# ==========================
# Register Device (cho IoT device)
# ==========================
def register_device(device_id: str, device_name: str, device_type: str, 
                   device_password: str = None, location: str = None, note: str = None):
    """
    Đăng ký thiết bị IoT với server
    - device_id: ID của thiết bị (device tự tạo và gửi lên, dùng làm identifier duy nhất)
    - Kiểm tra device_id đã tồn tại chưa
    - Nếu chưa tồn tại → tạo mới device với device_id từ device
    - Nếu đã tồn tại → trả về thông tin device hiện có
    """
    try:
        # Đảm bảo device_id là string
        device_id = str(device_id)
        # Kiểm tra device_id đã tồn tại chưa
        existing_device = devices_collection.find_one({"_id": device_id})
        
        if existing_device:
            # Device đã tồn tại, trả về thông tin
            existing_device_id = existing_device.get("_id")
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "Device already registered",
                    "data": {
                        "device_id": str(existing_device_id),
                        "device_name": existing_device.get("name"),
                        "device_type": existing_device.get("type"),
                        "status": existing_device.get("status", "offline")
                    }
                }
            )
        
        # Tạo device mới với device_id từ device gửi lên
        device = create_device_dict(
            name=device_name,
            device_type=device_type,
            status="offline",  # Mặc định là offline khi đăng ký
            device_password=device_password,
            location=location,
            note=note
        )
        
        # Sử dụng device_id từ device gửi lên thay vì tự tạo
        # Đảm bảo _id là string
        device["_id"] = str(device_id)
        
        result = devices_collection.insert_one(device)
        
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "status": True,
                "message": "Device registered successfully",
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
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


# ==========================
# Add Sensor (cho IoT device)
# ==========================
def add_sensor(device_id: str, sensor_id: str, name: str, sensor_type: str, note: str = None):
    """
    Thêm sensor cho thiết bị IoT
    - Kiểm tra device có tồn tại không
    - Kiểm tra sensor_id đã tồn tại cho device này chưa
    - Nếu chưa tồn tại → tạo mới sensor
    - Nếu đã tồn tại → cập nhật thông tin sensor
    """
    try:
        # Đảm bảo device_id là string
        device_id = str(device_id)
        sensor_id = str(sensor_id)
        # Kiểm tra device có tồn tại không (tìm bằng _id vì device_id chính là _id)
        device = devices_collection.find_one({"_id": device_id})
        if not device:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "Device not found",
                    "data": None
                }
            )
        
        # Kiểm tra sensor đã tồn tại chưa (tìm bằng _id)
        existing_sensor = sensors_collection.find_one({
            "_id": sensor_id,
            "device_id": device_id
        })
        
        if existing_sensor:
            # Sensor đã tồn tại, cập nhật thông tin
            update_fields = {
                "name": name,
                "sensor_type": sensor_type,
                "updated_at": datetime.utcnow()
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
                    "message": "Sensor updated successfully",
                    "data": {
                        "sensor_id": str(sensor_id),
                        "name": name,
                        "sensor_type": sensor_type,
                        "device_id": str(device_id)
                    }
                }
            )
        
        # Tạo sensor mới
        # Tạo dict sensor trực tiếp để sử dụng sensor_id từ thiết bị làm _id
        sensor = {
            "_id": str(sensor_id),  # Sử dụng sensor_id từ thiết bị làm _id
            "device_id": str(device_id),
            "type": sensor_type,
            "name": name,
            "unit": "",
            "pin": 0,
            "enabled": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Tự động set ngưỡng mặc định
        from models.sensor_models import get_default_thresholds
        default_min, default_max = get_default_thresholds(sensor_type)
        if default_min is not None:
            sensor["min_threshold"] = default_min
        if default_max is not None:
            sensor["max_threshold"] = default_max
        
        # Thêm note nếu có
        if note is not None:
            sensor["note"] = note
        
        result = sensors_collection.insert_one(sensor)
        
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "status": True,
                "message": "Sensor added successfully",
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
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


# ==========================
# Get Device Status/Commands (cho IoT device)
# ==========================
def get_device_status(device_id: str):
    """
    Lấy trạng thái và lệnh điều khiển từ server cho thiết bị IoT
    - Trả về trạng thái cloud (on/off)
    - Trả về các lệnh điều khiển nếu có
    - Cập nhật trạng thái device thành online khi gọi API này
    """
    try:
        # Đảm bảo device_id là string
        device_id = str(device_id)
        # Kiểm tra device có tồn tại không (tìm bằng _id vì device_id chính là _id)
        device = devices_collection.find_one({"_id": device_id})
        if not device:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "Device not found",
                    "data": None
                }
            )
        
        # Cập nhật trạng thái device thành online
        devices_collection.update_one(
            {"_id": device_id},
            {"$set": {"status": "online", "updated_at": datetime.utcnow()}}
        )
        
        # Lấy trạng thái cloud (on/off) từ device
        # Có thể lưu trong device document hoặc trong collection riêng
        # Ở đây ta sẽ lấy từ device document, nếu không có thì mặc định là "off"
        cloud_status = device.get("cloud_status", "off")
        
        # Lấy các lệnh điều khiển nếu có (có thể lưu trong device document)
        # Format: {"action": "turn_on", "params": {...}}
        commands = device.get("pending_commands", [])
        
        # Xóa các lệnh đã lấy (để không gửi lại lần sau)
        if commands:
            devices_collection.update_one(
                {"_id": device_id},
                {"$set": {"pending_commands": []}}
            )
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Device status retrieved successfully",
                "data": {
                    "device_id": str(device_id),
                    "cloud_status": cloud_status,  # "on" hoặc "off"
                    "commands": commands,  # Danh sách lệnh điều khiển
                    "device_status": device.get("status", "offline")
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
