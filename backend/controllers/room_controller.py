from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.database import rooms_collection, devices_collection, user_devices_collection, user_room_devices_collection, sensors_collection, actuators_collection, sensor_data_collection, sanitize_for_json
from models.room_models import create_room_dict
from models.user_room_device_models import create_user_room_device_dict
from utils.mqtt_client import mqtt_client
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


# ==========================
# Add Device to Room (Sử dụng bảng user_room_devices)
# ==========================
def add_device_to_room(user_data: dict, room_id: str, device_id: str):
    """
    Thêm device vào room cho user (sử dụng bảng user_room_devices)
    POST /rooms/{room_id}/devices/{device_id}
    """
    try:
        user_id = str(user_data["_id"])
        
        # Kiểm tra room tồn tại và thuộc user
        room = rooms_collection.find_one({"_id": room_id, "user_id": user_id})
        if not room:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Room not found",
                    "data": None
                }
            )
        
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
        
        # Kiểm tra liên kết đã tồn tại chưa
        existing_link = user_room_devices_collection.find_one({
            "user_id": user_id,
            "room_id": room_id,
            "device_id": device_id
        })
        
        if existing_link:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "Device already in this room for this user",
                    "data": None
                }
            )
        
        # Tạo hoặc cập nhật liên kết trong bảng user_room_devices
        # Nếu device đã có trong room khác của user này, cập nhật room_id
        existing_user_device = user_room_devices_collection.find_one({
            "user_id": user_id,
            "device_id": device_id
        })
        
        if existing_user_device:
            # Cập nhật room_id
            user_room_devices_collection.update_one(
                {"user_id": user_id, "device_id": device_id},
                {"$set": {"room_id": room_id, "updated_at": datetime.utcnow()}}
            )
            logger.info(f"Đã cập nhật thiết bị {device_id} vào phòng {room_id} cho user {user_id}")
        else:
            # Tạo liên kết mới
            link = create_user_room_device_dict(user_id, device_id, room_id)
            user_room_devices_collection.insert_one(link)
            logger.info(f"Đã thêm thiết bị {device_id} vào phòng {room_id} cho user {user_id}")
        
        # Không cần cập nhật room.device_ids nữa - chỉ sử dụng bảng user_room_devices
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Device added to room successfully",
                "data": {
                    "room_id": room_id,
                    "device_id": device_id,
                    "user_id": user_id
                }
            }
        )
        
    except Exception as e:
        logger.error(f"Lỗi thêm thiết bị vào phòng: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


# ==========================
# Remove Device from Room (Sử dụng bảng user_room_devices)
# ==========================
def remove_device_from_room(user_data: dict, room_id: str, device_id: str):
    """
    Xóa device khỏi room cho user (set room_id = null trong bảng user_room_devices)
    DELETE /rooms/{room_id}/devices/{device_id}
    """
    try:
        user_id = str(user_data["_id"])
        
        # Kiểm tra room tồn tại và thuộc user
        room = rooms_collection.find_one({"_id": room_id, "user_id": user_id})
        if not room:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Room not found",
                    "data": None
                }
            )
        
        # Kiểm tra liên kết tồn tại
        existing_link = user_room_devices_collection.find_one({
            "user_id": user_id,
            "room_id": room_id,
            "device_id": device_id
        })
        
        if not existing_link:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "Device not in this room for this user",
                    "data": None
                }
            )
        
        # Xóa device khỏi room (set room_id = null)
        user_room_devices_collection.update_one(
            {"user_id": user_id, "room_id": room_id, "device_id": device_id},
            {"$set": {"room_id": None, "updated_at": datetime.utcnow()}}
        )
        
        # Không cần cập nhật room.device_ids nữa - chỉ sử dụng bảng user_room_devices
        
        logger.info(f"Đã xóa thiết bị {device_id} khỏi phòng {room_id} cho user {user_id}")
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Device removed from room successfully",
                "data": {
                    "room_id": room_id,
                    "device_id": device_id,
                    "user_id": user_id
                }
            }
        )
        
    except Exception as e:
        logger.error(f"Lỗi xóa thiết bị khỏi phòng: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


# ==========================
# Create Room
# ==========================
def create_room(name: str, description: str = "", user_id: str = None):
    """Tạo phòng mới"""
    try:
        # Kiểm tra phòng đã tồn tại chưa (theo user)
        query = {"name": name}
        if user_id:
            query["user_id"] = user_id
        existing_room = rooms_collection.find_one(query)
        if existing_room:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "Room name already exists",
                    "data": None
                }
            )

        # Tạo phòng mới
        room = create_room_dict(name, description, user_id)
        result = rooms_collection.insert_one(room)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Room created successfully",
                "data": sanitize_for_json(room)
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
# Get All Rooms
# ==========================
def get_all_rooms(user_id: str = None):
    """Lấy danh sách tất cả phòng (theo user nếu có)"""
    try:
        query = {}
        if user_id:
            query["user_id"] = user_id
        rooms = list(rooms_collection.find(query))
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Rooms retrieved successfully",
                "data": {"rooms": sanitize_for_json(rooms)}
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
# Get All Rooms with Full Data (Devices, Sensors with Latest Data, Actuators)
# ==========================
def get_all_rooms_with_data(user_id: str = None):
    """
    Lấy tất cả phòng kèm đầy đủ dữ liệu:
    - Devices trong mỗi phòng
    - Sensors với dữ liệu mới nhất
    - Actuators
    """
    try:
        query = {}
        if user_id:
            query["user_id"] = user_id
        rooms = list(rooms_collection.find(query))
        
        if not rooms:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "Rooms retrieved successfully",
                    "data": {"rooms": []}
                }
            )
        
        # Lấy tất cả device_ids của user từ bảng user_room_devices
        all_user_device_links = list(user_room_devices_collection.find({"user_id": user_id}))
        all_device_ids = list(set([link["device_id"] for link in all_user_device_links]))
        
        # Lấy tất cả devices, sensors, actuators một lần để tối ưu
        all_devices = {}
        all_sensors = {}
        all_actuators = {}
        
        if all_device_ids:
            devices_list = list(devices_collection.find({"_id": {"$in": all_device_ids}}))
            for device in devices_list:
                all_devices[device["_id"]] = device
            
            sensors_list = list(sensors_collection.find({"device_id": {"$in": all_device_ids}}))
            for sensor in sensors_list:
                device_id = sensor["device_id"]
                if device_id not in all_sensors:
                    all_sensors[device_id] = []
                all_sensors[device_id].append(sensor)
            
            actuators_list = list(actuators_collection.find({"device_id": {"$in": all_device_ids}}))
            for actuator in actuators_list:
                device_id = actuator["device_id"]
                if device_id not in all_actuators:
                    all_actuators[device_id] = []
                all_actuators[device_id].append(actuator)
        
        # Lấy dữ liệu sensor mới nhất cho tất cả sensors
        all_sensor_ids = []
        for sensor_list in all_sensors.values():
            all_sensor_ids.extend([s["_id"] for s in sensor_list])
        
        latest_sensor_data_map = {}
        if all_sensor_ids:
            # Lấy dữ liệu mới nhất cho mỗi sensor
            pipeline = [
                {"$match": {"sensor_id": {"$in": all_sensor_ids}}},
                {"$sort": {"timestamp": -1}},
                {
                    "$group": {
                        "_id": "$sensor_id",
                        "latest_data": {"$first": "$$ROOT"}
                    }
                },
                {"$replaceRoot": {"newRoot": "$latest_data"}}
            ]
            
            latest_sensor_data_list = list(sensor_data_collection.aggregate(pipeline))
            for data in latest_sensor_data_list:
                sensor_id = data.get("sensor_id")
                if sensor_id:
                    latest_sensor_data_map[sensor_id] = {
                        "value": data.get("value"),
                        "timestamp": data.get("timestamp"),
                        "created_at": data.get("created_at")
                    }
        
        # Xây dựng response cho từng room
        rooms_with_data = []
        for room in rooms:
            room_id = room["_id"]
            
            # Lấy devices của room từ bảng user_room_devices
            room_device_links = [link for link in all_user_device_links if link.get("room_id") == room_id]
            room_device_ids = [link["device_id"] for link in room_device_links]
            
            # Lấy devices, sensors, actuators cho room này
            room_devices = []
            room_sensors = []
            room_actuators = []
            
            for device_id in room_device_ids:
                if device_id in all_devices:
                    device = all_devices[device_id].copy()
                    
                    # Thêm sensors với dữ liệu mới nhất
                    device_sensors = []
                    if device_id in all_sensors:
                        for sensor in all_sensors[device_id]:
                            sensor_dict = sensor.copy()
                            sensor_id = sensor_dict["_id"]
                            
                            # Thêm dữ liệu mới nhất nếu có
                            if sensor_id in latest_sensor_data_map:
                                latest_data = latest_sensor_data_map[sensor_id]
                                sensor_dict["value"] = latest_data.get("value")
                                sensor_dict["lastUpdate"] = latest_data.get("timestamp") or latest_data.get("created_at")
                            
                            device_sensors.append(sensor_dict)
                            room_sensors.append(sensor_dict)
                    
                    device["sensors"] = device_sensors
                    
                    # Thêm actuators
                    device_actuators = []
                    if device_id in all_actuators:
                        device_actuators = [a.copy() for a in all_actuators[device_id]]
                        room_actuators.extend(device_actuators)
                    device["actuators"] = device_actuators
                    
                    room_devices.append(device)
            
            # Tạo room dict với đầy đủ dữ liệu
            room_dict = room.copy()
            room_dict["devices"] = room_devices
            room_dict["sensors"] = room_sensors
            room_dict["actuators"] = room_actuators
            
            rooms_with_data.append(room_dict)
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Rooms with full data retrieved successfully",
                "data": {"rooms": sanitize_for_json(rooms_with_data)}
            }
        )

    except Exception as e:
        logger.error(f"Lỗi lấy tất cả phòng với dữ liệu: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


# ==========================
# Get Room by ID
# ==========================
def get_room(room_id: str, user_id: str = None):
    """Lấy thông tin phòng theo ID (theo user nếu có)"""
    try:
        query = {"_id": room_id}
        if user_id:
            query["user_id"] = user_id
        room = rooms_collection.find_one(query)
        if not room:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Room not found",
                    "data": None
                }
            )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Room retrieved successfully",
                "data": sanitize_for_json(room)
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
# Control Room (Bật/tắt tất cả thiết bị trong phòng)
# ==========================
def control_room(room_id: str, action: str, user_id: str = None):
    """
    Điều khiển theo phòng
    POST /rooms/{room_id}/control
    {
      "action": "off"  // hoặc "on"
    }
    """
    try:
        # Kiểm tra phòng tồn tại (theo user)
        query = {"_id": room_id}
        if user_id:
            query["user_id"] = user_id
        room = rooms_collection.find_one(query)
        if not room:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Room not found",
                    "data": None
                }
            )

        # Lấy devices từ bảng user_room_devices (cấu trúc mới)
        user_room_device_links = list(user_room_devices_collection.find({
            "user_id": user_id,
            "room_id": room_id
        }))
        
        if not user_room_device_links:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "No devices in this room",
                    "data": {"room_id": room_id, "devices_updated": 0}
                }
            )

        # Lấy device_ids từ links
        device_ids = [link["device_id"] for link in user_room_device_links]
        
        # Lấy devices
        devices = list(devices_collection.find({"_id": {"$in": device_ids}}))
        
        if not devices:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "No devices in this room",
                    "data": {"room_id": room_id, "devices_updated": 0}
                }
            )

        # Xác định enabled dựa trên action
        enabled = (action.lower() == "on")

        # Cập nhật enabled cho tất cả devices
        device_ids_to_update = [d["_id"] for d in devices]
        result = devices_collection.update_many(
            {"_id": {"$in": device_ids_to_update}},
            {"$set": {"enabled": enabled, "updated_at": datetime.utcnow()}}
        )

        # Gửi command qua MQTT cho từng device
        for device_id in device_ids_to_update:
            sensors = list(sensors_collection.find({"device_id": device_id}))
            actuators = list(actuators_collection.find({"device_id": device_id}))
            
            command = {
                "device_enabled": enabled,
                "sensors": {s["_id"]: s.get("enabled", True) if enabled else False for s in sensors},
                "actuators": {a["_id"]: a.get("enabled", True) if enabled else False for a in actuators}
            }
            
            mqtt_client.publish_command(device_id, command, qos=1)
            logger.info(f" Room {room_id} control: device {device_id} set to {enabled}")

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": f"Room {'enabled' if enabled else 'disabled'} successfully",
                "data": {
                    "room_id": room_id,
                    "action": action,
                    "devices_updated": result.modified_count
                }
            }
        )

    except Exception as e:
        logger.error(f"Lỗi điều khiển phòng: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


# ==========================
# Get Room with Devices, Sensors, Actuators (với dữ liệu sensor mới nhất)
# ==========================
def get_room_details(room_id: str, user_id: str = None):
    """Lấy thông tin chi tiết phòng kèm devices, sensors với dữ liệu mới nhất, actuators (theo user nếu có)"""
    try:
        query = {"_id": room_id}
        if user_id:
            query["user_id"] = user_id
        room = rooms_collection.find_one(query)
        if not room:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Room not found",
                    "data": None
                }
            )

        # Lấy devices từ bảng user_room_devices (cấu trúc mới)
        user_room_device_links = list(user_room_devices_collection.find({
            "user_id": user_id,
            "room_id": room_id
        }))
        
        if not user_room_device_links:
            room["devices"] = []
            room["sensors"] = []
            room["actuators"] = []
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "Room details retrieved successfully",
                    "data": sanitize_for_json(room)
                }
            )
        
        # Lấy device_ids từ links
        device_ids = [link["device_id"] for link in user_room_device_links]
        
        # Lấy devices
        devices = list(devices_collection.find({"_id": {"$in": device_ids}}))

        # Lấy sensors và actuators
        sensors = list(sensors_collection.find({"device_id": {"$in": device_ids}}))
        actuators = list(actuators_collection.find({"device_id": {"$in": device_ids}}))

        # Lấy dữ liệu sensor mới nhất cho tất cả sensors
        sensor_ids = [s["_id"] for s in sensors]
        latest_sensor_data_map = {}
        
        if sensor_ids:
            # Lấy dữ liệu mới nhất cho mỗi sensor
            pipeline = [
                {"$match": {"sensor_id": {"$in": sensor_ids}}},
                {"$sort": {"timestamp": -1}},
                {
                    "$group": {
                        "_id": "$sensor_id",
                        "latest_data": {"$first": "$$ROOT"}
                    }
                },
                {"$replaceRoot": {"newRoot": "$latest_data"}}
            ]
            
            latest_sensor_data_list = list(sensor_data_collection.aggregate(pipeline))
            for data in latest_sensor_data_list:
                sensor_id = data.get("sensor_id")
                if sensor_id:
                    latest_sensor_data_map[sensor_id] = {
                        "value": data.get("value"),
                        "timestamp": data.get("timestamp"),
                        "created_at": data.get("created_at")
                    }

        # Cập nhật sensors với dữ liệu mới nhất
        sensors_with_data = []
        for sensor in sensors:
            sensor_dict = sensor.copy()
            sensor_id = sensor_dict["_id"]
            
            # Thêm dữ liệu mới nhất nếu có
            if sensor_id in latest_sensor_data_map:
                latest_data = latest_sensor_data_map[sensor_id]
                sensor_dict["value"] = latest_data.get("value")
                sensor_dict["lastUpdate"] = latest_data.get("timestamp") or latest_data.get("created_at")
            
            sensors_with_data.append(sensor_dict)

        # Nhóm sensors và actuators theo device
        for device in devices:
            device["sensors"] = [s for s in sensors_with_data if s["device_id"] == device["_id"]]
            device["actuators"] = [a for a in actuators if a["device_id"] == device["_id"]]

        room["devices"] = devices
        room["sensors"] = sensors_with_data
        room["actuators"] = actuators

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Room details retrieved successfully",
                "data": sanitize_for_json(room)
            }
        )

    except Exception as e:
        logger.error(f" Error getting room details: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


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
def delete_room(user_data: dict, room_name: str = None, room_id: str = None):
    """
    Xóa phòng
    - room_name: Tên phòng cần xóa (legacy)
    - room_id: ID phòng cần xóa (mới)
    Nếu có devices trong phòng, sẽ xóa room_id của chúng (set về null hoặc empty)
    Cho phép xóa room ngay cả khi không có devices
    """
    try:
        user_id = str(user_data["_id"])

        # Tìm room theo room_id hoặc room_name
        query = {}
        if room_id:
            query["_id"] = room_id
        elif room_name:
            query["name"] = room_name
        else:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "Either room_id or room_name must be provided",
                    "data": None
                }
            )
        
        # Thêm user_id vào query để đảm bảo chỉ xóa room của user
        query["user_id"] = user_id
        
        # Tìm room
        room = rooms_collection.find_one(query)
        if not room:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": f"Room not found",
                    "data": None
                }
            )

        room_id_to_delete = room["_id"]
        
        # Lấy device_ids từ bảng user_room_devices (thay vì từ room.device_ids)
        user_room_device_links = list(user_room_devices_collection.find({
            "user_id": user_id,
            "room_id": room_id_to_delete
        }))
        device_ids_in_room = [link["device_id"] for link in user_room_device_links]
        
        # Xóa tất cả liên kết trong bảng user_room_devices (set room_id = None)
        if device_ids_in_room:
            user_room_devices_collection.update_many(
                {"user_id": user_id, "room_id": room_id_to_delete},
                {"$set": {"room_id": None, "updated_at": datetime.utcnow()}}
            )
            logger.info(f"Phòng {room_id_to_delete} chứa {len(device_ids_in_room)} thiết bị (đã xóa khỏi phòng)")
        
        # Xóa room
        rooms_collection.delete_one({"_id": room_id_to_delete})

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": f"Room deleted successfully",
                "data": {
                    "deleted_room_id": room_id_to_delete,
                    "deleted_room_name": room.get("name", ""),
                    "devices_removed": len(device_ids_in_room) if device_ids_in_room else 0
                }
            }
        )

    except Exception as e:
        logger.error(f"Lỗi xóa phòng: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )



