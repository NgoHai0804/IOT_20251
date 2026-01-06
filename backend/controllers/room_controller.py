from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.database import rooms_collection, devices_collection, user_room_devices_collection, sensors_collection, actuators_collection, sensor_data_collection, sanitize_for_json
from models.room_models import create_room_dict
from models.user_room_device_models import create_user_room_device_dict
from utils.mqtt_client import mqtt_client
import logging
from datetime import datetime, timedelta
from utils.timezone import get_vietnam_now_naive
from bson import ObjectId

TIME_THRESHOLD_SECONDS = 5 * 60  # 5 phút

logger = logging.getLogger(__name__)


def add_device_to_room(user_data: dict, room_id: str, device_id: str):
    try:
        user_id = str(user_data["_id"])
        device_id = str(device_id)
        room_id = str(room_id)
        
        room = rooms_collection.find_one({"_id": room_id, "user_id": user_id})
        if not room:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Không tìm thấy phòng",
                    "data": None
                }
            )
        
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
        
        user_device_link = user_room_devices_collection.find_one({
            "user_id": user_id,
            "device_id": device_id
        })
        
        if not user_device_link:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "status": False,
                    "message": "Bạn không có quyền truy cập thiết bị này",
                    "data": None
                }
            )
        
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
                    "message": "Thiết bị đã có trong phòng này",
                    "data": {
                        "room_id": room_id,
                        "device_id": device_id,
                        "user_id": user_id
                    }
                }
            )
        
        existing_user_device = user_room_devices_collection.find_one({
            "user_id": user_id,
            "device_id": device_id
        })
        
        if existing_user_device:
            user_room_devices_collection.update_one(
                {"user_id": user_id, "device_id": device_id},
                {"$set": {"room_id": room_id, "updated_at": get_vietnam_now_naive()}}
            )
            pass
        else:
            link = create_user_room_device_dict(user_id, device_id, room_id)
            user_room_devices_collection.insert_one(link)
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Thêm thiết bị vào phòng thành công",
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
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )


def remove_device_from_room(user_data: dict, room_id: str, device_id: str):
    """
    Xóa device khỏi room cho user (set room_id = null trong bảng user_room_devices)
    DELETE /rooms/{room_id}/devices/{device_id}
    """
    try:
        user_id = str(user_data["_id"])
        # Đảm bảo device_id và room_id là string
        device_id = str(device_id)
        room_id = str(room_id)
        
        # Kiểm tra room tồn tại và thuộc user
        room = rooms_collection.find_one({"_id": room_id, "user_id": user_id})
        if not room:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "Không tìm thấy phòng",
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
                    "message": "Thiết bị không có trong phòng này",
                    "data": None
                }
            )
        
        # Xóa device khỏi room (set room_id = null)
        user_room_devices_collection.update_one(
            {"user_id": user_id, "room_id": room_id, "device_id": device_id},
            {"$set": {"room_id": None, "updated_at": get_vietnam_now_naive()}}
        )
        
        # Không cần cập nhật room.device_ids nữa - chỉ sử dụng bảng user_room_devices
        
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Xóa thiết bị khỏi phòng thành công",
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
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )


def create_room(name: str, description: str = "", user_id: str = None):
    try:
        query = {"name": name}
        if user_id:
            query["user_id"] = user_id
        existing_room = rooms_collection.find_one(query)
        if existing_room:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "Tên phòng đã tồn tại",
                    "data": None
                }
            )

        room = create_room_dict(name, description, user_id)
        rooms_collection.insert_one(room)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Tạo phòng thành công",
                "data": sanitize_for_json(room)
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
                "message": "Lấy danh sách phòng thành công",
                "data": {"rooms": sanitize_for_json(rooms)}
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


