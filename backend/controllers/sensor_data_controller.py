from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.database import (
    sensor_data_collection, 
    devices_collection, 
    user_room_devices_collection,
    sensors_collection,
    sanitize_for_json
)
from datetime import datetime, timedelta
from utils.timezone import get_vietnam_now_naive, convert_to_vietnam_naive
from typing import Optional, Dict, List
from bson import ObjectId


def get_sensor_data(
    user_data: dict,
    device_id: Optional[str] = None,
    sensor_id: Optional[str] = None,
    sensor_type: Optional[str] = None,
    limit: int = 100,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None
):
    """
    Lấy dữ liệu sensor từ database
    """
    try:
        user_id = str(user_data["_id"])
        
        # Xây dựng query filter
        query = {}
        
        # Nếu có sensor_id, tìm sensor để lấy device_id và kiểm tra quyền truy cập
        if sensor_id:
            sensor_id = str(sensor_id)
            # Tìm sensor theo sensor_id
            sensor = sensors_collection.find_one({"_id": sensor_id})
            if not sensor:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": False,
                        "message": "Sensor not found",
                        "data": {"sensor_data": [], "total": 0}
                    }
                )
            
            # Lấy device_id từ sensor
            sensor_device_id = sensor.get("device_id")
            if not sensor_device_id:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": False,
                        "message": "Sensor does not belong to any device",
                        "data": {"sensor_data": [], "total": 0}
                    }
                )
            
            # Kiểm tra quyền truy cập device
            link = user_room_devices_collection.find_one({"user_id": user_id, "device_id": str(sensor_device_id)})
            if not link:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": False,
                        "message": "Sensor does not belong to any device accessible by this user",
                        "data": {"sensor_data": [], "total": 0}
                    }
                )
            
            # Query theo sensor_id (không cần filter device_id vì đã kiểm tra quyền)
            query["sensor_id"] = sensor_id
            
            # Nếu có device_id được truyền vào và khác với device_id của sensor, báo lỗi
            if device_id and str(device_id) != str(sensor_device_id):
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "status": False,
                        "message": "Device ID does not match the sensor's device",
                        "data": None
                    }
                )
        
        # Nếu không có sensor_id, kiểm tra quyền truy cập device
        elif device_id:
            # Đảm bảo device_id là string
            device_id = str(device_id)
            # Kiểm tra device có thuộc về user không
            link = user_room_devices_collection.find_one({"user_id": user_id, "device_id": device_id})
            if not link:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": False,
                        "message": "Device not linked to this user or not found",
                        "data": None
                    }
                )
            query["device_id"] = device_id
        
        # Nếu không có cả sensor_id và device_id, lấy tất cả devices của user
        else:
            linked_devices = user_room_devices_collection.find({"user_id": user_id})
            device_ids = list(set([link["device_id"] for link in linked_devices]))  # Loại bỏ duplicate
            
            if not device_ids:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": True,
                        "message": "No devices found for this user",
                        "data": {"sensor_data": [], "total": 0}
                    }
                )
            query["device_id"] = {"$in": device_ids}
        
        # Filter theo sensor_type
        if sensor_type:
            query["sensor_type"] = sensor_type
        
        # Filter theo thời gian
        if start_time or end_time:
            time_query = {}
            if start_time:
                try:
                    # Parse UTC time từ frontend
                    start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                    # Chuyển đổi sang giờ Việt Nam (naive) để so sánh với timestamp trong database
                    start_dt_vietnam = convert_to_vietnam_naive(start_dt)
                    time_query["$gte"] = start_dt_vietnam
                except ValueError:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "status": False,
                            "message": "Invalid start_time format. Use ISO format (e.g., 2024-01-01T00:00:00Z)",
                            "data": None
                        }
                    )
            
            if end_time:
                try:
                    # Parse UTC time từ frontend
                    end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                    # Chuyển đổi sang giờ Việt Nam (naive) để so sánh với timestamp trong database
                    end_dt_vietnam = convert_to_vietnam_naive(end_dt)
                    time_query["$lte"] = end_dt_vietnam
                except ValueError:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "status": False,
                            "message": "Invalid end_time format. Use ISO format (e.g., 2024-01-01T23:59:59Z)",
                            "data": None
                        }
                    )
            
            if time_query:
                query["timestamp"] = time_query
        
        # Lấy dữ liệu từ database, sắp xếp theo timestamp giảm dần (mới nhất trước)
        cursor = sensor_data_collection.find(query).sort("timestamp", -1).limit(limit)
        sensor_data_list = list(cursor)
        
        # Convert ObjectId và datetime
        for item in sensor_data_list:
            if "_id" in item:
                item["_id"] = str(item["_id"])
        
        # Đếm tổng số records (không giới hạn)
        total_count = sensor_data_collection.count_documents(query)
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Sensor data retrieved successfully",
                "data": {
                    "sensor_data": sanitize_for_json(sensor_data_list),
                    "total": total_count,
                    "returned": len(sensor_data_list),
                    "limit": limit
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


def get_latest_sensor_data(
    user_data: dict,
    device_id: Optional[str] = None,
    sensor_id: Optional[str] = None
):
    """
    Lấy dữ liệu sensor mới nhất
    """
    try:
        user_id = str(user_data["_id"])
        
        query = {}
        
        # Kiểm tra quyền truy cập device từ bảng user_room_devices
        if device_id:
            # Đảm bảo device_id là string
            device_id = str(device_id)
            # Kiểm tra device thuộc về user
            link = user_room_devices_collection.find_one({"user_id": user_id, "device_id": device_id})
            if not link:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": False,
                        "message": "Device not found or does not belong to this user",
                        "data": None
                    }
                )
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
            
            # Có device_id cụ thể, lấy sensors của device này
            device_sensors = list(sensors_collection.find({"device_id": device_id}))
            sensor_ids = [s["_id"] for s in device_sensors]
            
            if sensor_id:
                # Kiểm tra sensor_id có thuộc device không
                if sensor_id not in sensor_ids:
                    return JSONResponse(
                        status_code=status.HTTP_200_OK,
                        content={
                            "status": False,
                            "message": "Sensor not found or does not belong to device",
                            "data": None
                        }
                    )
                query["sensor_id"] = sensor_id
            else:
                # Query theo sensor_id (vì sensor_data có thể không có device_id)
                if sensor_ids:
                    query["sensor_id"] = {"$in": sensor_ids}
                else:
                    return JSONResponse(
                        status_code=status.HTTP_200_OK,
                        content={
                            "status": True,
                            "message": "No sensors found for device",
                            "data": {"sensor_data": [], "count": 0}
                        }
                    )
        else:
            # Lấy tất cả devices của user từ bảng user_room_devices
            linked_devices = user_room_devices_collection.find({"user_id": user_id})
            device_ids = list(set([link["device_id"] for link in linked_devices]))  # Loại bỏ duplicate
            
            if not device_ids:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": True,
                        "message": "No devices found for this user",
                        "data": {"sensor_data": [], "count": 0}
                    }
                )
            
            # Lấy tất cả sensors của các devices này
            # Query sensor_data qua sensor_id (vì sensor_data cũ có thể không có device_id)
            user_sensors = list(sensors_collection.find({"device_id": {"$in": device_ids}}))
            sensor_ids = [s["_id"] for s in user_sensors]
            
            if not sensor_ids:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": True,
                        "message": "No sensors found for user devices",
                        "data": {"sensor_data": [], "count": 0}
                    }
                )
            
            # Query theo sensor_id thay vì device_id (vì sensor_data có thể không có device_id)
            if sensor_id:
                # Kiểm tra sensor_id có thuộc user không
                if sensor_id not in sensor_ids:
                    return JSONResponse(
                        status_code=status.HTTP_200_OK,
                        content={
                            "status": False,
                            "message": "Sensor not found or does not belong to user",
                            "data": None
                        }
                    )
                query["sensor_id"] = sensor_id
            else:
                query["sensor_id"] = {"$in": sensor_ids}
        
        # Lấy dữ liệu mới nhất cho mỗi sensor
        # Nếu query có device_id, dùng trực tiếp
        # Nếu không, query qua sensor_id (đã filter ở trên)
        pipeline = [
            {"$match": query},
            {"$sort": {"timestamp": -1}},
            {
                "$group": {
                    "_id": "$sensor_id",
                    "latest_data": {"$first": "$$ROOT"}
                }
            },
            {"$replaceRoot": {"newRoot": "$latest_data"}},
            {"$sort": {"timestamp": -1}}
        ]
        
        sensor_data_list = list(sensor_data_collection.aggregate(pipeline))
        
        # Convert ObjectId
        for item in sensor_data_list:
            if "_id" in item:
                item["_id"] = str(item["_id"])
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Latest sensor data retrieved successfully",
                "data": {
                    "sensor_data": sanitize_for_json(sensor_data_list),
                    "count": len(sensor_data_list)
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


def get_sensor_statistics(
    user_data: dict,
    device_id: Optional[str] = None,
    sensor_id: Optional[str] = None,
    sensor_type: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None
):
    """
    Lấy thống kê dữ liệu sensor (min, max, avg, count)
    """
    try:
        user_id = str(user_data["_id"])
        
        query = {}
        
        # Kiểm tra quyền truy cập device
        if device_id:
            # Đảm bảo device_id là string
            device_id = str(device_id)
            link = user_room_devices_collection.find_one({"user_id": user_id, "device_id": device_id})
            if not link:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": False,
                        "message": "Device not linked to this user or not found",
                        "data": None
                    }
                )
            query["device_id"] = device_id
        else:
            linked_devices = user_room_devices_collection.find({"user_id": user_id})
            device_ids = list(set([link["device_id"] for link in linked_devices]))  # Loại bỏ duplicate
            
            if not device_ids:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": True,
                        "message": "No devices found for this user",
                        "data": {"statistics": []}
                    }
                )
            query["device_id"] = {"$in": device_ids}
        
        if sensor_id:
            query["sensor_id"] = sensor_id
        
        if sensor_type:
            query["sensor_type"] = sensor_type
        
        # Filter theo thời gian
        if start_time or end_time:
            time_query = {}
            if start_time:
                try:
                    start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                    time_query["$gte"] = start_dt
                except ValueError:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "status": False,
                            "message": "Invalid start_time format",
                            "data": None
                        }
                    )
            
            if end_time:
                try:
                    end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                    time_query["$lte"] = end_dt
                except ValueError:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "status": False,
                            "message": "Invalid end_time format",
                            "data": None
                        }
                    )
            
            if time_query:
                query["timestamp"] = time_query
        
        # Tính toán thống kê
        pipeline = [
            {"$match": query},
            {
                "$group": {
                    "_id": {
                        "sensor_id": "$sensor_id",
                        "sensor_type": "$sensor_type",
                        "device_id": "$device_id"
                    },
                    "count": {"$sum": 1},
                    "min_value": {"$min": "$value"},
                    "max_value": {"$max": "$value"},
                    "avg_value": {"$avg": "$value"},
                    "latest_timestamp": {"$max": "$timestamp"},
                    "earliest_timestamp": {"$min": "$timestamp"}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "sensor_id": "$_id.sensor_id",
                    "sensor_type": "$_id.sensor_type",
                    "device_id": "$_id.device_id",
                    "count": 1,
                    "min_value": {"$round": ["$min_value", 2]},
                    "max_value": {"$round": ["$max_value", 2]},
                    "avg_value": {"$round": ["$avg_value", 2]},
                    "latest_timestamp": 1,
                    "earliest_timestamp": 1
                }
            }
        ]
        
        statistics = list(sensor_data_collection.aggregate(pipeline))
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Sensor statistics retrieved successfully",
                "data": {
                    "statistics": sanitize_for_json(statistics),
                    "count": len(statistics)
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


def get_sensor_trends(
    user_data: dict,
    device_id: Optional[str] = None,
    room: Optional[str] = None,
    hours: int = 24,
    limit_per_type: int = 100
):
    """
    Lấy dữ liệu trends đã được format sẵn cho charts
    Trả về dữ liệu theo sensor type: temperature, humidity, energy
    
    - device_id: Nếu có, chỉ lấy dữ liệu của device này
    - room: Nếu có (và không có device_id), lấy dữ liệu của tất cả devices trong phòng
    - Nếu không có cả hai, lấy tất cả devices của user
    """
    try:
        user_id = str(user_data["_id"])
        
        # Tính thời gian bắt đầu
        start_time = get_vietnam_now_naive() - timedelta(hours=hours)
        
        # Xây dựng query filter
        query = {
            "timestamp": {"$gte": start_time}
        }
        
        # Kiểm tra quyền truy cập device
        # Ưu tiên device_id trước, sau đó mới đến room
        if device_id:
            # Chỉ lấy dữ liệu của device này
            link = user_room_devices_collection.find_one({"user_id": user_id, "device_id": device_id})
            if not link:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": False,
                        "message": "Device not linked to this user or not found",
                        "data": None
                    }
                )
            query["device_id"] = device_id
        elif room:
            # Lấy tất cả devices trong phòng này từ user_room_devices
            # Tìm room theo tên
            from utils.database import rooms_collection
            room_obj = rooms_collection.find_one({"name": room, "user_id": user_id})
            if not room_obj:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": True,
                        "message": f"Room '{room}' not found",
                        "data": {
                            "temperature": [],
                            "humidity": [],
                            "energy": []
                        }
                    }
                )
            
            # Lấy devices trong phòng từ user_room_devices
            linked_devices = user_room_devices_collection.find({
                "user_id": user_id,
                "room_id": room_obj["_id"]
            })
            device_ids_in_room = [link["device_id"] for link in linked_devices if link.get("device_id")]
            
            if not device_ids_in_room:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": True,
                        "message": f"No devices found in room: {room}",
                        "data": {
                            "temperature": [],
                            "humidity": [],
                            "energy": []
                        }
                    }
                )
            
            query["device_id"] = {"$in": device_ids_in_room}
        else:
            # Lấy tất cả devices của user
            linked_devices = user_room_devices_collection.find({"user_id": user_id})
            device_ids = list(set([link["device_id"] for link in linked_devices if link.get("device_id")]))  # Loại bỏ duplicate
            
            if not device_ids:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "status": True,
                        "message": "No devices found for this user",
                        "data": {
                            "temperature": [],
                            "humidity": [],
                            "energy": []
                        }
                    }
                )
            query["device_id"] = {"$in": device_ids}
        
        # Lấy dữ liệu sensor
        cursor = sensor_data_collection.find(query).sort("timestamp", 1)  # Sort tăng dần theo thời gian
        sensor_data_list = list(cursor)
        
        # Group và format dữ liệu theo sensor type
        temperature_data: List[Dict] = []
        humidity_data: List[Dict] = []
        energy_data: List[Dict] = []
        
        for item in sensor_data_list:
            sensor_type = (item.get("sensor_type", "") or "").lower()
            value = item.get("value", 0)
            timestamp = item.get("timestamp") or item.get("created_at")
            
            if not timestamp:
                continue
            
            # Format timestamp thành time string (HH:MM)
            if isinstance(timestamp, datetime):
                time_str = timestamp.strftime("%H:%M")
            else:
                try:
                    if isinstance(timestamp, str):
                        timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    time_str = timestamp.strftime("%H:%M")
                except:
                    continue
            
            data_point = {
                "time": time_str,
                "value": round(float(value), 2)
            }
            
            # Phân loại theo sensor type
            if "temperature" in sensor_type or "temp" in sensor_type:
                temperature_data.append(data_point)
            elif "humidity" in sensor_type or "humid" in sensor_type:
                humidity_data.append(data_point)
            elif "energy" in sensor_type or "power" in sensor_type:
                energy_data.append(data_point)
        
        # Giới hạn số lượng điểm dữ liệu cho mỗi type
        def limit_data(data_list: List[Dict], limit: int) -> List[Dict]:
            if len(data_list) <= limit:
                return data_list
            # Lấy đều các điểm dữ liệu
            step = len(data_list) // limit
            return [data_list[i] for i in range(0, len(data_list), step)][:limit]
        
        temperature_data = limit_data(temperature_data, limit_per_type)
        humidity_data = limit_data(humidity_data, limit_per_type)
        energy_data = limit_data(energy_data, limit_per_type)
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": True,
                "message": "Sensor trends retrieved successfully",
                "data": {
                    "temperature": sanitize_for_json(temperature_data),
                    "humidity": sanitize_for_json(humidity_data),
                    "energy": sanitize_for_json(energy_data),
                    "count": {
                        "temperature": len(temperature_data),
                        "humidity": len(humidity_data),
                        "energy": len(energy_data)
                    }
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

