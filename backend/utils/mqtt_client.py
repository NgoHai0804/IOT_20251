"""
MQTT Client cho HiveMQ Cloud
============================

Kết nối đến HiveMQ Cloud broker để nhận dữ liệu từ thiết bị IoT.

MQTT Topics:
-----------
Subscribed (nhận từ thiết bị):
- iot/device/{device_id}/data   - Nhận dữ liệu sensor từ thiết bị (format cũ)
- iot/device/{device_id}/status  - Nhận trạng thái thiết bị (format cũ)
- device/{device_id}/sensor/{sensor_id}/data - Nhận dữ liệu sensor từ thiết bị (format mới)
- device/{device_id}/status - Nhận trạng thái thiết bị (format mới)

Published (gửi đến thiết bị):
- device/{device_id}/command - Gửi lệnh điều khiển đến thiết bị

Message Format:
--------------
1. Sensor Data (iot/device/{device_id}/data):
   {
     "sensor_id": "sensor_001",
     "value": 25.5,
     "type": "temperature",
     "name": "Temperature Sensor",
     "note": "Optional note",
     "extra": {}
   }
   
   Hoặc nhiều sensors:
   {
     "sensors": [
       {"sensor_id": "sensor_001", "value": 25.5, "type": "temperature"},
       {"sensor_id": "sensor_002", "value": 60.0, "type": "humidity"}
     ]
   }

2. Device Status (iot/device/{device_id}/status hoặc device/{device_id}/status):
   {
     "status": "online",  // hoặc "offline"
     "battery": 75,  // (tùy chọn) Mức pin
     "cloud_status": "on"  // (tùy chọn) Trạng thái cloud
   }

3. Command (device/{device_id}/command) - Gửi từ backend đến thiết bị:
   {
     "action": "set_cloud_status",
     "cloud_status": "on"  // hoặc "off"
   }
   
   Hoặc các command khác:
   {
     "action": "turn_on",
     "params": {}
   }

Configuration:
-------------
Có thể cấu hình qua environment variables:
- MQTT_BROKER: Địa chỉ broker (mặc định: HiveMQ Cloud)
- MQTT_PORT: Port SSL (mặc định: 8883)
- MQTT_USERNAME: Username nếu cần authentication
- MQTT_PASSWORD: Password nếu cần authentication
"""

import paho.mqtt.client as mqtt
import json
import logging
import os
import ssl
import time
import traceback
from datetime import datetime
from typing import Callable, Optional
from utils.database import sensor_data_collection, devices_collection, sensors_collection, actuators_collection, rooms_collection, notifications_collection, user_room_devices_collection
from models.device_models import create_device_dict
from models.sensor_models import create_sensor_dict
from models.actuator_models import create_actuator_dict
from models.data_models import create_sensor_data_dict
from dotenv import load_dotenv

# Tải biến môi trường
load_dotenv()

# Cấu hình logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cấu hình HiveMQ Cloud
MQTT_BROKER = os.getenv("MQTT_BROKER", "707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud")
MQTT_PORT = int(os.getenv("MQTT_PORT", "8883"))  # Cổng SSL
MQTT_PORT_WS = int(os.getenv("MQTT_PORT_WS", "8884"))  # Cổng WebSocket
MQTT_USERNAME = os.getenv("MQTT_USERNAME", None)  # Đặt nếu cần xác thực
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", None)  # Đặt nếu cần xác thực

# MQTT Topics - Hỗ trợ cả format cũ và format mới từ thiết bị IoT
# Format cũ: iot/device/{device_id}/data, iot/device/{device_id}/status
# Format mới: device/{device_id}/sensor/{sensor_id}/data, device/{device_id}/status
# Format mới chuẩn: device/{device_id}/data (gửi sensors và actuators)
DEVICE_REGISTER_TOPIC = "device/register"  # Pattern: device/register (đăng ký thiết bị)
DEVICE_DATA_TOPIC_OLD = "iot/device/+/data"  # Pattern: iot/device/{device_id}/data
DEVICE_STATUS_TOPIC_OLD = "iot/device/+/status"  # Pattern: iot/device/{device_id}/status
DEVICE_DATA_TOPIC = "device/+/sensor/+/data"  # Pattern: device/{device_id}/sensor/{sensor_id}/data
DEVICE_DATA_TOPIC_NEW = "device/+/data"  # Pattern: device/{device_id}/data (format mới chuẩn)
DEVICE_STATUS_TOPIC = "device/+/status"  # Pattern: device/{device_id}/status