def get_all_rooms_with_data(user_id: str = None):
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
                    "message": "Lấy danh sách phòng thành công",
                    "data": {"rooms": []}
                }
            )
        
        all_user_device_links = list(user_room_devices_collection.find({"user_id": user_id}))
        all_device_ids = list(set([link["device_id"] for link in all_user_device_links if "device_id" in link and link["device_id"]]))
        
        all_devices = {}
        all_sensors = {}
        all_actuators = {}
        device_id_mapping = {}
        
        if all_device_ids:
            devices_by_id = list(devices_collection.find({"_id": {"$in": all_device_ids}}))
            devices_by_device_id_field = list(devices_collection.find({"device_id": {"$in": all_device_ids}}))
            
            for device in devices_by_id:
                device_key = device.get("_id")
                all_devices[device_key] = device
                device_id_mapping[device_key] = device_key
            
            for device in devices_by_device_id_field:
                device_key = device.get("_id")
                device_id_field = device.get("device_id")
                if device_key not in all_devices:
                    all_devices[device_key] = device
                if device_id_field:
                    device_id_mapping[device_id_field] = device_key
                device_id_mapping[device_key] = device_key
            
            actual_device_ids = list(set(device_id_mapping.values())) if device_id_mapping else all_device_ids
            
            sensors_list = list(sensors_collection.find({"device_id": {"$in": actual_device_ids}}))
            for sensor in sensors_list:
                device_id = sensor["device_id"]
                if device_id not in all_sensors:
                    all_sensors[device_id] = []
                all_sensors[device_id].append(sensor)
            
            actuators_list = list(actuators_collection.find({"device_id": {"$in": actual_device_ids}}))
            for actuator in actuators_list:
                device_id = actuator["device_id"]
                if device_id not in all_actuators:
                    all_actuators[device_id] = []
                all_actuators[device_id].append(actuator)
        
        all_sensor_ids = []
        for sensor_list in all_sensors.values():
            all_sensor_ids.extend([s["_id"] for s in sensor_list])
        
        latest_sensor_data_map = {}
        if all_sensor_ids:
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
        
        rooms_with_data = []
        for room in rooms:
            room_id = room["_id"]
            
            room_device_links = []
            for link in all_user_device_links:
                link_room_id = link.get("room_id")
                if link_room_id is not None:
                    if str(link_room_id) == str(room_id) or link_room_id == room_id:
                        room_device_links.append(link)
            
            room_device_ids = [link["device_id"] for link in room_device_links if "device_id" in link and link["device_id"]]
            
            room_devices = []
            room_sensors = []
            room_actuators = []
            
            for link_device_id in room_device_ids:
                actual_device_id = device_id_mapping.get(link_device_id, link_device_id)
                
                device = None
                if actual_device_id in all_devices:
                    device = all_devices[actual_device_id].copy()
                elif link_device_id in all_devices:
                    device = all_devices[link_device_id].copy()
                
                if device:
                    device_id_for_sensors = actual_device_id
                    
                    device_sensors = []
                    if device_id_for_sensors in all_sensors:
                        for sensor in all_sensors[device_id_for_sensors]:
                            sensor_dict = sensor.copy()
                            sensor_id = sensor_dict["_id"]
                            
                            if sensor_id in latest_sensor_data_map:
                                latest_data = latest_sensor_data_map[sensor_id]
                                sensor_dict["value"] = latest_data.get("value")
                                sensor_dict["lastUpdate"] = latest_data.get("timestamp") or latest_data.get("created_at")
                            
                            device_sensors.append(sensor_dict)
                            room_sensors.append(sensor_dict)
                    
                    device["sensors"] = device_sensors
                    
                    device_actuators = []
                    if device_id_for_sensors in all_actuators:
                        device_actuators = [a.copy() for a in all_actuators[device_id_for_sensors]]
                        room_actuators.extend(device_actuators)
                    device["actuators"] = device_actuators
                    
                    room_devices.append(device)
            
            room_dict = room.copy()
            room_dict["devices"] = room_devices
            room_dict["sensors"] = room_sensors
            room_dict["actuators"] = room_actuators
            
            rooms_with_data.append(room_dict)
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Lấy danh sách phòng với đầy đủ dữ liệu thành công",
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
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )


def get_room(room_id: str, user_id: str = None):
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
                    "message": "Không tìm thấy phòng",
                    "data": None
                }
            )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Lấy thông tin phòng thành công",
                "data": sanitize_for_json(room)
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


def control_room(room_id: str, action: str, user_id: str = None):
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
                    "message": "Không tìm thấy phòng",
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
                    "message": "Phòng này không có thiết bị",
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
                    "message": "Phòng này không có thiết bị",
                    "data": {"room_id": room_id, "devices_updated": 0}
                }
            )

        # Xác định enabled dựa trên action
        enabled = (action.lower() == "on")

        # Cập nhật enabled cho tất cả devices
        device_ids_to_update = [d["_id"] for d in devices]
        result = devices_collection.update_many(
            {"_id": {"$in": device_ids_to_update}},
            {"$set": {"enabled": enabled, "updated_at": get_vietnam_now_naive()}}
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

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": f"Phòng đã được {'bật' if enabled else 'tắt'} thành công",
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
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )


