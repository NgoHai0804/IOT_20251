import paho.mqtt.client as mqtt
import json
import logging
import os
import ssl
import time
import traceback
from datetime import datetime, timedelta
from typing import Callable, Optional
from utils.database import sensor_data_collection, devices_collection, sensors_collection, actuators_collection, rooms_collection, notifications_collection, user_room_devices_collection
from models.device_models import create_device_dict
from models.sensor_models import create_sensor_dict
from models.actuator_models import create_actuator_dict
from models.data_models import create_sensor_data_dict
from utils.timezone import get_vietnam_now_naive
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MQTT_BROKER = os.getenv("MQTT_BROKER", "707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud")
MQTT_PORT = int(os.getenv("MQTT_PORT", "8883"))
MQTT_PORT_WS = int(os.getenv("MQTT_PORT_WS", "8884"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", None)
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", None)

DEVICE_REGISTER_TOPIC = "device/register"
DEVICE_DATA_TOPIC_OLD = "iot/device/+/data"
DEVICE_DATA_TOPIC = "device/+/sensor/+/data"
DEVICE_DATA_TOPIC_NEW = "device/+/data"
DEVICE_LWT_TOPIC = "device/+/lwt"


class MQTTClient:
    def __init__(self):
        self.client = None
        self.is_connected = False
    
    def update_device_online_status(self, device_id: str):
        """Cập nhật trạng thái device thành online và last_seen timestamp"""
        try:
            device_id = str(device_id)
            now = get_vietnam_now_naive()
            result = devices_collection.update_one(
                {"_id": device_id},
                {"$set": {
                    "status": "online",
                    "last_seen": now,
                    "updated_at": now
                }}
            )
            if result.modified_count > 0:
                pass
        except Exception as e:
            logger.error(f"Lỗi cập nhật trạng thái online cho device {device_id}: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
        
    def on_connect(self, client, userdata, flags, rc, *args, **kwargs):
        """Callback khi kết nối MQTT broker (tương thích với cả v3.1.1 và v5)"""
        if rc == 0:
            self.is_connected = True
            logger.info("Đã kết nối đến MQTT broker thành công")
            
            result_register = client.subscribe(DEVICE_REGISTER_TOPIC, qos=1)
            result_data_old = client.subscribe(DEVICE_DATA_TOPIC_OLD, qos=1)
            result_data = client.subscribe(DEVICE_DATA_TOPIC, qos=1)
            result_data_new = client.subscribe(DEVICE_DATA_TOPIC_NEW, qos=1)
            result_lwt = client.subscribe(DEVICE_LWT_TOPIC, qos=1)
            
            if (result_register[0] == mqtt.MQTT_ERR_SUCCESS and
                result_data[0] == mqtt.MQTT_ERR_SUCCESS and
                result_data_old[0] == mqtt.MQTT_ERR_SUCCESS and
                result_data_new[0] == mqtt.MQTT_ERR_SUCCESS and
                result_lwt[0] == mqtt.MQTT_ERR_SUCCESS):
                pass
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
            
            topic_parts = topic.split('/')
            
            if len(topic_parts) >= 5 and topic_parts[0] == "device" and topic_parts[2] == "sensor" and topic_parts[4] == "data":
                device_id = topic_parts[1]
                sensor_id = topic_parts[3]
                self.handle_sensor_data_new_format(device_id, sensor_id, payload)
            
            elif len(topic_parts) >= 3 and topic_parts[0] == "device" and topic_parts[2] == "lwt":
                device_id = topic_parts[1]
                self.handle_device_lwt(device_id, payload)
            
            elif len(topic_parts) >= 4 and topic_parts[0] == "iot" and topic_parts[1] == "device" and topic_parts[3] == "data":
                device_id = topic_parts[2]
                self.handle_sensor_data(device_id, payload)
            
            elif len(topic_parts) >= 3 and topic_parts[0] == "device" and topic_parts[2] == "data":
                device_id = topic_parts[1]
                self.handle_device_data_new_format(device_id, payload)
            
            elif len(topic_parts) >= 2 and topic_parts[0] == "device" and topic_parts[1] == "register":
                self.handle_device_register(payload)
            else:
                logger.warning(f"Định dạng topic không xác định: {topic}")
                    
        except Exception as e:
            logger.error(f"Lỗi xử lý MQTT message: {str(e)}")
    
    def handle_sensor_data_new_format(self, device_id: str, sensor_id: str, payload: str):
        """Xử lý dữ liệu sensor từ thiết bị IoT (format mới: device/{device_id}/sensor/{sensor_id}/data)"""
        try:
            device_id = str(device_id)
            sensor_id = str(sensor_id)
            data = json.loads(payload)
            
            device = devices_collection.find_one({"_id": device_id})
            if not device:
                logger.warning(f"Thiết bị {device_id} không tìm thấy trong database")
                return
            
            self.update_device_online_status(device_id)
            
            sensor_data = {
                "sensor_id": sensor_id,
                "value": data.get("value"),
                "type": self.infer_sensor_type_from_unit(data.get("unit", "")),
                "unit": data.get("unit", ""),
                "extra": {k: v for k, v in data.items() if k not in ["value", "unit"]}
            }
            
            self.save_sensor_data(device_id, sensor_data)
            
        except json.JSONDecodeError:
            logger.error(f"JSON payload không hợp lệ: {payload}")
        except Exception as e:
            logger.error(f"Lỗi xử lý dữ liệu sensor: {str(e)}")
    
    def handle_sensor_data(self, device_id: str, payload: str):
        """Xử lý dữ liệu sensor từ thiết bị IoT (format cũ: iot/device/{device_id}/data)"""
        try:
            device_id = str(device_id)
            data = json.loads(payload)
            
            device = devices_collection.find_one({"_id": device_id})
            if not device:
                logger.warning(f"Thiết bị {device_id} không tìm thấy trong database")
                return
            
            self.update_device_online_status(device_id)
            
            if "sensors" in data:
                for sensor_data in data["sensors"]:
                    self.save_sensor_data(device_id, sensor_data)
            else:
                self.save_sensor_data(device_id, data)
            
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
            return "temperature"
    
    def save_sensor_data(self, device_id: str, sensor_data: dict):
        """Lưu dữ liệu sensor vào database"""
        try:
            device_id = str(device_id)
            sensor_id = sensor_data.get("sensor_id")
            value = sensor_data.get("value")
            sensor_type = sensor_data.get("type", sensor_data.get("sensor_type", ""))
            
            if not sensor_id or value is None:
                logger.warning(f"Thiếu sensor_id hoặc value trong dữ liệu: {sensor_data}")
                return
            
            sensor_id = str(sensor_id)
            sensor = sensors_collection.find_one({"_id": sensor_id, "device_id": device_id})
            if not sensor:
                logger.warning(f"Sensor {sensor_id} không tìm thấy, đang tạo sensor mới")
                from models.sensor_models import get_default_thresholds
                new_sensor = {
                    "_id": str(sensor_id),
                    "device_id": str(device_id),
                    "type": sensor_type,
                    "name": sensor_data.get("name", f"Sensor {sensor_id}"),
                    "unit": sensor_data.get("unit", ""),
                    "pin": sensor_data.get("pin", 0),
                    "enabled": True,
                    "created_at": get_vietnam_now_naive(),
                    "updated_at": get_vietnam_now_naive()
                }
                default_min, default_max = get_default_thresholds(sensor_type)
                if default_min is not None:
                    new_sensor["min_threshold"] = default_min
                if default_max is not None:
                    new_sensor["max_threshold"] = default_max
                sensors_collection.insert_one(new_sensor)
            else:
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
                        update_data["updated_at"] = get_vietnam_now_naive()
                        sensors_collection.update_one(
                            {"_id": sensor_id, "device_id": device_id},
                            {"$set": update_data}
                        )
            
            sensor_value = float(value)
            min_threshold = sensor.get("min_threshold")
            max_threshold = sensor.get("max_threshold")
            
            is_over_threshold = False
            threshold_message = ""
            
            if min_threshold is not None and sensor_value < min_threshold:
                is_over_threshold = True
                threshold_message = f"Giá trị {sensor_value:.1f}{sensor.get('unit', '')} thấp hơn ngưỡng dưới {min_threshold}{sensor.get('unit', '')}"
            elif max_threshold is not None and sensor_value > max_threshold:
                is_over_threshold = True
                threshold_message = f"Giá trị {sensor_value:.1f}{sensor.get('unit', '')} vượt quá ngưỡng trên {max_threshold}{sensor.get('unit', '')}"
            
            if is_over_threshold:
                from models.notification_models import create_notification_dict
                from datetime import timedelta
                
                user_links = list(user_room_devices_collection.find({"device_id": device_id}))
                user_ids = list(set([link["user_id"] for link in user_links]))
                
                sensor_name = sensor.get("name", f"Sensor {sensor_id}")
                notification_message = f"{sensor_name}: {threshold_message}"
                
                notification_cooldown_minutes = 5
                cooldown_time = get_vietnam_now_naive() - timedelta(minutes=notification_cooldown_minutes)
                
                for user_id in user_ids:
                    existing_notification = notifications_collection.find_one({
                        "user_id": user_id,
                        "sensor_id": sensor_id,
                        "read": False,
                        "type": "warning",
                        "created_at": {"$gte": cooldown_time}
                    })
                    
                    if not existing_notification:
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
            
            from models.data_models import create_sensor_data_dict
            sensor_data_dict = create_sensor_data_dict(
                sensor_id=sensor_id,
                value=sensor_value,
                device_id=device_id
            )
            
            sensor_data_collection.insert_one(sensor_data_dict)
            
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
            device_id = str(device_id)
            data = json.loads(payload)
            
            device = devices_collection.find_one({"_id": device_id})
            if not device:
                logger.warning(f"Thiết bị {device_id} không tìm thấy trong database")
                return
            
            self.update_device_online_status(device_id)
            
            if "sensors" in data and isinstance(data["sensors"], list):
                for sensor_data_item in data["sensors"]:
                    sensor_id = sensor_data_item.get("sensor_id")
                    value = sensor_data_item.get("value")
                    
                    if sensor_id and value is not None:
                        sensor_id = str(sensor_id)
                        sensor_value = float(value)
                        
                        sensor = sensors_collection.find_one({"_id": sensor_id, "device_id": device_id})
                        
                        if not sensor:
                            from models.sensor_models import get_default_thresholds
                            sensor_type = sensor_data_item.get("type", "temperature")
                            if "humidity" in sensor_id.lower() or "do_am" in sensor_id.lower() or "_02" in sensor_id:
                                sensor_type = "humidity"
                            elif "gas" in sensor_id.lower() or "khi" in sensor_id.lower() or "_03" in sensor_id:
                                sensor_type = "gas"
                            elif "light" in sensor_id.lower() or "anh_sang" in sensor_id.lower():
                                sensor_type = "light"
                            elif "motion" in sensor_id.lower() or "chuyen_dong" in sensor_id.lower():
                                sensor_type = "motion"
                            
                            new_sensor = {
                                "_id": str(sensor_id),
                                "device_id": str(device_id),
                                "type": sensor_type,
                                "name": sensor_data_item.get("name", f"Sensor {sensor_id}"),
                                "unit": sensor_data_item.get("unit", ""),
                                "pin": sensor_data_item.get("pin", 0),
                                "enabled": True,
                                "created_at": get_vietnam_now_naive(),
                                "updated_at": get_vietnam_now_naive()
                            }
                            default_min, default_max = get_default_thresholds(sensor_type)
                            if default_min is not None:
                                new_sensor["min_threshold"] = default_min
                            if default_max is not None:
                                new_sensor["max_threshold"] = default_max
                            try:
                                sensors_collection.insert_one(new_sensor)
                                sensor = new_sensor
                            except Exception as e:
                                logger.error(f"Lỗi tạo sensor {sensor_id}: {str(e)}")
                                sensor = None
                        
                        if sensor:
                            min_threshold = sensor.get("min_threshold")
                            max_threshold = sensor.get("max_threshold")
                            
                            is_over_threshold = False
                            threshold_message = ""
                            
                            if min_threshold is not None and sensor_value < min_threshold:
                                is_over_threshold = True
                                threshold_message = f"Giá trị {sensor_value:.1f}{sensor.get('unit', '')} thấp hơn ngưỡng dưới {min_threshold}{sensor.get('unit', '')}"
                            elif max_threshold is not None and sensor_value > max_threshold:
                                is_over_threshold = True
                                threshold_message = f"Giá trị {sensor_value:.1f}{sensor.get('unit', '')} vượt quá ngưỡng trên {max_threshold}{sensor.get('unit', '')}"
                            
                            if is_over_threshold:
                                from models.notification_models import create_notification_dict
                                from datetime import timedelta
                                
                                user_links = list(user_room_devices_collection.find({"device_id": device_id}))
                                user_ids = list(set([link["user_id"] for link in user_links]))
                                
                                sensor_name = sensor.get("name", f"Sensor {sensor_id}")
                                notification_message = f"{sensor_name}: {threshold_message}"
                                
                                notification_cooldown_minutes = 5
                                cooldown_time = get_vietnam_now_naive() - timedelta(minutes=notification_cooldown_minutes)
                                
                                for user_id in user_ids:
                                    existing_notification = notifications_collection.find_one({
                                        "user_id": user_id,
                                        "sensor_id": sensor_id,
                                        "read": False,
                                        "type": "warning",
                                        "created_at": {"$gte": cooldown_time}
                                    })
                                    
                                    if not existing_notification:
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
                        
                        try:
                            from models.data_models import create_sensor_data_dict
                            sensor_data_dict = create_sensor_data_dict(sensor_id, sensor_value, device_id=device_id)
                            sensor_data_collection.insert_one(sensor_data_dict)
                        except Exception as e:
                            logger.error(f"Lỗi lưu dữ liệu sensor {sensor_id}: {str(e)}")
                            logger.error(traceback.format_exc())
            
            if "actuators" in data and isinstance(data["actuators"], list):
                for actuator_data in data["actuators"]:
                    actuator_id = actuator_data.get("actuator_id")
                    state = actuator_data.get("state")
                    
                    if actuator_id is not None and state is not None:
                        actuator_id = str(actuator_id)
                        
                        actuator = actuators_collection.find_one({"_id": actuator_id, "device_id": device_id})
                        
                        if not actuator:
                            actuator_type = actuator_data.get("type", "relay")
                            if "motor" in actuator_id.lower() or "dong_co" in actuator_id.lower():
                                actuator_type = "motor"
                            elif "led" in actuator_id.lower():
                                actuator_type = "led"
                            elif "fan" in actuator_id.lower() or "quat" in actuator_id.lower():
                                actuator_type = "fan"
                            
                            new_actuator = {
                                "_id": str(actuator_id),
                                "device_id": str(device_id),
                                "type": actuator_type,
                                "name": actuator_data.get("name", f"Actuator {actuator_id}"),
                                "pin": actuator_data.get("pin", 0),
                                "state": bool(state),
                                "enabled": True,
                                "created_at": get_vietnam_now_naive(),
                                "updated_at": get_vietnam_now_naive()
                            }
                            try:
                                actuators_collection.insert_one(new_actuator)
                                actuator = new_actuator
                            except Exception as e:
                                logger.error(f"Lỗi tạo actuator {actuator_id}: {str(e)}")
                                logger.error(traceback.format_exc())
                                actuator = None
                        
                        try:
                            result = actuators_collection.update_one(
                                {"_id": actuator_id, "device_id": device_id},
                                {"$set": {"state": bool(state), "updated_at": get_vietnam_now_naive()}}
                            )
                            if result.modified_count > 0:
                                pass
                        except Exception as e:
                            logger.error(f"Lỗi cập nhật actuator {actuator_id}: {str(e)}")
                            logger.error(traceback.format_exc())
            
            
        except json.JSONDecodeError:
            logger.error(f"JSON payload không hợp lệ: {payload}")
        except Exception as e:
            logger.error(f"Lỗi xử lý dữ liệu thiết bị: {str(e)}")
    
    def handle_device_lwt(self, device_id: str, payload: str):
        """
        Xử lý Last Will and Testament message từ MQTT broker
        Được broker tự động publish khi device disconnect bất thường
        """
        try:
            device_id = str(device_id)
            # LWT message thường là "offline" hoặc có thể là JSON
            try:
                data = json.loads(payload)
                status = data.get("status", "offline")
            except:
                status = "offline"
            
            now = get_vietnam_now_naive()
            
            devices_collection.update_one(
                {"_id": device_id},
                {"$set": {
                    "status": "offline",
                    "updated_at": now
                }}
            )
            
            logger.warning(f"Device {device_id} đã disconnect (LWT triggered)")
            
        except Exception as e:
            logger.error(f"Lỗi xử lý LWT message: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
    
    def connect(self):
        """Kết nối đến MQTT broker"""
        try:
            self.client = mqtt.Client(
                client_id=f"iot_backend_{int(get_vietnam_now_naive().timestamp())}",
                protocol=mqtt.MQTTv311
            )
            
            self.client.on_connect = self.on_connect
            self.client.on_disconnect = self.on_disconnect
            self.client.on_message = self.on_message
            
            self.client.tls_set(
                ca_certs=None,
                certfile=None,
                keyfile=None,
                cert_reqs=ssl.CERT_NONE,
                tls_version=ssl.PROTOCOL_TLS,
                ciphers=None
            )
            self.client.tls_insecure_set(True)
            
            if not MQTT_USERNAME or not MQTT_PASSWORD:
                logger.error("MQTT_USERNAME và MQTT_PASSWORD là BẮT BUỘC cho HiveMQ Cloud!")
                logger.error("Vui lòng thêm vào file .env hoặc cập nhật trong mqtt_client.py")
                logger.error("Lấy thông tin từ: https://console.hivemq.cloud/")
                logger.error("Vào Cluster -> Access Management để tạo credentials")
                self.is_connected = False
                return
            
            self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
            
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
            
            self.client.loop_start()
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
    
    def publish(self, topic: str, payload: dict, qos: int = 0):
        """Gửi message đến MQTT broker"""
        if not self.is_connected:
            logger.warning("MQTT client chưa kết nối")
            return False
        
        try:
            result = self.client.publish(topic, json.dumps(payload), qos=qos)
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
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
            
            device_id = data.get("device_id")
            if device_id:
                device_id = str(device_id)
                existing_device = devices_collection.find_one({"_id": device_id})
                if existing_device:
                    now = get_vietnam_now_naive()
                    update_data = {
                        "name": data.get("name", existing_device.get("name")),
                        "type": data.get("type", existing_device.get("type")),
                        "ip": data.get("ip", existing_device.get("ip", "")),
                        "status": "online",
                        "last_seen": now,
                        "updated_at": now
                    }
                    devices_collection.update_one({"_id": device_id}, {"$set": update_data})
                else:
                    device = create_device_dict(
                        name=data.get("name", "Unnamed Device"),
                        room_id=None,
                        device_type=data.get("type", "esp32"),
                        ip=data.get("ip", ""),
                        status="online",
                        enabled=True
                    )
                    device["_id"] = str(device_id)
                    devices_collection.insert_one(device)
            else:
                device = create_device_dict(
                    name=data.get("name", "Unnamed Device"),
                    room_id=None,
                    device_type=data.get("type", "esp32"),
                    ip=data.get("ip", ""),
                    status="online",
                    enabled=True
                )
                devices_collection.insert_one(device)
                device_id = str(device["_id"])
            
            sensors_data = data.get("sensors", [])
            for sensor_info in sensors_data:
                sensor_id = sensor_info.get("sensor_id")
                if not sensor_id:
                    continue
                
                existing_sensor = sensors_collection.find_one({"_id": sensor_id, "device_id": device_id})
                if not existing_sensor:
                    from models.sensor_models import get_default_thresholds, get_default_unit, get_default_name
                    
                    sensor_type = sensor_info.get("type", "temperature")
                    
                    sensor_unit = sensor_info.get("unit") or get_default_unit(sensor_type)
                    sensor_name = sensor_info.get("name") or get_default_name(sensor_type)
                    
                    sensor = {
                        "_id": str(sensor_id),
                        "device_id": str(device_id),
                        "type": sensor_type,
                        "name": sensor_name,
                        "unit": sensor_unit,
                        "pin": sensor_info.get("pin", 0),
                        "enabled": True,
                        "created_at": get_vietnam_now_naive(),
                        "updated_at": get_vietnam_now_naive()
                    }
                    default_min, default_max = get_default_thresholds(sensor_type)
                    if default_min is not None:
                        sensor["min_threshold"] = default_min
                    if default_max is not None:
                        sensor["max_threshold"] = default_max
                    sensors_collection.insert_one(sensor)
                else:
                    from models.sensor_models import get_default_thresholds, get_default_unit, get_default_name
                    sensor_type = existing_sensor.get("type", sensor_info.get("type", "temperature"))
                    needs_update = False
                    update_data = {}
                    
                    if not existing_sensor.get("unit") or existing_sensor.get("unit") == "":
                        default_unit = get_default_unit(sensor_type)
                        if default_unit:
                            update_data["unit"] = default_unit
                            needs_update = True
                    
                    if not existing_sensor.get("name") or existing_sensor.get("name") == "":
                        default_name = get_default_name(sensor_type)
                        if default_name:
                            update_data["name"] = default_name
                            needs_update = True
                    
                    if "min_threshold" not in existing_sensor and "max_threshold" not in existing_sensor:
                        default_min, default_max = get_default_thresholds(sensor_type)
                        if default_min is not None:
                            update_data["min_threshold"] = default_min
                            needs_update = True
                        if default_max is not None:
                            update_data["max_threshold"] = default_max
                            needs_update = True
                        
                        if needs_update:
                            update_data["updated_at"] = get_vietnam_now_naive()
                            sensors_collection.update_one(
                                {"_id": sensor_id, "device_id": device_id},
                                {"$set": update_data}
                            )
            
            actuators_data = data.get("actuators", [])
            for actuator_info in actuators_data:
                actuator_id = actuator_info.get("actuator_id")
                if not actuator_id:
                    continue
                
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
                    actuator["_id"] = str(actuator_id)
                    actuators_collection.insert_one(actuator)
            
            response_topic = f"device/{device_id}/register/response"
            response = {
                "status": "success",
                "device_id": str(device_id),
                "message": "Device registered successfully"
            }
            self.publish(response_topic, response, qos=1)
            
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
        return self.publish(topic, command, qos=qos)
    
    def check_and_update_offline_devices(self, timeout_minutes: int = 5):
        """
        Kiểm tra và cập nhật trạng thái offline cho các device không gửi message trong khoảng thời gian timeout
        
        Args:
            timeout_minutes: Số phút không nhận được message thì coi như offline (mặc định: 5 phút)
        """
        try:
            now = get_vietnam_now_naive()
            timeout_threshold = now - timedelta(minutes=timeout_minutes)
            
            # Tìm tất cả các device đang online nhưng không có last_seen hoặc last_seen quá cũ
            offline_devices = devices_collection.find({
                "status": "online",
                "$or": [
                    {"last_seen": {"$exists": False}},
                    {"last_seen": {"$lt": timeout_threshold}}
                ]
            })
            
            updated_count = 0
            for device in offline_devices:
                device_id = str(device["_id"])
                last_seen = device.get("last_seen")
                
                # Log thông tin debug
                
                devices_collection.update_one(
                    {"_id": device_id},
                    {"$set": {
                        "status": "offline",
                        "updated_at": now
                    }}
                )
                updated_count += 1
            
        except Exception as e:
            logger.error(f"Lỗi kiểm tra và cập nhật trạng thái offline: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())


# Global MQTT client instance
mqtt_client = MQTTClient()

