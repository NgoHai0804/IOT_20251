"""
ESP32 Device Simulator - Python
================================
Giả lập thiết bị ESP32 để test hệ thống

Cấu trúc:
- Room → Device → Sensor/Actuator
- Đăng ký: device/register (chỉ cần gửi type, server tự set unit/name/threshold)
- Gửi dữ liệu: device/{device_id}/data
- Nhận lệnh: device/{device_id}/command

Format đăng ký (device/register):
{
  "device_id": "device_01",
  "name": "ESP32 Simulator",
  "type": "esp32",
  "sensors": [
    { "sensor_id": "sensor_01", "type": "temperature", "pin": 4 },
    { "sensor_id": "sensor_02", "type": "humidity", "pin": 5 }
  ],
  "actuators": [
    { "actuator_id": "act_01", "type": "relay", "name": "Đèn trần", "pin": 23 }
  ]
}

Format gửi dữ liệu (device/{device_id}/data):
{
  "device_id": "device_01",
  "sensors": [
    { "sensor_id": "sensor_01", "value": 30 },
    { "sensor_id": "sensor_02", "value": 65 }
  ],
  "actuators": [
    { "actuator_id": "act_01", "state": true }
  ]
}

Format nhận lệnh (device/{device_id}/command):
{
  "device_enabled": true,
  "sensors": {
    "sensor_01": true,
    "sensor_02": false
  },
  "actuators": {
    "act_01": true
  }
}
"""

import paho.mqtt.client as mqtt
import json
import time
import random
import ssl
import uuid
from datetime import datetime
from typing import Dict, List
import os
import requests

# ========== Cấu hình ==========
MQTT_BROKER = "707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud"
MQTT_PORT = 8883
MQTT_USERNAME = "ngohai"
MQTT_PASSWORD = "NgoHai0804"

# Device ID (device tự tạo và gửi lên server, dùng làm identifier duy nhất)
DEVICE_ID = "test"
DEVICE_PASSWORD = "123"

# Sensor IDs
SENSOR_TEMP_ID = "test1"
SENSOR_HUMIDITY_ID = "test2"
SENSOR_GAS_ID = "test3"
SENSOR_PIR_ID = "test6"
SENSOR_IR_ID = "test7"

# Actuator IDs
ACTUATOR_RELAY1_ID = "test4"
ACTUATOR_RELAY2_ID = "test5"

# API URL (có thể cấu hình qua env)
API_BASE_URL = "http://localhost:8000"
API_BASE_URL = 'https://iot-20251.onrender.com'

# ========== State Variables ==========
device_enabled = True
sensor_states = {
    SENSOR_TEMP_ID: True,
    SENSOR_HUMIDITY_ID: True,
    SENSOR_GAS_ID: True,
    SENSOR_PIR_ID: True,
    SENSOR_IR_ID: True,
}
actuator_states = {
    ACTUATOR_RELAY1_ID: True,
    ACTUATOR_RELAY2_ID: True,
}

# Sensor values (giả lập)
sensor_values = {
    SENSOR_TEMP_ID: 25.0,  # Nhiệt độ (°C)
    SENSOR_HUMIDITY_ID: 60.0,  # Độ ẩm (%)
    SENSOR_GAS_ID: 200,  # Gas (ppm)
    SENSOR_PIR_ID: False,  # PIR motion sensor (0/1)
    SENSOR_IR_ID: False,  # IR obstacle sensor (0/1)
}

# ========== MQTT Callbacks ==========
def on_connect(client, userdata, flags, rc, properties=None):
    """Callback khi kết nối MQTT"""
    global DEVICE_ID
    if rc == 0:
        print(f"✅ Connected to MQTT broker")
        
        # Chỉ subscribe nếu đã có DEVICE_ID (sau khi đăng ký)
        if DEVICE_ID:
            # Subscribe to command topic
            command_topic = f"device/{DEVICE_ID}/command"
            client.subscribe(command_topic, qos=1)
            print(f"📡 Subscribed to: {command_topic}")
        else:
            print(f"⚠️ Device ID not yet registered, skipping MQTT subscriptions")
    else:
        print(f"❌ Failed to connect, return code {rc}")


