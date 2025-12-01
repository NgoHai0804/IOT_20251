"""
MQTT Client cho HiveMQ Cloud
============================

Kết nối đến HiveMQ Cloud broker để nhận dữ liệu từ thiết bị IoT.

MQTT Topics:
-----------
- iot/device/{device_id}/data   - Nhận dữ liệu sensor từ thiết bị
- iot/device/{device_id}/status  - Nhận trạng thái thiết bị

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

2. Device Status (iot/device/{device_id}/status):
   {
     "status": "online"  // hoặc "offline"
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
from utils.database import sensor_data_collection, devices_collection, sensors_collection
from models.data_models import create_sensor_data_dict
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# HiveMQ Cloud Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER", "707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud")
MQTT_PORT = int(os.getenv("MQTT_PORT", "8883"))  # SSL port
MQTT_PORT_WS = int(os.getenv("MQTT_PORT_WS", "8884"))  # WebSocket port
MQTT_USERNAME = os.getenv("MQTT_USERNAME", None)  # Set if authentication is required
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", None)  # Set if authentication is required

# MQTT Topics - Hỗ trợ cả format cũ và format mới từ thiết bị IoT
# Format cũ: iot/device/{device_id}/data, iot/device/{device_id}/status
# Format mới: device/{device_id}/sensor/{sensor_id}/data, device/{device_id}/status
DEVICE_DATA_TOPIC_OLD = "iot/device/+/data"  # Pattern: iot/device/{device_id}/data
DEVICE_STATUS_TOPIC_OLD = "iot/device/+/status"  # Pattern: iot/device/{device_id}/status
DEVICE_DATA_TOPIC = "device/+/sensor/+/data"  # Pattern: device/{device_id}/sensor/{sensor_id}/data
DEVICE_STATUS_TOPIC = "device/+/status"  # Pattern: device/{device_id}/status


class MQTTClient:
    def __init__(self):
        self.client = None
        self.is_connected = False
        
    def on_connect(self, client, userdata, flags, rc, *args, **kwargs):
        """Callback khi kết nối MQTT broker (tương thích với cả v3.1.1 và v5)"""
        if rc == 0:
            self.is_connected = True
            logger.info("✅ Connected to MQTT broker successfully")
            
            # Subscribe to topics (cả format cũ và mới)
            result_data_old = client.subscribe(DEVICE_DATA_TOPIC_OLD, qos=1)
            result_status_old = client.subscribe(DEVICE_STATUS_TOPIC_OLD, qos=1)
            result_data = client.subscribe(DEVICE_DATA_TOPIC, qos=1)
            result_status = client.subscribe(DEVICE_STATUS_TOPIC, qos=1)
            
            if (result_data[0] == mqtt.MQTT_ERR_SUCCESS and 
                result_status[0] == mqtt.MQTT_ERR_SUCCESS and
                result_data_old[0] == mqtt.MQTT_ERR_SUCCESS and
                result_status_old[0] == mqtt.MQTT_ERR_SUCCESS):
                logger.info(f"📡 Subscribed to topics:")
                logger.info(f"   - {DEVICE_DATA_TOPIC_OLD} (QoS 1) - Format cũ")
                logger.info(f"   - {DEVICE_STATUS_TOPIC_OLD} (QoS 1) - Format cũ")
                logger.info(f"   - {DEVICE_DATA_TOPIC} (QoS 1) - Format mới")
                logger.info(f"   - {DEVICE_STATUS_TOPIC} (QoS 1) - Format mới")
            else:
                logger.warning(f"⚠️ Some subscriptions may have failed")
        else:
            error_messages = {
                1: "Incorrect protocol version",
                2: "Invalid client identifier",
                3: "Server unavailable",
                4: "Bad username or password",
                5: "Not authorized - Check username/password or permissions"
            }
            error_msg = error_messages.get(rc, f"Unknown error (code: {rc})")
            logger.error(f"❌ Failed to connect to MQTT broker. Return code: {rc}")
            logger.error(f"❌ Error: {error_msg}")
            
            if rc == 4 or rc == 5:
                logger.error("💡 HiveMQ Cloud yêu cầu username và password hợp lệ!")
                logger.error("💡 Vui lòng kiểm tra:")
                logger.error("   1. Username và password trong .env hoặc mqtt_client.py")
                logger.error("   2. Credentials từ HiveMQ Cloud Console")
                logger.error("   3. URL: https://console.hivemq.cloud/")
            
            self.is_connected = False
    
    def on_disconnect(self, client, userdata, rc, *args, **kwargs):
        """Callback khi ngắt kết nối MQTT broker (tương thích với cả v3.1.1 và v5)"""
        self.is_connected = False
        if rc != 0:
            logger.warning(f"⚠️ Unexpected disconnection from MQTT broker. Return code: {rc}")
        else:
            logger.warning("⚠️ Disconnected from MQTT broker")
    
    def on_message(self, client, userdata, msg):
        """Callback khi nhận được message từ MQTT broker"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            
            logger.info(f"📨 Received message on topic: {topic}")
            logger.debug(f"Message payload: {payload}")
            
            # Parse topic để lấy device_id và sensor_id
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
            else:
                logger.warning(f"⚠️ Unknown topic format: {topic}")
                    
        except Exception as e:
            logger.error(f"❌ Error processing MQTT message: {str(e)}")
    
    def handle_sensor_data_new_format(self, device_id: str, sensor_id: str, payload: str):
        """Xử lý dữ liệu sensor từ thiết bị IoT (format mới: device/{device_id}/sensor/{sensor_id}/data)"""
        try:
            # Parse JSON payload
            data = json.loads(payload)
            
            # Kiểm tra device có tồn tại không
            device = devices_collection.find_one({"device_id": device_id})
            if not device:
                logger.warning(f"⚠️ Device {device_id} not found in database")
                return
            
            # Cập nhật trạng thái device thành online
            devices_collection.update_one(
                {"device_id": device_id},
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
            logger.info(f"✅ Processed sensor data for device: {device_id}, sensor: {sensor_id}")
            
        except json.JSONDecodeError:
            logger.error(f"❌ Invalid JSON payload: {payload}")
        except Exception as e:
            logger.error(f"❌ Error handling sensor data: {str(e)}")
    
    def handle_sensor_data(self, device_id: str, payload: str):
        """Xử lý dữ liệu sensor từ thiết bị IoT (format cũ: iot/device/{device_id}/data)"""
        try:
            # Parse JSON payload
            data = json.loads(payload)
            
            # Kiểm tra device có tồn tại không
            device = devices_collection.find_one({"device_id": device_id})
            if not device:
                logger.warning(f"⚠️ Device {device_id} not found in database")
                return
            
            # Cập nhật trạng thái device thành online
            devices_collection.update_one(
                {"device_id": device_id},
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
                
            logger.info(f"✅ Processed sensor data for device: {device_id}")
            
        except json.JSONDecodeError:
            logger.error(f"❌ Invalid JSON payload: {payload}")
        except Exception as e:
            logger.error(f"❌ Error handling sensor data: {str(e)}")
    
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
            sensor_id = sensor_data.get("sensor_id")
            value = sensor_data.get("value")
            sensor_type = sensor_data.get("type", sensor_data.get("sensor_type", ""))
            
            if not sensor_id or value is None:
                logger.warning(f"⚠️ Missing sensor_id or value in data: {sensor_data}")
                return
            
            # Kiểm tra sensor có tồn tại không (optional)
            sensor = sensors_collection.find_one({"sensor_id": sensor_id, "device_id": device_id})
            if not sensor:
                logger.warning(f"⚠️ Sensor {sensor_id} not found, creating new sensor entry")
                # Có thể tự động tạo sensor nếu chưa có
                from models.sensor_models import create_sensor_dict
                new_sensor = create_sensor_dict(
                    name=sensor_data.get("name", f"Sensor {sensor_id}"),
                    sensor_type=sensor_type,
                    device_id=device_id,
                    note=sensor_data.get("note", "")
                )
                new_sensor["sensor_id"] = sensor_id  # Sử dụng sensor_id từ device
                sensors_collection.insert_one(new_sensor)
            
            # Tạo và lưu sensor data
            sensor_data_dict = create_sensor_data_dict(
                sensor_id=sensor_id,
                device_id=device_id,
                value=float(value),
                sensor_type=sensor_type,
                extra=sensor_data.get("extra", {}),
                note=sensor_data.get("note", "")
            )
            
            sensor_data_collection.insert_one(sensor_data_dict)
            logger.debug(f"💾 Saved sensor data: {sensor_id} = {value}")
            
        except Exception as e:
            logger.error(f"❌ Error saving sensor data: {str(e)}")
    
    def handle_device_status(self, device_id: str, payload: str):
        """Xử lý trạng thái thiết bị"""
        try:
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
            
            # Cập nhật trạng thái device
            devices_collection.update_one(
                {"device_id": device_id},
                {"$set": update_data}
            )
            
            logger.info(f"✅ Updated device {device_id} status to: {status}")
            if "battery" in data:
                logger.info(f"   Battery level: {data['battery']}%")
            
        except json.JSONDecodeError:
            logger.error(f"❌ Invalid JSON payload: {payload}")
        except Exception as e:
            logger.error(f"❌ Error handling device status: {str(e)}")
    
    def connect(self):
        """Kết nối đến MQTT broker"""
        try:
            # Tạo MQTT client (sử dụng v3.1.1 cho tương thích tốt hơn)
            self.client = mqtt.Client(
                client_id=f"iot_backend_{int(datetime.now().timestamp())}",
                protocol=mqtt.MQTTv311
            )
            
            # Set callbacks
            self.client.on_connect = self.on_connect
            self.client.on_disconnect = self.on_disconnect
            self.client.on_message = self.on_message
            
            # Set TLS/SSL (HiveMQ Cloud yêu cầu SSL)
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
                logger.error("❌ MQTT_USERNAME và MQTT_PASSWORD là BẮT BUỘC cho HiveMQ Cloud!")
                logger.error("📝 Vui lòng thêm vào file .env hoặc cập nhật trong mqtt_client.py")
                logger.error("📝 Lấy thông tin từ: https://console.hivemq.cloud/")
                logger.error("📝 Vào Cluster -> Access Management để tạo credentials")
                self.is_connected = False
                return
            
            # Set username/password
            self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
            logger.info(f"🔐 Using authentication: username={MQTT_USERNAME[:3]}***")
            
            # Kết nối
            logger.info(f"🔌 Connecting to MQTT broker: {MQTT_BROKER}:{MQTT_PORT}")
            logger.info(f"🔒 Using TLS/SSL on port {MQTT_PORT}")
            
            result = self.client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            
            if result != mqtt.MQTT_ERR_SUCCESS:
                logger.error(f"❌ Connection failed with code: {result}")
                logger.error("💡 MQTT Error Codes:")
                logger.error("   0 = Success")
                logger.error("   1 = Incorrect protocol version")
                logger.error("   2 = Invalid client identifier")
                logger.error("   3 = Server unavailable")
                logger.error("   4 = Bad username or password")
                logger.error("   5 = Not authorized")
                self.is_connected = False
                return
            
            # Start loop
            self.client.loop_start()
            
            # Đợi một chút để kết nối
            time.sleep(1)
            
            if not self.is_connected:
                logger.warning("⚠️ Connection may have failed. Check logs above for details.")
            
        except Exception as e:
            logger.error(f"❌ Error connecting to MQTT broker: {str(e)}")
            logger.error(f"❌ Error type: {type(e).__name__}")
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            self.is_connected = False
    
    def disconnect(self):
        """Ngắt kết nối MQTT broker"""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            logger.info("🔌 Disconnected from MQTT broker")
    
    def publish(self, topic: str, payload: dict, qos: int = 0):
        """Gửi message đến MQTT broker"""
        if not self.is_connected:
            logger.warning("⚠️ MQTT client not connected")
            return False
        
        try:
            result = self.client.publish(topic, json.dumps(payload), qos=qos)
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"📤 Published message to topic: {topic}")
                return True
            else:
                logger.error(f"❌ Failed to publish message: {result.rc}")
                return False
        except Exception as e:
            logger.error(f"❌ Error publishing message: {str(e)}")
            return False


# Global MQTT client instance
mqtt_client = MQTTClient()

