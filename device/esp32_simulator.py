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

MQTT_BROKER = "707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud"
MQTT_PORT = 8883
MQTT_USERNAME = "ngohai"
MQTT_PASSWORD = "NgoHai0804"

DEVICE_ID = "test"
DEVICE_PASSWORD = "123"

SENSOR_TEMP_ID = "test1"
SENSOR_HUMIDITY_ID = "test2"
SENSOR_GAS_ID = "test3"
SENSOR_PIR_ID = "test6"
SENSOR_IR_ID = "test7"

ACTUATOR_RELAY1_ID = "test4"
ACTUATOR_RELAY2_ID = "test5"

API_BASE_URL = "http://localhost:8000"
API_BASE_URL = 'https://iot-20251.onrender.com'
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

sensor_values = {
    SENSOR_TEMP_ID: 25.0,
    SENSOR_HUMIDITY_ID: 60.0,
    SENSOR_GAS_ID: 200,
    SENSOR_PIR_ID: False,
    SENSOR_IR_ID: False,
}

def on_connect(client, userdata, flags, rc, properties=None):
    """Callback khi kết nối MQTT"""
    global DEVICE_ID
    if rc == 0:
        print(f"Connected to MQTT broker")
        
        if DEVICE_ID:
            command_topic = f"device/{DEVICE_ID}/command"
            client.subscribe(command_topic, qos=1)
            print(f"Subscribed to: {command_topic}")
        else:
            print(f"Device ID not yet registered, skipping MQTT subscriptions")
    else:
        print(f"Failed to connect, return code {rc}")


def on_disconnect(client, userdata, rc, properties=None):
    """Callback khi ngắt kết nối"""
    print(f"Disconnected from MQTT broker")


def on_message(client, userdata, msg):
    """Callback khi nhận được message"""
    try:
        topic = msg.topic
        payload = msg.payload.decode('utf-8')
        
        print(f"\nReceived message on topic: {topic}")
        print(f"   Payload: {payload}")
        
        if "register/response" in topic:
            data = json.loads(payload)
            if data.get("status") == "success":
                print(f"   Device registered successfully!")
                print(f"   Device ID: {data.get('device_id')}")
                print(f"   Room ID: {data.get('room_id')}")
            else:
                print(f"   Registration failed: {data.get('message', 'Unknown error')}")
            return
        
        if "command" not in topic:
            return
        
        data = json.loads(payload)
        
        if "device_enabled" in data:
            global device_enabled
            device_enabled = data["device_enabled"]
            print(f"   Device enabled: {device_enabled}")
            
            if not device_enabled:
                turn_off_all_sensors()
                turn_off_all_actuators()
        
        if "sensors" in data:
            sensors = data["sensors"]
            for sensor_id, enabled in sensors.items():
                if sensor_id in sensor_states:
                    sensor_states[sensor_id] = enabled
                    print(f"   Sensor {sensor_id} enabled: {enabled}")
        
        if "actuators" in data:
            actuators = data["actuators"]
            for actuator_id, state in actuators.items():
                if actuator_id in actuator_states:
                    actuator_states[actuator_id] = state
                    print(f"   Actuator {actuator_id} state: {state}")
        
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
    except Exception as e:
        print(f"Error processing message: {e}")


def send_sensor_data(client):
    """Gửi dữ liệu sensor lên server"""
    global DEVICE_ID
    if not device_enabled or not DEVICE_ID:
        return
    
    payload = {
        "device_id": DEVICE_ID,
        "sensors": [],
        "actuators": []
    }
    
    if sensor_states.get(SENSOR_TEMP_ID, False):
        sensor_values[SENSOR_TEMP_ID] = round(
            25 + random.uniform(-2, 2) + random.uniform(-0.5, 0.5), 1
        )
        payload["sensors"].append({
            "sensor_id": SENSOR_TEMP_ID,
            "value": sensor_values[SENSOR_TEMP_ID]
        })
    
    if sensor_states.get(SENSOR_HUMIDITY_ID, False):
        sensor_values[SENSOR_HUMIDITY_ID] = round(
            60 + random.uniform(-5, 5) + random.uniform(-2, 2), 1
        )
        payload["sensors"].append({
            "sensor_id": SENSOR_HUMIDITY_ID,
            "value": sensor_values[SENSOR_HUMIDITY_ID]
        })
    
    if sensor_states.get(SENSOR_GAS_ID, False):
        sensor_values[SENSOR_GAS_ID] = int(
            200 + random.uniform(-50, 50)
        )
        payload["sensors"].append({
            "sensor_id": SENSOR_GAS_ID,
            "value": sensor_values[SENSOR_GAS_ID]
        })
    
    if sensor_states.get(SENSOR_PIR_ID, False):
        sensor_values[SENSOR_PIR_ID] = random.random() < 0.1
        payload["sensors"].append({
            "sensor_id": SENSOR_PIR_ID,
            "type": "motion",
            "value": 1 if sensor_values[SENSOR_PIR_ID] else 0
        })
    
    if sensor_states.get(SENSOR_IR_ID, False):
        sensor_values[SENSOR_IR_ID] = random.random() < 0.15
        payload["sensors"].append({
            "sensor_id": SENSOR_IR_ID,
            "type": "obstacle",
            "value": 1 if sensor_values[SENSOR_IR_ID] else 0
        })
    
    payload["actuators"].append({
        "actuator_id": ACTUATOR_RELAY1_ID,
        "state": actuator_states[ACTUATOR_RELAY1_ID]
    })
    payload["actuators"].append({
        "actuator_id": ACTUATOR_RELAY2_ID,
        "state": actuator_states[ACTUATOR_RELAY2_ID]
    })
    
    topic = f"device/{DEVICE_ID}/data"
    client.publish(topic, json.dumps(payload), qos=1)
    
    print(f"Published to {topic}:")
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
    print("   All sensors turned off")


