"""
ESP32 Device Simulator - Python
================================
Giả lập thiết bị ESP32 để test hệ thống

Cấu trúc:
- Room → Device → Sensor/Actuator
- Gửi dữ liệu: device/{device_id}/data
- Nhận lệnh: device/{device_id}/command

Format gửi lên:
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

Format nhận xuống:
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
from datetime import datetime
from typing import Dict, List
import os
from dotenv import load_dotenv

# Tải biến môi trường
load_dotenv()

# ========== Cấu hình ==========
MQTT_BROKER = os.getenv("MQTT_BROKER", "707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud")
MQTT_PORT = int(os.getenv("MQTT_PORT", "8883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "ngohai")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "NgoHai0804")

# Device ID (phải khớp với database)
DEVICE_ID = os.getenv("DEVICE_ID", "device_01")

# Sensor IDs
SENSOR_TEMP_ID = "sensor_01"
SENSOR_HUMIDITY_ID = "sensor_02"
SENSOR_GAS_ID = "sensor_03"

# Actuator IDs
ACTUATOR_RELAY1_ID = "act_01"
ACTUATOR_RELAY2_ID = "act_02"

# ========== State Variables ==========
device_enabled = True
sensor_states = {
    SENSOR_TEMP_ID: True,
    SENSOR_HUMIDITY_ID: True,
    SENSOR_GAS_ID: True,
}
actuator_states = {
    ACTUATOR_RELAY1_ID: False,
    ACTUATOR_RELAY2_ID: False,
}

# Sensor values (giả lập)
sensor_values = {
    SENSOR_TEMP_ID: 25.0,  # Nhiệt độ (°C)
    SENSOR_HUMIDITY_ID: 60.0,  # Độ ẩm (%)
    SENSOR_GAS_ID: 200,  # Gas (ppm)
}

# ========== MQTT Callbacks ==========
def on_connect(client, userdata, flags, rc, properties=None):
    """Callback khi kết nối MQTT"""
    if rc == 0:
        print(f"✅ Connected to MQTT broker")
        
        # Subscribe to command topic và register response
        command_topic = f"device/{DEVICE_ID}/command"
        register_response_topic = f"device/{DEVICE_ID}/register/response"
        client.subscribe(command_topic, qos=1)
        client.subscribe(register_response_topic, qos=1)
        print(f"📡 Subscribed to: {command_topic}")
        print(f"📡 Subscribed to: {register_response_topic}")
        
        # Gửi trạng thái online
        send_device_status(client)
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
    if not device_enabled:
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


def send_device_status(client):
    """Gửi trạng thái thiết bị"""
    payload = {
        "status": "online"
    }
    
    topic = f"device/{DEVICE_ID}/status"
    client.publish(topic, json.dumps(payload), qos=1)
    print(f"📤 Published status to {topic}")


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
    print(f"📊 Device Status: {DEVICE_ID}")
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
def register_device(client):
    """Đăng ký thiết bị với server"""
    register_payload = {
        "device_id": DEVICE_ID,
        "name": f"ESP32 Simulator {DEVICE_ID}",
        "type": "esp32",
        "room_name": "Phòng khách",  # Tên phòng (sẽ tạo nếu chưa có)
        "ip": "192.168.1.100",  # IP giả lập
        "sensors": [
            {
                "sensor_id": SENSOR_TEMP_ID,
                "type": "temperature",
                "name": "Nhiệt độ",
                "unit": "°C",
                "pin": 4
            },
            {
                "sensor_id": SENSOR_HUMIDITY_ID,
                "type": "humidity",
                "name": "Độ ẩm",
                "unit": "%",
                "pin": 4
            },
            {
                "sensor_id": SENSOR_GAS_ID,
                "type": "gas",
                "name": "Gas Sensor",
                "unit": "ppm",
                "pin": 34
            }
        ],
        "actuators": [
            {
                "actuator_id": ACTUATOR_RELAY1_ID,
                "type": "relay",
                "name": "Đèn trần",
                "pin": 23
            },
            {
                "actuator_id": ACTUATOR_RELAY2_ID,
                "type": "relay",
                "name": "Quạt",
                "pin": 22
            }
        ]
    }
    
    topic = "device/register"
    client.publish(topic, json.dumps(register_payload), qos=1)
    print(f"📝 Published registration to {topic}")
    print(f"   Device ID: {DEVICE_ID}")
    print(f"   Sensors: {len(register_payload['sensors'])}")
    print(f"   Actuators: {len(register_payload['actuators'])}")
    
    # Đợi response
    time.sleep(1)


# ========== Main ==========
def main():
    print("🚀 ESP32 Device Simulator")
    print(f"Device ID: {DEVICE_ID}")
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
    
    # Connect
    try:
        print(f"\n🔌 Connecting to MQTT broker...")
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        client.loop_start()
        
        # Đợi kết nối
        time.sleep(2)
        
        # Đăng ký thiết bị
        print("\n📝 Registering device...")
        register_device(client)
        time.sleep(2)  # Đợi server xử lý đăng ký
        
        # Main loop
        last_sensor_send = 0
        last_status_print = 0
        sensor_interval = 5  # Gửi mỗi 5 giây
        status_print_interval = 30  # In status mỗi 30 giây
        
        print("\n✅ Simulator started! Press Ctrl+C to stop.\n")
        
        try:
            while True:
                current_time = time.time()
                
                # Gửi dữ liệu sensor định kỳ
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