def on_disconnect(client, userdata, rc, properties=None):
    """Callback khi ngắt kết nối"""
    print(f"⚠️ Disconnected from MQTT broker")


def on_message(client, userdata, msg):
    """Callback khi nhận được message"""
    try:
        topic = msg.topic
        payload = msg.payload.decode('utf-8')
        
        print(f"\n📨 Received message on topic: {topic}")
        print(f"   Payload: {payload}")
        
        # Xử lý register response
        if "register/response" in topic:
            data = json.loads(payload)
            if data.get("status") == "success":
                print(f"   ✅ Device registered successfully!")
                print(f"   Device ID: {data.get('device_id')}")
                print(f"   Room ID: {data.get('room_id')}")
            else:
                print(f"   ❌ Registration failed: {data.get('message', 'Unknown error')}")
            return
        
        # Chỉ xử lý command topic
        if "command" not in topic:
            return
        
        # Parse JSON
        data = json.loads(payload)
        
        # Xử lý device_enabled
        if "device_enabled" in data:
            global device_enabled
            device_enabled = data["device_enabled"]
            print(f"   Device enabled: {device_enabled}")
            
            if not device_enabled:
                # Tắt tất cả sensors và actuators
                turn_off_all_sensors()
                turn_off_all_actuators()
        
        # Xử lý sensors
        if "sensors" in data:
            sensors = data["sensors"]
            for sensor_id, enabled in sensors.items():
                if sensor_id in sensor_states:
                    sensor_states[sensor_id] = enabled
                    print(f"   Sensor {sensor_id} enabled: {enabled}")
        
        # Xử lý actuators
        if "actuators" in data:
            actuators = data["actuators"]
            for actuator_id, state in actuators.items():
                if actuator_id in actuator_states:
                    actuator_states[actuator_id] = state
                    print(f"   Actuator {actuator_id} state: {state}")
        
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing JSON: {e}")
    except Exception as e:
        print(f"❌ Error processing message: {e}")


# ========== Helper Functions ==========
def send_sensor_data(client):
    """Gửi dữ liệu sensor lên server"""
    global DEVICE_ID
    if not device_enabled or not DEVICE_ID:
        return
    
    # Tạo payload
    payload = {
        "device_id": DEVICE_ID,
        "sensors": [],
        "actuators": []
    }
    
    # Thêm sensors (chỉ gửi nếu enabled)
    if sensor_states.get(SENSOR_TEMP_ID, False):
        # Giả lập nhiệt độ: 20-30°C với biến động nhỏ
        sensor_values[SENSOR_TEMP_ID] = round(
            25 + random.uniform(-2, 2) + random.uniform(-0.5, 0.5), 1
        )
        payload["sensors"].append({
            "sensor_id": SENSOR_TEMP_ID,
            "value": sensor_values[SENSOR_TEMP_ID]
        })
    
    if sensor_states.get(SENSOR_HUMIDITY_ID, False):
        # Giả lập độ ẩm: 50-70% với biến động nhỏ
        sensor_values[SENSOR_HUMIDITY_ID] = round(
            60 + random.uniform(-5, 5) + random.uniform(-2, 2), 1
        )
        payload["sensors"].append({
            "sensor_id": SENSOR_HUMIDITY_ID,
            "value": sensor_values[SENSOR_HUMIDITY_ID]
        })
    
    if sensor_states.get(SENSOR_GAS_ID, False):
        # Giả lập gas: 100-300 ppm
        sensor_values[SENSOR_GAS_ID] = int(
            200 + random.uniform(-50, 50)
        )
        payload["sensors"].append({
            "sensor_id": SENSOR_GAS_ID,
            "value": sensor_values[SENSOR_GAS_ID]
        })
    
    # ===== PIR =====
    if sensor_states.get(SENSOR_PIR_ID, False):
        # Giả lập PIR: thỉnh thoảng phát hiện chuyển động (10% cơ hội)
        sensor_values[SENSOR_PIR_ID] = random.random() < 0.1
        payload["sensors"].append({
            "sensor_id": SENSOR_PIR_ID,
            "type": "motion",
            "value": 1 if sensor_values[SENSOR_PIR_ID] else 0
        })
    
    # ===== IR (VẬT CẢN) =====
    if sensor_states.get(SENSOR_IR_ID, False):
        # Giả lập IR: thỉnh thoảng phát hiện vật cản (15% cơ hội)
        sensor_values[SENSOR_IR_ID] = random.random() < 0.15
        payload["sensors"].append({
            "sensor_id": SENSOR_IR_ID,
            "type": "obstacle",   # hoặc "infrared" / "binary"
            "value": 1 if sensor_values[SENSOR_IR_ID] else 0
        })
    
    # Thêm actuators (gửi trạng thái hiện tại)
    payload["actuators"].append({
        "actuator_id": ACTUATOR_RELAY1_ID,
        "state": actuator_states[ACTUATOR_RELAY1_ID]
    })
    payload["actuators"].append({
        "actuator_id": ACTUATOR_RELAY2_ID,
        "state": actuator_states[ACTUATOR_RELAY2_ID]
    })
    
    # Publish
    topic = f"device/{DEVICE_ID}/data"
    client.publish(topic, json.dumps(payload), qos=1)
    
    print(f"📤 Published to {topic}:")
    print(f"   Sensors: {len(payload['sensors'])}")
    print(f"   Actuators: {len(payload['actuators'])}")
    if payload['sensors']:
        for sensor in payload['sensors']:
            print(f"      - {sensor['sensor_id']}: {sensor['value']}")


