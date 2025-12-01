import json
import time
import random
import ssl
import paho.mqtt.client as mqtt

# ========================
# THÔNG TIN MQTT CLOUD
# ========================

DEVICE_ID = "device123"
SENSOR_ID = "temp02"

BROKER = "707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud"
PORT = 8883

# 🔐 Username + Password bạn đã tạo trong HiveMQ Cloud
USERNAME = "ngohai"         # đổi lại
PASSWORD = "NgoHai0804"   # đổi lại

# ========================
# MQTT CALLBACKS
# ========================

def on_connect(client, userdata, flags, rc, properties=None):
    print("Connected to MQTT broker with code:", rc)
    
    # Subscribe vào topic điều khiển từ server
    command_topic = f"device/{DEVICE_ID}/command"
    client.subscribe(command_topic)
    print("Subscribed to:", command_topic)

def on_message(client, userdata, msg):
    print(f"\n📩 Received command on {msg.topic}: {msg.payload.decode()}")

    try:
        data = json.loads(msg.payload.decode())
        action = data.get("action", "")

        # Tạo response giả lập
        response = {
            "device_id": DEVICE_ID,
            "status": "OK",
            "action": action,
            "state": f"{action}_DONE"
        }

        # Publish response
        response_topic = f"device/{DEVICE_ID}/command/response"
        client.publish(response_topic, json.dumps(response))
        print(f"📤 Sent response to {response_topic}")

    except Exception as e:
        print("Error handling command:", e)

# ========================
# MQTT CLIENT CONFIG
# ========================

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
client.connect(BROKER, PORT)
client.loop_start()

# ========================
# LOOP GỬI SENSOR + STATUS
# ========================

try:
    while True:
        # Gửi trạng thái device
        status_topic = f"device/{DEVICE_ID}/status"
        status_payload = {
            "status": "online",
            "battery": random.randint(50, 100)
        }
        client.publish(status_topic, json.dumps(status_payload))
        print("🔄 Sent status:", status_payload)

        # Gửi dữ liệu cảm biến
        sensor_topic = f"device/{DEVICE_ID}/sensor/{SENSOR_ID}/data"
        sensor_value = round(random.uniform(20.0, 40.0), 2)

        sensor_payload = {
            "value": sensor_value,
            "unit": "°C"
        }
        client.publish(sensor_topic, json.dumps(sensor_payload))
        print("📡 Sent sensor data:", sensor_payload)

        time.sleep(5)

except KeyboardInterrupt:
    print("\nStopping simulator...")
finally:
    client.loop_stop()
    client.disconnect()
