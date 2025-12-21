import json
import time
import random
import ssl
import paho.mqtt.client as mqtt
import requests
import os
from dotenv import load_dotenv

# Tải biến môi trường
load_dotenv()

# ========================
# THÔNG TIN MQTT CLOUD
# ========================

# Device ID cố định - không cần đăng ký
DEVICE_ID = os.getenv("DEVICE_ID", "device123")  # ID cố định của thiết bị
SENSOR_ID = os.getenv("SENSOR_ID", "temp02")

BROKER = os.getenv("MQTT_BROKER", "707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud")
PORT = int(os.getenv("MQTT_PORT", "8883"))

# Username + Password từ biến môi trường
USERNAME = os.getenv("MQTT_USERNAME", "ngohai")
PASSWORD = os.getenv("MQTT_PASSWORD", "NgoHai0804")

# ========================
# BACKEND API CONFIG
# ========================
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")  # URL của backend server

# ========================
# BACKEND API FUNCTIONS
# ========================

def add_sensor():
    """Thêm sensor cho thiết bị"""
    try:
        url = f"{API_BASE_URL}/iot/device/{DEVICE_ID}/sensor/add"
        payload = {
            "sensor_id": SENSOR_ID,
            "name": "Temperature Sensor",
            "sensor_type": "temperature",
            "note": "Test temperature sensor"
        }
        response = requests.post(url, json=payload)
        result = response.json()
        
        if result.get("status"):
            print(f"✅ Sensor added successfully!")
            print(f"   Sensor ID: {SENSOR_ID}")
            return True
        else:
            print(f"⚠️ Sensor registration: {result.get('message')}")
            return True  # Có thể sensor đã tồn tại, không sao
    except Exception as e:
        print(f"❌ Error adding sensor: {str(e)}")
        return False

# NOTE: Hàm get_device_status() không còn cần thiết nữa
# Vì giờ cloud_status được cập nhật qua MQTT command từ backend
# Giữ lại để tham khảo hoặc có thể dùng cho các mục đích khác
def get_device_status():
    """
    [DEPRECATED] Hàm này không còn được sử dụng
    Cloud status giờ được cập nhật qua MQTT command từ backend
    """
    pass

# ========================
# MQTT CALLBACKS
# ========================

# Biến global để lưu trạng thái cloud
cloud_status = "off"

def on_connect(client, userdata, flags, rc, properties=None):
    global cloud_status
    print("Connected to MQTT broker with code:", rc)
    
    if DEVICE_ID:
        # Subscribe vào topic điều khiển từ server với QoS 1
        command_topic = f"device/{DEVICE_ID}/command"
        result = client.subscribe(command_topic, qos=1)
        if result[0] == mqtt.MQTT_ERR_SUCCESS:
            print(f"✅ Subscribed to: {command_topic} (QoS 1)")
        else:
            print(f"❌ Failed to subscribe to: {command_topic}")

def on_message(client, userdata, msg):
    global cloud_status
    print(f"\n📩 Received command on {msg.topic}: {msg.payload.decode()}")

    try:
        data = json.loads(msg.payload.decode())
        action = data.get("action", "")

        # Xử lý command set_cloud_status
        if action == "set_cloud_status":
            new_cloud_status = data.get("cloud_status", "off")
            if new_cloud_status in ["on", "off"]:
                cloud_status = new_cloud_status
                print(f"✅ Cloud status updated to: {cloud_status}")
                if cloud_status == "on":
                    print("   → Device ENABLED")
                else:
                    print("   → Device DISABLED")
            else:
                print(f"⚠️ Invalid cloud_status value: {new_cloud_status}")
        else:
            print(f"⚠️ Unknown action: {action}")

    except json.JSONDecodeError as e:
        print(f"❌ Error parsing JSON command: {e}")
    except Exception as e:
        print(f"❌ Error handling command: {e}")

# ========================
# INITIALIZATION
# ========================

print("=" * 50)
print("🚀 Starting IoT Device Simulator")
print("=" * 50)
print(f"📱 Device ID: {DEVICE_ID} (Fixed)")

# Thêm sensor (optional - có thể bỏ qua nếu sensor đã tồn tại)
print("\n📝 Adding sensor...")
add_sensor()

# Khởi tạo MQTT client
print("\n📝 Initializing MQTT client...")
client = mqtt.Client(client_id=DEVICE_ID, protocol=mqtt.MQTTv5)

# LOGIN
client.username_pw_set(USERNAME, PASSWORD)

# TLS / SSL (bắt buộc cho HiveMQ Cloud)
client.tls_set(
    cert_reqs=ssl.CERT_REQUIRED,
    tls_version=ssl.PROTOCOL_TLS,
)

client.on_connect = on_connect
client.on_message = on_message

# Connect đến HiveMQ Cloud qua TLS
print("🔌 Connecting to MQTT broker...")
client.connect(BROKER, PORT)
client.loop_start()

# Đợi kết nối MQTT
time.sleep(2)

print("\n✅ Initialization complete!")
print("=" * 50)

# ========================
# MAIN LOOP
# ========================

print("\n" + "=" * 50)
print("🔄 Starting main loop...")
print("=" * 50)
print("📌 Cloud status will be updated via MQTT command from backend")
print("📌 No need to poll REST API for status anymore")
print("=" * 50 + "\n")

try:
    while True:
        # Gửi trạng thái device qua MQTT (với QoS 1 để đảm bảo delivery)
        status_topic = f"device/{DEVICE_ID}/status"
        status_payload = {
            "status": "online",
            "battery": random.randint(50, 100),
            "cloud_status": cloud_status  # Trạng thái cloud được cập nhật từ MQTT command
        }
        result = client.publish(status_topic, json.dumps(status_payload), qos=1)
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"🔄 Sent status: {status_payload}")
        else:
            print(f"⚠️ Failed to send status (code: {result.rc})")

        # Gửi dữ liệu cảm biến (chỉ khi cloud_status là "on")
        if cloud_status == "on":
            sensor_topic = f"device/{DEVICE_ID}/sensor/{SENSOR_ID}/data"
            sensor_value = round(random.uniform(20.0, 40.0), 2)

            sensor_payload = {
                "value": sensor_value,
                "unit": "°C"
            }
            result = client.publish(sensor_topic, json.dumps(sensor_payload), qos=1)
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"📡 Sent sensor data: {sensor_payload}")
            else:
                print(f"⚠️ Failed to send sensor data (code: {result.rc})")
        else:
            print("⏸️ Cloud status is OFF, skipping sensor data transmission")

        time.sleep(5)

except KeyboardInterrupt:
    print("\n🛑 Stopping simulator...")
finally:
    client.loop_stop()
    client.disconnect()
    print("✅ Disconnected from MQTT broker")