def get_room_details(room_id: str, user_id: str = None):

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
                    "message": "Không tìm thấy phòng",
                    "data": None
                }
            )

        links = list(user_room_devices_collection.find({
            "user_id": user_id,
            "room_id": room_id
        }))

        if not links:
            room["devices"] = []
            room["averaged_sensors"] = []
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "Lấy chi tiết phòng thành công",
                    "data": sanitize_for_json(room)
                }
            )

        device_ids = [link["device_id"] for link in links if link.get("device_id")]

        devices_raw = list(devices_collection.find({"_id": {"$in": device_ids}}))

        devices = []
        for d in devices_raw:
            devices.append({
                "_id": str(d["_id"]),
                "name": d.get("name", ""),
                "type": d.get("type", ""),
                "status": d.get("status", ""),
                "enabled": d.get("enabled", False),
                "created_at": d.get("created_at"),
                "updated_at": d.get("updated_at"),
                "note": d.get("note"),
                "device_name": d.get("device_name")
            })

        sensors = list(sensors_collection.find({"device_id": {"$in": device_ids}}))

        sensor_latest = {}

        for s in sensors:
            sid_str = str(s["_id"])
            latest = sensor_data_collection.find_one(
                {"sensor_id": {"$in": [sid_str, s["_id"]]}},
                sort=[("timestamp", -1)]
            )
            if latest:
                sensor_latest[sid_str] = {
                    "value": latest.get("value"),
                    "timestamp": latest.get("timestamp") or latest.get("created_at")
                }

        sensors_with_data = []
        for s in sensors:
            sd = s.copy()
            sid = str(sd["_id"])

            if sid in sensor_latest:
                sd["value"] = sensor_latest[sid]["value"]
                sd["lastUpdate"] = sensor_latest[sid]["timestamp"]
            else:
                sd["value"] = None
                sd["lastUpdate"] = None

            sensors_with_data.append(sd)

        sensors_by_type = {}
        for s in sensors_with_data:
            stype = s.get("type", "unknown")
            sensors_by_type.setdefault(stype, []).append(s)

        averaged_sensors = []

        for sensor_type, type_sensors in sensors_by_type.items():
            valid = [
                s for s in type_sensors
                if s.get("value") is not None and isinstance(s.get("lastUpdate"), datetime)
            ]

            if not valid:
                averaged_sensors.append({
                    "type": sensor_type,
                    "name": (
                        "Nhiệt độ" if sensor_type == "temperature"
                        else "Độ ẩm" if sensor_type == "humidity"
                        else "Khí gas" if sensor_type == "gas"
                        else sensor_type
                    ),
                    "unit": type_sensors[0].get("unit", ""),
                    "value": None,
                    "lastUpdate": None
                })
                continue

            valid.sort(key=lambda x: x["lastUpdate"], reverse=True)
            latest_sensor = valid[0]
            latest_time = latest_sensor["lastUpdate"]

            in_range = [
                s for s in valid
                if abs((latest_time - s["lastUpdate"]).total_seconds()) <= TIME_THRESHOLD_SECONDS
            ]

            if len(in_range) == 1:
                final_value = latest_sensor["value"]
            else:
                final_value = round(
                    sum(s["value"] for s in in_range) / len(in_range),
                    1
                )

            averaged_sensors.append({
                "type": sensor_type,
                "name": (
                    "Nhiệt độ" if sensor_type == "temperature"
                    else "Độ ẩm" if sensor_type == "humidity"
                    else "Khí gas" if sensor_type == "gas"
                    else sensor_type
                ),
                "unit": latest_sensor.get("unit", ""),
                "value": final_value,
                "lastUpdate": latest_time
            })

        room["devices"] = devices
        room["averaged_sensors"] = averaged_sensors

        room.pop("sensors", None)
        room.pop("actuators", None)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Lấy chi tiết phòng thành công",
                "data": sanitize_for_json(room)
            }
        )

    except Exception as e:
        logger.error(f"Lỗi khi lấy chi tiết phòng: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )


def update_room_name(user_data: dict, old_room_name: str, new_room_name: str):
    try:
        user_id = str(user_data["_id"])

        room = rooms_collection.find_one({
            "name": old_room_name,
            "user_id": user_id
        })

        if not room:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": f"Không tìm thấy phòng '{old_room_name}'",
                    "data": None
                }
            )

        existing_room = rooms_collection.find_one({
            "name": new_room_name,
            "user_id": user_id,
            "_id": {"$ne": room["_id"]}
        })

        if existing_room:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": f"Tên phòng '{new_room_name}' đã tồn tại",
                    "data": None
                }
            )

        result = rooms_collection.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "name": new_room_name,
                    "updated_at": get_vietnam_now_naive()
                }
            }
        )

        if result.modified_count > 0:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": True,
                    "message": "Cập nhật tên phòng thành công",
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
                    "message": "Không thể cập nhật tên phòng",
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
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )


def delete_room(user_data: dict, room_name: str = None, room_id: str = None):
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
                    "message": "Cần cung cấp room_id hoặc room_name",
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
                    "message": "Không tìm thấy phòng",
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
                {"$set": {"room_id": None, "updated_at": get_vietnam_now_naive()}}
            )
        
        # Xóa room
        rooms_collection.delete_one({"_id": room_id_to_delete})

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Xóa phòng thành công",
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
                "message": f"Lỗi không mong muốn: {str(e)}",
                "data": None
            }
        )