class MQTTClient:
    def __init__(self):
        self.client = None
        self.is_connected = False
        
    def on_connect(self, client, userdata, flags, rc, *args, **kwargs):
        """Callback khi kết nối MQTT broker (tương thích với cả v3.1.1 và v5)"""
        if rc == 0:
            self.is_connected = True
            logger.info("Đã kết nối đến MQTT broker thành công")
            
            # Đăng ký các topics (cả format cũ và mới)
            result_register = client.subscribe(DEVICE_REGISTER_TOPIC, qos=1)
            result_data_old = client.subscribe(DEVICE_DATA_TOPIC_OLD, qos=1)
            result_status_old = client.subscribe(DEVICE_STATUS_TOPIC_OLD, qos=1)
            result_data = client.subscribe(DEVICE_DATA_TOPIC, qos=1)
            result_data_new = client.subscribe(DEVICE_DATA_TOPIC_NEW, qos=1)
            result_status = client.subscribe(DEVICE_STATUS_TOPIC, qos=1)
            
            if (result_register[0] == mqtt.MQTT_ERR_SUCCESS and
                result_data[0] == mqtt.MQTT_ERR_SUCCESS and 
                result_status[0] == mqtt.MQTT_ERR_SUCCESS and
                result_data_old[0] == mqtt.MQTT_ERR_SUCCESS and
                result_status_old[0] == mqtt.MQTT_ERR_SUCCESS and
                result_data_new[0] == mqtt.MQTT_ERR_SUCCESS):
                logger.info(f"Đã đăng ký các topics:")
                logger.info(f"   - {DEVICE_REGISTER_TOPIC} (QoS 1) - Đăng ký thiết bị")
                logger.info(f"   - {DEVICE_DATA_TOPIC_OLD} (QoS 1) - Format cũ")
                logger.info(f"   - {DEVICE_STATUS_TOPIC_OLD} (QoS 1) - Format cũ")
                logger.info(f"   - {DEVICE_DATA_TOPIC} (QoS 1) - Format mới")
                logger.info(f"   - {DEVICE_DATA_TOPIC_NEW} (QoS 1) - Format mới chuẩn")
                logger.info(f"   - {DEVICE_STATUS_TOPIC} (QoS 1) - Format mới")
            else:
                logger.warning(f"Một số đăng ký có thể đã thất bại")
        else:
            error_messages = {
                1: "Incorrect protocol version",
                2: "Invalid client identifier",
                3: "Server unavailable",
                4: "Bad username or password",
                5: "Not authorized - Check username/password or permissions"
            }
            error_msg = error_messages.get(rc, f"Lỗi không xác định (mã: {rc})")
            logger.error(f"Kết nối đến MQTT broker thất bại. Mã trả về: {rc}")
            logger.error(f"Lỗi: {error_msg}")
            
            if rc == 4 or rc == 5:
                logger.error("HiveMQ Cloud yêu cầu username và password hợp lệ!")
                logger.error("Vui lòng kiểm tra:")
                logger.error("   1. Username và password trong .env hoặc mqtt_client.py")
                logger.error("   2. Credentials từ HiveMQ Cloud Console")
                logger.error("   3. URL: https://console.hivemq.cloud/")
            
            self.is_connected = False
    
    def on_disconnect(self, client, userdata, rc, *args, **kwargs):
        """Callback khi ngắt kết nối MQTT broker (tương thích với cả v3.1.1 và v5)"""
        self.is_connected = False
        if rc != 0:
            logger.warning(f"Ngắt kết nối MQTT broker không mong muốn. Mã trả về: {rc}")
        else:
            logger.warning("Đã ngắt kết nối MQTT broker")
    
    def on_message(self, client, userdata, msg):
        """Callback khi nhận được message từ MQTT broker"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            
            logger.info(f"Đã nhận message trên topic: {topic}")
            logger.debug(f"Nội dung message: {payload}")
            
            # Phân tích topic để lấy device_id và sensor_id
            topic_parts = topic.split('/')
            
            # Format mới: device/{device_id}/sensor/{sensor_id}/data
            if len(topic_parts) >= 5 and topic_parts[0] == "device" and topic_parts[2] == "sensor" and topic_parts[4] == "data":
                device_id = topic_parts[1]
                sensor_id = topic_parts[3]
                self.handle_sensor_data_new_format(device_id, sensor_id, payload)
            
            # Format mới: device/{device_id}/status
            elif len(topic_parts) >= 3 and topic_parts[0] == "device" and topic_parts[2] == "status":
                device_id = topic_parts[1]
                self.handle_device_status(device_id, payload)
            
            # Format cũ: iot/device/{device_id}/data
            elif len(topic_parts) >= 4 and topic_parts[0] == "iot" and topic_parts[1] == "device" and topic_parts[3] == "data":
                device_id = topic_parts[2]
                self.handle_sensor_data(device_id, payload)
            
            # Format cũ: iot/device/{device_id}/status
            elif len(topic_parts) >= 4 and topic_parts[0] == "iot" and topic_parts[1] == "device" and topic_parts[3] == "status":
                device_id = topic_parts[2]
                self.handle_device_status(device_id, payload)
            
            # Format mới chuẩn: device/{device_id}/data (gửi sensors và actuators)
            elif len(topic_parts) >= 3 and topic_parts[0] == "device" and topic_parts[2] == "data":
                device_id = topic_parts[1]
                self.handle_device_data_new_format(device_id, payload)
            
            # Device register: device/register
            elif len(topic_parts) >= 2 and topic_parts[0] == "device" and topic_parts[1] == "register":
                self.handle_device_register(payload)
            else:
                logger.warning(f"Định dạng topic không xác định: {topic}")
                    
        except Exception as e:
            logger.error(f"Lỗi xử lý MQTT message: {str(e)}")
    
    def handle_sensor_data_new_format(self, device_id: str, sensor_id: str, payload: str):
        """Xử lý dữ liệu sensor từ thiết bị IoT (format mới: device/{device_id}/sensor/{sensor_id}/data)"""
        try:
            # Đảm bảo device_id và sensor_id là string
            device_id = str(device_id)
            sensor_id = str(sensor_id)
            # Phân tích JSON payload
            data = json.loads(payload)
            
            # Kiểm tra device có tồn tại không (dùng _id thay vì device_id)
            device = devices_collection.find_one({"_id": device_id})
            if not device:
                logger.warning(f"Thiết bị {device_id} không tìm thấy trong database")
                return
            
            # Cập nhật trạng thái device thành online
            devices_collection.update_one(
                {"_id": device_id},
                {"$set": {"status": "online", "updated_at": datetime.utcnow()}}
            )
            
            # Format mới: {"value": 25.5, "unit": "°C"}
            # Tạo sensor_data dict với sensor_id từ topic
            sensor_data = {
                "sensor_id": sensor_id,
                "value": data.get("value"),
                "type": self.infer_sensor_type_from_unit(data.get("unit", "")),
                "unit": data.get("unit", ""),
                "extra": {k: v for k, v in data.items() if k not in ["value", "unit"]}
            }
            
            self.save_sensor_data(device_id, sensor_data)
            logger.info(f"Đã xử lý dữ liệu sensor cho thiết bị: {device_id}, sensor: {sensor_id}")
            
        except json.JSONDecodeError:
            logger.error(f"JSON payload không hợp lệ: {payload}")
        except Exception as e:
            logger.error(f"Lỗi xử lý dữ liệu sensor: {str(e)}")
    
    def handle_sensor_data(self, device_id: str, payload: str):
        """Xử lý dữ liệu sensor từ thiết bị IoT (format cũ: iot/device/{device_id}/data)"""
        try:
            # Đảm bảo device_id là string
            device_id = str(device_id)
            # Phân tích JSON payload
            data = json.loads(payload)
            
            # Kiểm tra device có tồn tại không (dùng _id thay vì device_id)
            device = devices_collection.find_one({"_id": device_id})
            if not device:
                logger.warning(f"Thiết bị {device_id} không tìm thấy trong database")
                return
            
            # Cập nhật trạng thái device thành online
            devices_collection.update_one(
                {"_id": device_id},
                {"$set": {"status": "online", "updated_at": datetime.utcnow()}}
            )
            
            # Xử lý dữ liệu sensor
            # Format payload có thể là:
            # {"sensor_id": "xxx", "value": 25.5, "type": "temperature"}
            # hoặc
            # {"sensors": [{"sensor_id": "xxx", "value": 25.5, "type": "temperature"}, ...]}
            
            if "sensors" in data:
                # Nhiều sensors trong một message
                for sensor_data in data["sensors"]:
                    self.save_sensor_data(device_id, sensor_data)
            else:
                # Một sensor trong message
                self.save_sensor_data(device_id, data)
                
            logger.info(f"Đã xử lý dữ liệu sensor cho thiết bị: {device_id}")
            
        except json.JSONDecodeError:
            logger.error(f"JSON payload không hợp lệ: {payload}")
        except Exception as e:
            logger.error(f"Lỗi xử lý dữ liệu sensor: {str(e)}")
    
    def infer_sensor_type_from_unit(self, unit: str) -> str:
        """Suy luận sensor type từ unit"""
        unit_lower = unit.lower()
        if '°c' in unit_lower or '°f' in unit_lower or 'celsius' in unit_lower or 'fahrenheit' in unit_lower:
            return "temperature"
        elif '%' in unit_lower or 'percent' in unit_lower:
            return "humidity"
        elif 'w' in unit_lower or 'watts' in unit_lower or 'kw' in unit_lower:
            return "energy"
        elif 'lux' in unit_lower or 'lm' in unit_lower:
            return "light"
        elif 'motion' in unit_lower or 'detection' in unit_lower:
            return "motion"
        else:
            return "temperature"  # default
    
    def save_sensor_data(self, device_id: str, sensor_data: dict):
        """Lưu dữ liệu sensor vào database"""
        try:
            # Đảm bảo device_id là string
            device_id = str(device_id)
            sensor_id = sensor_data.get("sensor_id")
            value = sensor_data.get("value")
            sensor_type = sensor_data.get("type", sensor_data.get("sensor_type", ""))
            
            if not sensor_id or value is None:
                logger.warning(f"Thiếu sensor_id hoặc value trong dữ liệu: {sensor_data}")
                return
            
            # Đảm bảo sensor_id là string
            sensor_id = str(sensor_id)
            # Kiểm tra sensor có tồn tại không (tùy chọn) - dùng _id thay vì sensor_id
            sensor = sensors_collection.find_one({"_id": sensor_id, "device_id": device_id})
            if not sensor:
                logger.warning(f"Sensor {sensor_id} không tìm thấy, đang tạo sensor mới")
                # Tạo sensor mới trực tiếp với sensor_id từ device làm _id
                from models.sensor_models import get_default_thresholds
                new_sensor = {
                    "_id": str(sensor_id),  # Sử dụng sensor_id từ device làm _id
                    "device_id": str(device_id),
                    "type": sensor_type,
                    "name": sensor_data.get("name", f"Sensor {sensor_id}"),
                    "unit": sensor_data.get("unit", ""),
                    "pin": sensor_data.get("pin", 0),
                    "enabled": True,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                # Tự động set ngưỡng mặc định
                default_min, default_max = get_default_thresholds(sensor_type)
                if default_min is not None:
                    new_sensor["min_threshold"] = default_min
                if default_max is not None:
                    new_sensor["max_threshold"] = default_max
                sensors_collection.insert_one(new_sensor)
                logger.info(f"Đã tạo sensor: {sensor_id} với ngưỡng mặc định")
            else:
                # Cập nhật ngưỡng mặc định nếu sensor đã tồn tại nhưng chưa có ngưỡng
                from models.sensor_models import get_default_thresholds
                needs_update = False
                update_data = {}
                
                if "min_threshold" not in sensor and "max_threshold" not in sensor:
                    default_min, default_max = get_default_thresholds(sensor_type)
                    if default_min is not None:
                        update_data["min_threshold"] = default_min
                        needs_update = True
                    if default_max is not None:
                        update_data["max_threshold"] = default_max
                        needs_update = True
                    
                    if needs_update:
                        update_data["updated_at"] = datetime.utcnow()
                        sensors_collection.update_one(
                            {"_id": sensor_id, "device_id": device_id},
                            {"$set": update_data}
                        )
                        logger.info(f"Đã cập nhật sensor {sensor_id} với ngưỡng mặc định: min={update_data.get('min_threshold')}, max={update_data.get('max_threshold')}")
            
            # Kiểm tra ngưỡng và tạo notification nếu vượt quá
            sensor_value = float(value)
            min_threshold = sensor.get("min_threshold")
            max_threshold = sensor.get("max_threshold")
            
            # Kiểm tra vượt ngưỡng
            is_over_threshold = False
            threshold_message = ""
            
            if min_threshold is not None and sensor_value < min_threshold:
                is_over_threshold = True
                threshold_message = f"Giá trị {sensor_value:.1f}{sensor.get('unit', '')} thấp hơn ngưỡng dưới {min_threshold}{sensor.get('unit', '')}"
            elif max_threshold is not None and sensor_value > max_threshold:
                is_over_threshold = True
                threshold_message = f"Giá trị {sensor_value:.1f}{sensor.get('unit', '')} vượt quá ngưỡng trên {max_threshold}{sensor.get('unit', '')}"
            
            # Tạo notification cho tất cả users quản lý device này (chỉ tạo nếu chưa có notification gần đây)
            if is_over_threshold:
                from models.notification_models import create_notification_dict
                from datetime import timedelta
                
                # Lấy tất cả users quản lý device này
                user_links = list(user_room_devices_collection.find({"device_id": device_id}))
                user_ids = list(set([link["user_id"] for link in user_links]))
                
                sensor_name = sensor.get("name", f"Sensor {sensor_id}")
                notification_message = f"{sensor_name}: {threshold_message}"
                
                # Thời gian tối thiểu giữa các notification (5 phút)
                notification_cooldown_minutes = 5
                cooldown_time = datetime.utcnow() - timedelta(minutes=notification_cooldown_minutes)
                
                for user_id in user_ids:
                    # Kiểm tra xem đã có notification chưa đọc cho sensor này trong khoảng thời gian gần đây chưa
                    existing_notification = notifications_collection.find_one({
                        "user_id": user_id,
                        "sensor_id": sensor_id,
                        "read": False,
                        "type": "warning",
                        "created_at": {"$gte": cooldown_time}
                    })
                    
                    if not existing_notification:
                        # Chưa có notification gần đây, tạo mới
                        notification = create_notification_dict(
                            user_id=user_id,
                            sensor_id=sensor_id,
                            type_="warning",
                            message=notification_message,
                            note=f"Device: {device_id}",
                            read=False
                        )
                        notifications_collection.insert_one(notification)
                        logger.warning(f"Đã tạo cảnh báo ngưỡng cho user {user_id}: {notification_message}")
                    else:
                        # Đã có notification gần đây, bỏ qua để tránh spam
                        logger.debug(f"Bỏ qua notification cho user {user_id}, sensor {sensor_id} - đã có notification trong khoảng thời gian cooldown")
            
            # Tạo và lưu sensor data
            from models.data_models import create_sensor_data_dict
            sensor_data_dict = create_sensor_data_dict(
                sensor_id=sensor_id,
                value=sensor_value,
                device_id=device_id  # Thêm device_id để query dễ dàng
            )
            
            sensor_data_collection.insert_one(sensor_data_dict)
            logger.debug(f"Đã lưu dữ liệu sensor: {sensor_id} = {value}")
            
        except Exception as e:
            logger.error(f"Lỗi lưu dữ liệu sensor: {str(e)}")
    
    def handle_device_data_new_format(self, device_id: str, payload: str):
        """
        Xử lý dữ liệu từ ESP32 (format mới chuẩn)
        Format: {
          "device_id": "device_01",
          "sensors": [
            { "sensor_id": "sensor_01", "value": 30 },
            { "sensor_id": "sensor_02", "value": 65 }
          ],
          "actuators": [
            { "actuator_id": "act_01", "state": true }
          ]
        }
        """
        try:
            # Đảm bảo device_id là string
            device_id = str(device_id)
            data = json.loads(payload)
            
            # Kiểm tra device có tồn tại không (dùng _id thay vì device_id)
            device = devices_collection.find_one({"_id": device_id})
            if not device:
                logger.warning(f"Thiết bị {device_id} không tìm thấy trong database")
                return
            
            # Cập nhật trạng thái device thành online
            devices_collection.update_one(
                {"_id": device_id},
                {"$set": {"status": "online", "updated_at": datetime.utcnow()}}
            )
            
            # Xử lý sensors
            if "sensors" in data and isinstance(data["sensors"], list):
                for sensor_data_item in data["sensors"]:
                    sensor_id = sensor_data_item.get("sensor_id")
                    value = sensor_data_item.get("value")
                    
                    if sensor_id and value is not None:
                        # Đảm bảo sensor_id là string
                        sensor_id = str(sensor_id)
                        sensor_value = float(value)
                        
                        # Lấy thông tin sensor để kiểm tra ngưỡng
                        sensor = sensors_collection.find_one({"_id": sensor_id, "device_id": device_id})
                        
                        # Nếu sensor chưa tồn tại, tự động tạo sensor mới
                        if not sensor:
                            logger.info(f"⚠️ Sensor {sensor_id} chưa tồn tại, đang tự động tạo sensor mới cho device {device_id}")
                            from models.sensor_models import get_default_thresholds
                            # Tự động xác định loại sensor từ tên hoặc giá trị
                            sensor_type = sensor_data_item.get("type", "temperature")  # Mặc định là temperature
                            if "humidity" in sensor_id.lower() or "do_am" in sensor_id.lower() or "_02" in sensor_id:
                                sensor_type = "humidity"
                            elif "gas" in sensor_id.lower() or "khi" in sensor_id.lower() or "_03" in sensor_id:
                                sensor_type = "gas"
                            elif "light" in sensor_id.lower() or "anh_sang" in sensor_id.lower():
                                sensor_type = "light"
                            elif "motion" in sensor_id.lower() or "chuyen_dong" in sensor_id.lower():
                                sensor_type = "motion"
                            
                            # Tạo sensor mới
                            new_sensor = {
                                "_id": str(sensor_id),
                                "device_id": str(device_id),
                                "type": sensor_type,
                                "name": sensor_data_item.get("name", f"Sensor {sensor_id}"),
                                "unit": sensor_data_item.get("unit", ""),
                                "pin": sensor_data_item.get("pin", 0),
                                "enabled": True,
                                "created_at": datetime.utcnow(),
                                "updated_at": datetime.utcnow()
                            }
                            # Tự động set ngưỡng mặc định
                            default_min, default_max = get_default_thresholds(sensor_type)
                            if default_min is not None:
                                new_sensor["min_threshold"] = default_min
                            if default_max is not None:
                                new_sensor["max_threshold"] = default_max
                            try:
                                sensors_collection.insert_one(new_sensor)
                                sensor = new_sensor
                                logger.info(f"✅ Đã tự động tạo sensor: {sensor_id} (type: {sensor_type}) với ngưỡng mặc định")
                            except Exception as e:
                                logger.error(f"❌ Lỗi tạo sensor {sensor_id}: {str(e)}")
                                # Vẫn tiếp tục lưu dữ liệu dù không tạo được sensor
                                sensor = None
                        
                        # Kiểm tra ngưỡng và tạo notification nếu vượt quá (chỉ khi sensor tồn tại)
                        if sensor:
                            min_threshold = sensor.get("min_threshold")
                            max_threshold = sensor.get("max_threshold")
                            
                            # Kiểm tra vượt ngưỡng
                            is_over_threshold = False
                            threshold_message = ""
                            
                            if min_threshold is not None and sensor_value < min_threshold:
                                is_over_threshold = True
                                threshold_message = f"Giá trị {sensor_value:.1f}{sensor.get('unit', '')} thấp hơn ngưỡng dưới {min_threshold}{sensor.get('unit', '')}"
                            elif max_threshold is not None and sensor_value > max_threshold:
                                is_over_threshold = True
                                threshold_message = f"Giá trị {sensor_value:.1f}{sensor.get('unit', '')} vượt quá ngưỡng trên {max_threshold}{sensor.get('unit', '')}"
                            
                            # Tạo notification cho tất cả users quản lý device này (chỉ tạo nếu chưa có notification gần đây)
                            if is_over_threshold:
                                from models.notification_models import create_notification_dict
                                from datetime import timedelta
                                
                                # Lấy tất cả users quản lý device này
                                user_links = list(user_room_devices_collection.find({"device_id": device_id}))
                                user_ids = list(set([link["user_id"] for link in user_links]))
                                
                                sensor_name = sensor.get("name", f"Sensor {sensor_id}")
                                notification_message = f"{sensor_name}: {threshold_message}"
                                
                                # Thời gian tối thiểu giữa các notification (5 phút)
                                notification_cooldown_minutes = 5
                                cooldown_time = datetime.utcnow() - timedelta(minutes=notification_cooldown_minutes)
                                
                                for user_id in user_ids:
                                    # Kiểm tra xem đã có notification chưa đọc cho sensor này trong khoảng thời gian gần đây chưa
                                    existing_notification = notifications_collection.find_one({
                                        "user_id": user_id,
                                        "sensor_id": sensor_id,
                                        "read": False,
                                        "type": "warning",
                                        "created_at": {"$gte": cooldown_time}
                                    })
                                    
                                    if not existing_notification:
                                        # Chưa có notification gần đây, tạo mới
                                        notification = create_notification_dict(
                                            user_id=user_id,
                                            sensor_id=sensor_id,
                                            type_="warning",
                                            message=notification_message,
                                            note=f"Device: {device_id}",
                                            read=False
                                        )
                                        notifications_collection.insert_one(notification)
                                        logger.warning(f"Đã tạo cảnh báo ngưỡng cho user {user_id}: {notification_message}")
                                    else:
                                        # Đã có notification gần đây, bỏ qua để tránh spam
                                        logger.debug(f"Bỏ qua notification cho user {user_id}, sensor {sensor_id} - đã có notification trong khoảng thời gian cooldown")
                        
                        # Lưu sensor data (luôn lưu, không phụ thuộc vào việc sensor có tồn tại hay không)
                        try:
                            from models.data_models import create_sensor_data_dict
                            sensor_data_dict = create_sensor_data_dict(sensor_id, sensor_value, device_id=device_id)
                            sensor_data_collection.insert_one(sensor_data_dict)
                            logger.info(f"✅ Đã lưu dữ liệu sensor: {sensor_id} = {sensor_value} vào database")
                        except Exception as e:
                            logger.error(f"❌ Lỗi lưu dữ liệu sensor {sensor_id}: {str(e)}")
                            logger.error(traceback.format_exc())
            
            # Xử lý actuators (cập nhật state)
            if "actuators" in data and isinstance(data["actuators"], list):
                for actuator_data in data["actuators"]:
                    actuator_id = actuator_data.get("actuator_id")
                    state = actuator_data.get("state")
                    
                    if actuator_id is not None and state is not None:
                        # Đảm bảo actuator_id là string
                        actuator_id = str(actuator_id)
                        
                        # Kiểm tra actuator có tồn tại không
                        actuator = actuators_collection.find_one({"_id": actuator_id, "device_id": device_id})
                        
                        # Nếu actuator chưa tồn tại, tự động tạo actuator mới
                        if not actuator:
                            logger.info(f"⚠️ Actuator {actuator_id} chưa tồn tại, đang tự động tạo actuator mới cho device {device_id}")
                            # Tự động xác định loại actuator từ tên hoặc mặc định là relay
                            actuator_type = actuator_data.get("type", "relay")  # Mặc định là relay
                            if "motor" in actuator_id.lower() or "dong_co" in actuator_id.lower():
                                actuator_type = "motor"
                            elif "led" in actuator_id.lower():
                                actuator_type = "led"
                            elif "fan" in actuator_id.lower() or "quat" in actuator_id.lower():
                                actuator_type = "fan"
                            
                            # Tạo actuator mới
                            new_actuator = {
                                "_id": str(actuator_id),
                                "device_id": str(device_id),
                                "type": actuator_type,
                                "name": actuator_data.get("name", f"Actuator {actuator_id}"),
                                "pin": actuator_data.get("pin", 0),
                                "state": bool(state),
                                "enabled": True,
                                "created_at": datetime.utcnow(),
                                "updated_at": datetime.utcnow()
                            }
                            try:
                                actuators_collection.insert_one(new_actuator)
                                actuator = new_actuator
                                logger.info(f"✅ Đã tự động tạo actuator: {actuator_id} (type: {actuator_type}) với state: {state}")
                            except Exception as e:
                                logger.error(f"❌ Lỗi tạo actuator {actuator_id}: {str(e)}")
                                logger.error(traceback.format_exc())
                                # Vẫn tiếp tục cập nhật state dù không tạo được actuator
                                actuator = None
                        
                        # Cập nhật state của actuator
                        try:
                            result = actuators_collection.update_one(
                                {"_id": actuator_id, "device_id": device_id},
                                {"$set": {"state": bool(state), "updated_at": datetime.utcnow()}}
                            )
                            if result.modified_count > 0:
                                logger.info(f"✅ Đã cập nhật trạng thái actuator: {actuator_id} = {state}")
                            else:
                                logger.debug(f"Actuator {actuator_id} state không thay đổi hoặc không tìm thấy")
                        except Exception as e:
                            logger.error(f"❌ Lỗi cập nhật actuator {actuator_id}: {str(e)}")
                            logger.error(traceback.format_exc())
            
            logger.info(f"Đã xử lý dữ liệu thiết bị cho device: {device_id}")
            
        except json.JSONDecodeError:
            logger.error(f"JSON payload không hợp lệ: {payload}")
        except Exception as e:
            logger.error(f"Lỗi xử lý dữ liệu thiết bị: {str(e)}")
    
    def handle_device_status(self, device_id: str, payload: str):
        """Xử lý trạng thái thiết bị"""
        try:
            # Đảm bảo device_id là string
            device_id = str(device_id)
            data = json.loads(payload)
            status = data.get("status", "offline")
            
            # Format mới có thể có thêm battery, etc.
            # Format: {"status": "online", "battery": 75}
            update_data = {
                "status": status,
                "updated_at": datetime.utcnow()
            }
            
            # Thêm battery nếu có
            if "battery" in data:
                update_data["battery"] = data["battery"]
            
            # Cập nhật trạng thái device (dùng _id thay vì device_id)
            devices_collection.update_one(
                {"_id": device_id},
                {"$set": update_data}
            )
            
            logger.info(f"Đã cập nhật trạng thái thiết bị {device_id} thành: {status}")
            if "battery" in data:
                logger.info(f"   Mức pin: {data['battery']}%")
            
        except json.JSONDecodeError:
            logger.error(f"JSON payload không hợp lệ: {payload}")
        except Exception as e:
            logger.error(f"Lỗi xử lý trạng thái thiết bị: {str(e)}")
    
    def connect(self):
        """Kết nối đến MQTT broker"""
        try:
            # Tạo MQTT client (sử dụng v3.1.1 cho tương thích tốt hơn)
            self.client = mqtt.Client(
                client_id=f"iot_backend_{int(datetime.now().timestamp())}",
                protocol=mqtt.MQTTv311
            )
            
            # Thiết lập callbacks
            self.client.on_connect = self.on_connect
            self.client.on_disconnect = self.on_disconnect
            self.client.on_message = self.on_message
            
            # Thiết lập TLS/SSL (HiveMQ Cloud yêu cầu SSL)
            # Sử dụng tls_insecure_set(True) để không verify certificate (cho development)
            # Trong production nên verify certificate
            self.client.tls_set(
                ca_certs=None,
                certfile=None,
                keyfile=None,
                cert_reqs=ssl.CERT_NONE,  # Không verify certificate (cho HiveMQ Cloud free tier)
                tls_version=ssl.PROTOCOL_TLS,
                ciphers=None
            )
            self.client.tls_insecure_set(True)  # Cho phép kết nối mà không verify hostname
            
            # HiveMQ Cloud YÊU CẦU username và password
            if not MQTT_USERNAME or not MQTT_PASSWORD:
                logger.error("MQTT_USERNAME và MQTT_PASSWORD là BẮT BUỘC cho HiveMQ Cloud!")
                logger.error("Vui lòng thêm vào file .env hoặc cập nhật trong mqtt_client.py")
                logger.error("Lấy thông tin từ: https://console.hivemq.cloud/")
                logger.error("Vào Cluster -> Access Management để tạo credentials")
                self.is_connected = False
                return
            
            # Thiết lập username/password
            self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
            logger.info(f"Đang sử dụng xác thực: username={MQTT_USERNAME[:3]}***")
            
            # Kết nối
            logger.info(f"Đang kết nối đến MQTT broker: {MQTT_BROKER}:{MQTT_PORT}")
            logger.info(f"Đang sử dụng TLS/SSL trên cổng {MQTT_PORT}")
            
            result = self.client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            
            if result != mqtt.MQTT_ERR_SUCCESS:
                logger.error(f"Kết nối thất bại với mã: {result}")
                logger.error("Mã lỗi MQTT:")
                logger.error("   0 = Thành công")
                logger.error("   1 = Phiên bản protocol không đúng")
                logger.error("   2 = Client identifier không hợp lệ")
                logger.error("   3 = Server không khả dụng")
                logger.error("   4 = Username hoặc password sai")
                logger.error("   5 = Không được phép")
                self.is_connected = False
                return
            
            # Bắt đầu loop
            self.client.loop_start()
            
            # Đợi một chút để kết nối
            time.sleep(1)
            
            if not self.is_connected:
                logger.warning("Kết nối có thể đã thất bại. Kiểm tra log ở trên để biết chi tiết.")
            
        except Exception as e:
            logger.error(f"Lỗi kết nối đến MQTT broker: {str(e)}")
            logger.error(f"Loại lỗi: {type(e).__name__}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            self.is_connected = False
    
    def disconnect(self):
        """Ngắt kết nối MQTT broker"""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            logger.info("Đã ngắt kết nối MQTT broker")
    
    def publish(self, topic: str, payload: dict, qos: int = 0):
        """Gửi message đến MQTT broker"""
        if not self.is_connected:
            logger.warning("MQTT client chưa kết nối")
            return False
        
        try:
            result = self.client.publish(topic, json.dumps(payload), qos=qos)
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"Đã gửi message đến topic: {topic}")
                return True
            else:
                logger.error(f"Gửi message thất bại: {result.rc}")
                return False
        except Exception as e:
            logger.error(f"Lỗi gửi message: {str(e)}")
            return False
    
    def handle_device_register(self, payload: str):
        """
        Xử lý đăng ký thiết bị từ ESP32
        Topic: device/register
        
        Format:
        {
          "device_id": "device_01",  // hoặc để trống để server tự tạo
          "name": "ESP32 Phòng Khách",
          "type": "esp32",
          "room_name": "Phòng khách",  // tên phòng (sẽ tạo nếu chưa có)
          "ip": "192.168.1.20",
          "sensors": [
            {"sensor_id": "sensor_01", "type": "temperature", "name": "Nhiệt độ", "unit": "°C", "pin": 4},
            {"sensor_id": "sensor_02", "type": "humidity", "name": "Độ ẩm", "unit": "%", "pin": 5}
          ],
          "actuators": [
            {"actuator_id": "act_01", "type": "relay", "name": "Đèn trần", "pin": 23},
            {"actuator_id": "act_02", "type": "relay", "name": "Quạt", "pin": 22}
          ]
        }
        """
        try:
            data = json.loads(payload)
            logger.info(f"Yêu cầu đăng ký thiết bị: {data}")
            
            # KHÔNG tự động tạo phòng - device mặc định không thuộc phòng nào
            # Device sẽ được thêm vào phòng sau khi user quản lý
            
            # Kiểm tra device đã tồn tại chưa
            device_id = data.get("device_id")
            if device_id:
                # Đảm bảo device_id là string khi tìm kiếm
                device_id = str(device_id)
                existing_device = devices_collection.find_one({"_id": device_id})
                if existing_device:
                    logger.info(f"Thiết bị {device_id} đã tồn tại, đang cập nhật...")
                    # Cập nhật thông tin device (KHÔNG cập nhật room_id)
                    update_data = {
                        "name": data.get("name", existing_device.get("name")),
                        "type": data.get("type", existing_device.get("type")),
                        "ip": data.get("ip", existing_device.get("ip", "")),
                        "status": "online",
                        "updated_at": datetime.utcnow()
                    }
                    devices_collection.update_one({"_id": device_id}, {"$set": update_data})
                else:
                    # Tạo device mới với device_id được chỉ định (KHÔNG có room_id và user_id)
                    device = create_device_dict(
                        name=data.get("name", "Unnamed Device"),
                        room_id=None,  # Không thuộc phòng nào
                        device_type=data.get("type", "esp32"),
                        ip=data.get("ip", ""),
                        status="online",
                        enabled=True
                    )
                    # Đảm bảo _id là string
                    device["_id"] = str(device_id)
                    devices_collection.insert_one(device)
                    logger.info(f"Đã tạo thiết bị mới: {device_id} (không gán phòng, không có user_id)")
            else:
                # Tạo device mới (server tự tạo device_id) - KHÔNG có room_id và user_id
                device = create_device_dict(
                    name=data.get("name", "Unnamed Device"),
                    room_id=None,  # Không thuộc phòng nào
                    device_type=data.get("type", "esp32"),
                    ip=data.get("ip", ""),
                    status="online",
                    enabled=True
                )
                devices_collection.insert_one(device)
                # Đảm bảo device_id là string
                device_id = str(device["_id"])
                logger.info(f"Đã tạo thiết bị mới: {device_id} (không gán phòng, không có user_id)")
            
            # Xử lý sensors
            sensors_data = data.get("sensors", [])
            for sensor_info in sensors_data:
                sensor_id = sensor_info.get("sensor_id")
                if not sensor_id:
                    continue
                
                existing_sensor = sensors_collection.find_one({"_id": sensor_id, "device_id": device_id})
                if not existing_sensor:
                    # Tạo sensor mới trực tiếp với sensor_id từ device làm _id
                    from models.sensor_models import get_default_thresholds, get_default_unit, get_default_name
                    
                    # Lấy type từ device (bắt buộc)
                    sensor_type = sensor_info.get("type", "temperature")
                    
                    # Tự động set unit và name dựa trên type nếu device không gửi
                    sensor_unit = sensor_info.get("unit") or get_default_unit(sensor_type)
                    sensor_name = sensor_info.get("name") or get_default_name(sensor_type)
                    
                    sensor = {
                        "_id": str(sensor_id),  # Sử dụng sensor_id từ device làm _id
                        "device_id": str(device_id),
                        "type": sensor_type,
                        "name": sensor_name,
                        "unit": sensor_unit,
                        "pin": sensor_info.get("pin", 0),
                        "enabled": True,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                    # Tự động set ngưỡng mặc định dựa trên type
                    default_min, default_max = get_default_thresholds(sensor_type)
                    if default_min is not None:
                        sensor["min_threshold"] = default_min
                    if default_max is not None:
                        sensor["max_threshold"] = default_max
                    sensors_collection.insert_one(sensor)
                    logger.info(f"Đã tạo sensor: {sensor_id} (type: {sensor_type}, unit: {sensor_unit}) với ngưỡng mặc định")
                else:
                    # Cập nhật ngưỡng mặc định và unit nếu sensor đã tồn tại nhưng chưa có
                    from models.sensor_models import get_default_thresholds, get_default_unit, get_default_name
                    sensor_type = existing_sensor.get("type", sensor_info.get("type", "temperature"))
                    needs_update = False
                    update_data = {}
                    
                    # Cập nhật unit nếu chưa có hoặc rỗng
                    if not existing_sensor.get("unit") or existing_sensor.get("unit") == "":
                        default_unit = get_default_unit(sensor_type)
                        if default_unit:
                            update_data["unit"] = default_unit
                            needs_update = True
                    
                    # Cập nhật name nếu chưa có hoặc rỗng
                    if not existing_sensor.get("name") or existing_sensor.get("name") == "":
                        default_name = get_default_name(sensor_type)
                        if default_name:
                            update_data["name"] = default_name
                            needs_update = True
                    
                    # Cập nhật ngưỡng mặc định nếu chưa có
                    if "min_threshold" not in existing_sensor and "max_threshold" not in existing_sensor:
                        default_min, default_max = get_default_thresholds(sensor_type)
                        if default_min is not None:
                            update_data["min_threshold"] = default_min
                            needs_update = True
                        if default_max is not None:
                            update_data["max_threshold"] = default_max
                            needs_update = True
                        
                        if needs_update:
                            update_data["updated_at"] = datetime.utcnow()
                            sensors_collection.update_one(
                                {"_id": sensor_id, "device_id": device_id},
                                {"$set": update_data}
                            )
                            logger.info(f"Đã cập nhật sensor {sensor_id} với unit={update_data.get('unit')}, name={update_data.get('name')}, ngưỡng: min={update_data.get('min_threshold')}, max={update_data.get('max_threshold')}")
            
            # Xử lý actuators
            actuators_data = data.get("actuators", [])
            for actuator_info in actuators_data:
                actuator_id = actuator_info.get("actuator_id")
                if not actuator_id:
                    continue
                
                # Đảm bảo actuator_id là string
                actuator_id = str(actuator_id)
                existing_actuator = actuators_collection.find_one({"_id": actuator_id, "device_id": device_id})
                if not existing_actuator:
                    actuator = create_actuator_dict(
                        device_id=device_id,
                        actuator_type=actuator_info.get("type", "relay"),
                        name=actuator_info.get("name", f"Actuator {actuator_id}"),
                        pin=actuator_info.get("pin", 0),
                        state=False,
                        enabled=True
                    )
                    # Đảm bảo _id là string
                    actuator["_id"] = str(actuator_id)
                    actuators_collection.insert_one(actuator)
                    logger.info(f"Đã tạo actuator: {actuator_id}")
            
            # Gửi response về device
            # Đảm bảo device_id là string trong response
            response_topic = f"device/{device_id}/register/response"
            response = {
                "status": "success",
                "device_id": str(device_id),
                "message": "Device registered successfully"
            }
            self.publish(response_topic, response, qos=1)
            logger.info(f"Thiết bị {device_id} đã đăng ký thành công, đã gửi response đến {response_topic}")
            
        except json.JSONDecodeError:
            logger.error(f"JSON payload không hợp lệ trong register: {payload}")
        except Exception as e:
            logger.error(f"Lỗi xử lý đăng ký thiết bị: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
    
    def publish_command(self, device_id: str, command: dict, qos: int = 1):
        """
        Gửi command đến thiết bị IoT qua MQTT
        Topic: device/{device_id}/command
        
        Args:
            device_id: ID của thiết bị IoT
            command: Dictionary chứa command (ví dụ: {"action": "set_cloud_status", "cloud_status": "on"})
            qos: Quality of Service (mặc định: 1 - đảm bảo message được gửi ít nhất 1 lần)
        
        Returns:
            bool: True nếu gửi thành công, False nếu thất bại
        """
        topic = f"device/{device_id}/command"
        logger.info(f"Đang gửi command đến thiết bị {device_id}: {command}")
        return self.publish(topic, command, qos=qos)


# Global MQTT client instance
mqtt_client = MQTTClient()