def turn_off_all_actuators():
    """Tắt tất cả actuators"""
    global actuator_states
    for actuator_id in actuator_states:
        actuator_states[actuator_id] = False
    print("   All actuators turned off")


def print_status():
    """In trạng thái hiện tại"""
    print("\n" + "="*50)
    print(f"Device Status")
    print(f"   ID: {DEVICE_ID}")
    print("="*50)
    print(f"Device Enabled: {device_enabled}")
    print("\nSensors:")
    for sensor_id, enabled in sensor_states.items():
        value = sensor_values.get(sensor_id, "N/A")
        status = "ON" if enabled else "OFF"
        print(f"  - {sensor_id}: {status} (value: {value})")
    print("\nActuators:")
    for actuator_id, state in actuator_states.items():
        status = "ON" if state else "OFF"
        print(f"  - {actuator_id}: {status}")
    print("="*50 + "\n")


def register_device(client=None):
    """Đăng ký thiết bị với server qua MQTT topic device/register"""
    
    if not client or not client.is_connected():
        print("MQTT client not connected. Cannot register device.")
        return False
    
    register_payload = {
        "device_id": DEVICE_ID,
        "name": f"ESP32 Simulator {DEVICE_ID}",
        "type": "esp32",
        "ip": "",
        "sensors": [
            {"sensor_id": SENSOR_TEMP_ID, "type": "temperature", "pin": 4},
            {"sensor_id": SENSOR_HUMIDITY_ID, "type": "humidity", "pin": 5},
            {"sensor_id": SENSOR_GAS_ID, "type": "gas", "pin": 34},
            {"sensor_id": SENSOR_PIR_ID, "type": "motion", "pin": 27},
            {"sensor_id": SENSOR_IR_ID, "type": "obstacle", "pin": 33}
        ],
        "actuators": [
            {"actuator_id": ACTUATOR_RELAY1_ID, "type": "relay", "name": "Đèn trần", "pin": 23},
            {"actuator_id": ACTUATOR_RELAY2_ID, "type": "relay", "name": "Quạt", "pin": 22}
        ]
    }
    
    try:
        print(f"Registering device via MQTT...")
        print(f"   Topic: device/register")
        print(f"   Device ID: {DEVICE_ID}")
        print(f"   Sensors: {len(register_payload['sensors'])} sensors")
        print(f"   Actuators: {len(register_payload['actuators'])} actuators")
        
        topic = "device/register"
        message = json.dumps(register_payload)
        
        result = client.publish(topic, message, qos=1)
        
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"Registration message sent! Waiting for response...")
            time.sleep(2)
            return True
        else:
            print(f"Failed to publish registration message. Error code: {result.rc}")
            return False
            
    except Exception as e:
        print(f"Error registering device: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("ESP32 Device Simulator")
    print(f"Device ID: {DEVICE_ID}")
    print(f"Device Password: {'***' if DEVICE_PASSWORD else '(none)'}")
    print(f"MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print("-" * 50)
    
    client = mqtt.Client(
        client_id=f"ESP32-Simulator-{DEVICE_ID}-{int(time.time())}",
        protocol=mqtt.MQTTv5
    )
    
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    
    client.tls_set(
        ca_certs=None,
        certfile=None,
        keyfile=None,
        cert_reqs=ssl.CERT_NONE,
        tls_version=ssl.PROTOCOL_TLS
    )
    client.tls_insecure_set(True)
    
    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    else:
        print("Warning: MQTT_USERNAME and MQTT_PASSWORD not set!")
        print("   Please update them in the script.")
        return
    
    try:
        print(f"\nConnecting to MQTT broker...")
        
        lwt_topic = f"device/{DEVICE_ID}/lwt"
        lwt_payload = json.dumps({"status": "offline"})
        client.will_set(lwt_topic, lwt_payload, qos=1, retain=False)
        print(f"Last Will and Testament set: {lwt_topic}")
        
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        client.loop_start()
        
        time.sleep(2)
        
        print("\nRegistering device via MQTT...")
        registration_success = register_device(client)
        
        if registration_success:
            print(f"\nDevice registration sent! Device ID: {DEVICE_ID}")
        else:
            print("\nFailed to register device. Exiting...")
            return
        
        last_sensor_send = 0
        last_status_print = 0
        sensor_interval = 5
        status_print_interval = 30
        
        print("\nSimulator started! Press Ctrl+C to stop.\n")
        
        try:
            while True:
                current_time = time.time()
                
                if current_time - last_sensor_send >= sensor_interval:
                    send_sensor_data(client)
                    last_sensor_send = current_time
                
                if current_time - last_status_print >= status_print_interval:
                    print_status()
                    last_status_print = current_time
                
                time.sleep(1)
                
        except KeyboardInterrupt:
            print("\n\nStopping simulator...")
            client.loop_stop()
            client.disconnect()
            print("Simulator stopped.")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
