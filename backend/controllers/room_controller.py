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
        
        # Kiểm tra user có quyền truy cập device này không
        user_device_link = user_devices_collection.find_one({
            "user_id": user_id,
            "device_id": device_id
        })
        
        if not user_device_link:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "status": False,
                    "message": "You don't have access to this device",
                    "data": None
                }
            )
        
        # Kiểm tra liên kết đã tồn tại chưa trong room này
        existing_link = user_room_devices_collection.find_one({
            "user_id": user_id,
            "room_id": room_id,
            "device_id": device_id
        })
        
        if existing_link:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "Device is already in this room",
                    "data": {
                        "room_id": room_id,
                        "device_id": device_id,
                        "user_id": user_id
                    }
                }
            )
        
        # Tạo hoặc cập nhật liên kết trong bảng user_room_devices
        # Nếu device đã có trong room khác của user này, cập nhật room_id
        existing_user_device = user_room_devices_collection.find_one({
            "user_id": user_id,
            "device_id": device_id
        })
        
        if existing_user_device:
            # Cập nhật room_id (chuyển device từ room khác sang room này)
            user_room_devices_collection.update_one(
                {"user_id": user_id, "device_id": device_id},
                {"$set": {"room_id": room_id, "updated_at": datetime.utcnow()}}
            )
            logger.info(f"Đã chuyển thiết bị {device_id} vào phòng {room_id} cho user {user_id}")
        else:
            # Tạo liên kết mới
            link = create_user_room_device_dict(user_id, device_id, room_id)
            user_room_devices_collection.insert_one(link)
            logger.info(f"Đã thêm thiết bị {device_id} vào phòng {room_id} cho user {user_id}")
        
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
        
        # Lấy tất cả device links của user từ bảng user_room_devices (chỉ dùng bảng này)
        all_user_device_links = list(user_room_devices_collection.find({"user_id": user_id}))
        logger.info(f"Found {len(all_user_device_links)} device links for user {user_id} from user_room_devices table")
        
        # Lấy tất cả device_ids từ bảng user_room_devices (bao gồm cả devices không có room_id)
        all_device_ids = list(set([link["device_id"] for link in all_user_device_links if "device_id" in link and link["device_id"]]))
        logger.info(f"Found {len(all_device_ids)} unique device IDs from user_room_devices table: {all_device_ids}")
        
        # Lấy tất cả devices, sensors, actuators một lần để tối ưu
        all_devices = {}
        all_sensors = {}
        all_actuators = {}
        device_id_mapping = {}  # Mapping từ device_id trong user_room_devices -> _id thực tế trong devices
        
        if all_device_ids:
            # Tạo mapping từ device_id trong user_room_devices sang _id thực tế trong devices
            # Thử query bằng _id trước
            devices_by_id = list(devices_collection.find({"_id": {"$in": all_device_ids}}))
            logger.info(f"Found {len(devices_by_id)} devices in database by _id")
            
            # Thử query bằng device_id field (backward compatible)
            devices_by_device_id_field = list(devices_collection.find({"device_id": {"$in": all_device_ids}}))
            logger.info(f"Found {len(devices_by_device_id_field)} devices in database by device_id field")
            
            # Tạo mapping: device_id từ user_room_devices -> _id thực tế trong devices
            for device in devices_by_id:
                device_key = device.get("_id")
                all_devices[device_key] = device
                # Map device_id từ link -> _id thực tế
                device_id_mapping[device_key] = device_key
                logger.info(f"Added device by _id: link_id={device_key}, _id={device_key}, device_id={device.get('device_id', 'N/A')}")
            
            for device in devices_by_device_id_field:
                device_key = device.get("_id")
                device_id_field = device.get("device_id")
                if device_key not in all_devices:
                    all_devices[device_key] = device
                # Map device_id từ link -> _id thực tế
                if device_id_field:
                    device_id_mapping[device_id_field] = device_key
                device_id_mapping[device_key] = device_key
                logger.info(f"Added device by device_id field: link_id={device_id_field}, _id={device_key}, device_id={device_id_field}")
            
            logger.info(f"Device ID mapping: {device_id_mapping}")
            
            # Lấy sensors và actuators - sử dụng actual device IDs
            actual_device_ids = list(set(device_id_mapping.values())) if device_id_mapping else all_device_ids
            logger.info(f"Querying sensors/actuators with actual device IDs: {actual_device_ids}")
            
            sensors_list = list(sensors_collection.find({"device_id": {"$in": actual_device_ids}}))
            logger.info(f"Found {len(sensors_list)} sensors")
            for sensor in sensors_list:
                device_id = sensor["device_id"]
                if device_id not in all_sensors:
                    all_sensors[device_id] = []
                all_sensors[device_id].append(sensor)
            
            actuators_list = list(actuators_collection.find({"device_id": {"$in": actual_device_ids}}))
            logger.info(f"Found {len(actuators_list)} actuators")
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
        # Sử dụng dữ liệu đã lấy từ bảng user_room_devices (không query lại)
        rooms_with_data = []
        for room in rooms:
            room_id = room["_id"]
            
            # Lọc devices của room này từ dữ liệu đã lấy từ bảng user_room_devices
            # Chỉ lấy những links có room_id khớp với room_id hiện tại (không phải None)
            room_device_links = []
            for link in all_user_device_links:
                link_room_id = link.get("room_id")
                if link_room_id is not None:
                    # So sánh cả string và ObjectId để đảm bảo chính xác
                    if str(link_room_id) == str(room_id) or link_room_id == room_id:
                        room_device_links.append(link)
            
            room_device_ids = [link["device_id"] for link in room_device_links if "device_id" in link and link["device_id"]]
            logger.info(f"Room {room_id} has {len(room_device_ids)} devices (from user_room_devices table)")
            
            # Lấy devices, sensors, actuators cho room này
            room_devices = []
            room_sensors = []
            room_actuators = []
            
            for link_device_id in room_device_ids:
                # Tìm actual device_id từ mapping
                actual_device_id = device_id_mapping.get(link_device_id, link_device_id)
                logger.info(f"Mapping device_id from link: {link_device_id} -> {actual_device_id}")
                
                # Tìm device trong all_devices
                device = None
                if actual_device_id in all_devices:
                    device = all_devices[actual_device_id].copy()
                elif link_device_id in all_devices:
                    device = all_devices[link_device_id].copy()
                else:
                    logger.warning(f"Device not found: link_id={link_device_id}, actual_id={actual_device_id}")
                
                if device:
                    # Sử dụng actual_device_id để lấy sensors và actuators
                    device_id_for_sensors = actual_device_id
                    
                    # Thêm sensors với dữ liệu mới nhất
                    device_sensors = []
                    if device_id_for_sensors in all_sensors:
                        for sensor in all_sensors[device_id_for_sensors]:
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
                    if device_id_for_sensors in all_actuators:
                        device_actuators = [a.copy() for a in all_actuators[device_id_for_sensors]]
                        room_actuators.extend(device_actuators)
                    device["actuators"] = device_actuators
                    
                    room_devices.append(device)
            
            # Tạo room dict với đầy đủ dữ liệu
            room_dict = room.copy()
            room_dict["devices"] = room_devices
            room_dict["sensors"] = room_sensors
            room_dict["actuators"] = room_actuators
            
            logger.info(f"Room {room_id} final data: {len(room_devices)} devices, {len(room_sensors)} sensors, {len(room_actuators)} actuators")
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
        # Chỉ lấy những links có room_id khớp với room_id hiện tại (không phải None)
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
        
        # Lấy device_ids từ links (đảm bảo device_id tồn tại)
        device_ids = [link["device_id"] for link in user_room_device_links if "device_id" in link and link["device_id"]]
        
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

        # Xử lý devices: chỉ giữ thông tin cần thiết, bỏ sensors và actuators
        for device in devices:
            device["_id"] = str(device["_id"])
            # Xóa device_password và các trường không cần thiết
            device.pop("device_password", None)
            # Không thêm sensors và actuators vào device

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
    """
    try:
        user_id = str(user_data["_id"])

        # Tìm room theo tên cũ và user_id
        room = rooms_collection.find_one({
            "name": old_room_name,
            "user_id": user_id
        })

        if not room:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": f"Room '{old_room_name}' not found",
                    "data": None
                }
            )

        # Kiểm tra tên mới đã tồn tại chưa
        existing_room = rooms_collection.find_one({
            "name": new_room_name,
            "user_id": user_id,
            "_id": {"$ne": room["_id"]}  # Loại trừ room hiện tại
        })

        if existing_room:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": f"Room name '{new_room_name}' already exists",
                    "data": None
                }
            )

        # Cập nhật tên phòng
        result = rooms_collection.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "name": new_room_name,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        if result.modified_count > 0:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": f"Room name updated successfully",
                    "data": {
                        "room_id": room["_id"],
                        "old_room_name": old_room_name,
                        "new_room_name": new_room_name
                    }
                }
            )
        else:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "Failed to update room name",
                    "data": None
                }
            )

    except Exception as e:
        logger.error(f"Lỗi cập nhật tên phòng: {str(e)}")
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