def turn_off_all_sensors():
    """Tắt tất cả sensors"""
    global sensor_states
    for sensor_id in sensor_states:
        sensor_states[sensor_id] = False
    print("   🔴 All sensors turned off")


def turn_off_all_actuators():
    """Tắt tất cả actuators"""
    global actuator_states
    for actuator_id in actuator_states:
        actuator_states[actuator_id] = False
    print("   🔴 All actuators turned off")


def print_status():
    """In trạng thái hiện tại"""
    print("\n" + "="*50)
    print(f"📊 Device Status")
    print(f"   ID: {DEVICE_ID}")
    print("="*50)
    print(f"Device Enabled: {device_enabled}")
    print("\nSensors:")
    for sensor_id, enabled in sensor_states.items():
        value = sensor_values.get(sensor_id, "N/A")
        status = "🟢 ON" if enabled else "🔴 OFF"
        print(f"  - {sensor_id}: {status} (value: {value})")
    print("\nActuators:")
    for actuator_id, state in actuator_states.items():
        status = "🟢 ON" if state else "🔴 OFF"
        print(f"  - {actuator_id}: {status}")
    print("="*50 + "\n")


# ========== Register Device ==========
def register_device(client=None):
    """Đăng ký thiết bị với server qua MQTT topic device/register"""
    
    if not client or not client.is_connected():
        print("❌ MQTT client not connected. Cannot register device.")
        return False
    
    # Payload đăng ký - chỉ cần gửi type cho sensors, server sẽ tự động set unit, name và threshold
    register_payload = {
        "device_id": DEVICE_ID,  # Device tự tạo và gửi lên server, dùng làm identifier duy nhất
        "name": f"ESP32 Simulator {DEVICE_ID}",
        "type": "esp32",
        "ip": "",  # Có thể để trống
        "sensors": [
            # Chỉ cần gửi type và pin, server sẽ tự động set unit, name và threshold
            {"sensor_id": SENSOR_TEMP_ID, "type": "temperature", "pin": 4},
            {"sensor_id": SENSOR_HUMIDITY_ID, "type": "humidity", "pin": 5},
            {"sensor_id": SENSOR_GAS_ID, "type": "gas", "pin": 34},
            {"sensor_id": SENSOR_PIR_ID, "type": "motion", "pin": 27},
            {"sensor_id": SENSOR_IR_ID, "type": "obstacle", "pin": 33}  # hoặc "infrared" / "binary"
        ],
        "actuators": [
            {"actuator_id": ACTUATOR_RELAY1_ID, "type": "relay", "name": "Đèn trần", "pin": 23},
            {"actuator_id": ACTUATOR_RELAY2_ID, "type": "relay", "name": "Quạt", "pin": 22}
        ]
    }
    
    try:
        print(f"📝 Registering device via MQTT...")
        print(f"   Topic: device/register")
        print(f"   Device ID: {DEVICE_ID} (device tự tạo, dùng làm identifier duy nhất)")
        print(f"   Sensors: {len(register_payload['sensors'])} sensors (chỉ gửi type, server tự set unit/name/threshold)")
        print(f"   Actuators: {len(register_payload['actuators'])} actuators")
        
        # Publish đăng ký lên topic device/register
        topic = "device/register"
        message = json.dumps(register_payload)
        
        result = client.publish(topic, message, qos=1)
        
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"✅ Registration message sent! Waiting for response...")
            # Đợi một chút để server xử lý
            time.sleep(2)
            return True
        else:
            print(f"❌ Failed to publish registration message. Error code: {result.rc}")
            return False
            
    except Exception as e:
        print(f"❌ Error registering device: {e}")
        import traceback
        traceback.print_exc()
        return False


