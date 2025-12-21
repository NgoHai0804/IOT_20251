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
def register_device(device_serial: str, device_name: str, device_type: str, 
                   device_password: str = None, location: str = None, note: str = None):
    """
    Đăng ký thiết bị IoT với server
    - Kiểm tra device_serial đã tồn tại chưa
    - Nếu chưa tồn tại → tạo mới device
    - Nếu đã tồn tại → trả về thông tin device hiện có
    """
    try:
        # Kiểm tra device_serial đã tồn tại chưa
        existing_device = devices_collection.find_one({"device_serial": device_serial})
        
        if existing_device:
            # Device đã tồn tại, trả về thông tin
            device_id = existing_device.get("device_id")
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "Device already registered",
                    "data": {
                        "device_id": device_id,
                        "device_serial": device_serial,
                        "device_name": existing_device.get("device_name"),
                        "device_type": existing_device.get("device_type"),
                        "status": existing_device.get("status", "offline")
                    }
                }
            )
        
        # Tạo device mới
        device = create_device_dict(
            device_serial=device_serial,
            device_name=device_name,
            device_type=device_type,
            location=location or "",
            status="offline",  # Mặc định là offline khi đăng ký
            note=note or "",
            device_password=device_password
        )
        
        result = devices_collection.insert_one(device)
        device_id = device["device_id"]
        
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "status": True,
                "message": "Device registered successfully",
                "data": {
                    "device_id": device_id,
                    "device_serial": device_serial,
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
        # Kiểm tra device có tồn tại không
        device = devices_collection.find_one({"device_id": device_id})
        if not device:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": False,
                    "message": "Device not found",
                    "data": None
                }
            )
        
        # Kiểm tra sensor đã tồn tại chưa
        existing_sensor = sensors_collection.find_one({
            "sensor_id": sensor_id,
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
                {"sensor_id": sensor_id, "device_id": device_id},
                {"$set": update_fields}
            )
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "Sensor updated successfully",
                    "data": {
                        "sensor_id": sensor_id,
                        "name": name,
                        "sensor_type": sensor_type,
                        "device_id": device_id
                    }
                }
            )
        
        # Tạo sensor mới
        sensor = create_sensor_dict(
            device_id=device_id,
            sensor_type=sensor_type,
            name=name,
            unit="",
            pin=0,
            enabled=True,
            auto_set_threshold=True  # Tự động set ngưỡng mặc định
        )
        # Sử dụng sensor_id từ thiết bị IoT thay vì UUID tự động
        sensor["sensor_id"] = sensor_id
        
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
        # Kiểm tra device có tồn tại không
        device = devices_collection.find_one({"device_id": device_id})
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
            {"device_id": device_id},
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
                {"device_id": device_id},
                {"$set": {"pending_commands": []}}
            )
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Device status retrieved successfully",
                "data": {
                    "device_id": device_id,
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