# ========== Main ==========
def main():
    print("🚀 ESP32 Device Simulator")
    print(f"Device ID: {DEVICE_ID} (device tự tạo, dùng làm identifier duy nhất)")
    print(f"Device Password: {'***' if DEVICE_PASSWORD else '(none)'}")
    print(f"MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print("-" * 50)
    
    # Tạo MQTT client
    client = mqtt.Client(
        client_id=f"ESP32-Simulator-{DEVICE_ID}-{int(time.time())}",
        protocol=mqtt.MQTTv5
    )
    
    # Set callbacks
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    
    # Set TLS/SSL
    client.tls_set(
        ca_certs=None,
        certfile=None,
        keyfile=None,
        cert_reqs=ssl.CERT_NONE,
        tls_version=ssl.PROTOCOL_TLS
    )
    client.tls_insecure_set(True)
    
    # Set username/password
    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    else:
        print("⚠️ Warning: MQTT_USERNAME and MQTT_PASSWORD not set!")
        print("   Please update them in the script.")
        return
    
    # Connect với Last Will and Testament (LWT)
    # LWT sẽ tự động được broker publish khi device disconnect bất thường
    try:
        print(f"\n🔌 Connecting to MQTT broker...")
        
        # Thiết lập Last Will and Testament (LWT)
        # Khi device disconnect bất thường, broker sẽ tự động publish message này
        lwt_topic = f"device/{DEVICE_ID}/lwt"
        lwt_payload = json.dumps({"status": "offline"})
        client.will_set(lwt_topic, lwt_payload, qos=1, retain=False)
        print(f"✅ Đã thiết lập Last Will and Testament: {lwt_topic}")
        print(f"   → Broker sẽ tự động thông báo khi device disconnect")
        
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        client.loop_start()
        
        # Đợi kết nối
        time.sleep(2)
        
        # Đăng ký thiết bị (qua MQTT topic device/register)
        print("\n📝 Registering device via MQTT...")
        registration_success = register_device(client)
        
        # Đợi đăng ký hoàn tất
        if registration_success:
            print(f"\n✅ Device registration sent! Device ID: {DEVICE_ID}")
            print("   Server will automatically create sensors with unit, name and thresholds based on type")
            # Không cần reconnect, tiếp tục với kết nối hiện tại
        else:
            print("\n❌ Failed to register device. Exiting...")
            return
        
        # Main loop
        last_sensor_send = 0
        last_status_print = 0
        sensor_interval = 5  # Gửi sensor data mỗi 5 giây
        status_print_interval = 30  # In status mỗi 30 giây
        
        print("\n✅ Simulator started! Press Ctrl+C to stop.")
        print("   → LWT đã được thiết lập, backend sẽ tự động phát hiện khi device disconnect")
        print("   → Chỉ cần gửi sensor data, không cần gửi status message nữa\n")
        
        try:
            while True:
                current_time = time.time()
                
                # Gửi dữ liệu sensor định kỳ
                # Sensor data sẽ tự động cập nhật last_seen và status = "online"
                if current_time - last_sensor_send >= sensor_interval:
                    send_sensor_data(client)
                    last_sensor_send = current_time
                
                # In status định kỳ
                if current_time - last_status_print >= status_print_interval:
                    print_status()
                    last_status_print = current_time
                
                time.sleep(1)
                
        except KeyboardInterrupt:
            print("\n\n🛑 Stopping simulator...")
            client.loop_stop()
            client.disconnect()
            print("✅ Simulator stopped.")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
