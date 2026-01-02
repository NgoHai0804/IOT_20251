# Hướng dẫn cho thiết bị IoT mới - Từ A đến Z

## Dành cho thiết bị chưa biết gì về hệ thống

Tài liệu này hướng dẫn một thiết bị IoT hoàn toàn mới cách kết nối và hoạt động trong hệ thống. Thiết bị sẽ học cách:
1. Tự đăng ký với hệ thống
2. Kết nối MQTT an toàn  
3. Gửi dữ liệu sensor lên server
4. Nhận và thực hiện lệnh từ server
5. Duy trì kết nối ổn định

## Kiến trúc hệ thống (quan điểm của thiết bị)

```
[THIẾT BỊ CỦA BẠN] 
    |
    | 1. Đăng ký qua HTTP
    v
Backend Server ← Đăng ký thành công
    |
    | 2. Kết nối MQTT
    v
HiveMQ Cloud Broker
    |
    | 3. Gửi/nhận dữ liệu
    v
Backend Server ← → Frontend
```

---

# BƯỚC 1: CHUẨN BỊ THÔNG TIN CƠ BẢN

## Thiết bị cần biết những gì?

### 1.1. Thông tin định danh của thiết bị
```python
# Thiết bị TỰ TạO ID duy nhất (không trùng với thiết bị khác)
DEVICE_ID = "device_01"  # Hoặc dùng MAC address, UUID...
DEVICE_PASSWORD = "123"  # Mật khẩu bảo mật (tùy chọn)
DEVICE_NAME = "ESP32 Living Room"  # Tên hiển thị
DEVICE_TYPE = "esp32"  # Loại thiết bị
```

### 1.2. Thông tin server backend
```python
# URL của backend server
API_BASE_URL = "http://localhost:8000"  # Hoặc IP thật của server
# Ví dụ: "http://192.168.1.100:8000" hoặc "https://myserver.com"
```

### 1.3. Thông tin MQTT Broker (HiveMQ Cloud)
```python
MQTT_BROKER = "707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud"
MQTT_PORT = 8883  # Port TLS/SSL
MQTT_USERNAME = "ngohai"  # Lấy từ HiveMQ Console
MQTT_PASSWORD = "NgoHai0804"  # Lấy từ HiveMQ Console
```

### 1.4. Thông tin sensors và actuators của thiết bị
```python
# Danh sách sensors mà thiết bị có
SENSORS = {
    "sensor_01": "Temperature",  # Cảm biến nhiệt độ
    "sensor_02": "Humidity",     # Cảm biến độ ẩm  
    "sensor_03": "Gas"           # Cảm biến khí gas
}

# Danh sách actuators mà thiết bị có
ACTUATORS = {
    "act_01": "Relay 1",  # Relay điều khiển đèn
    "act_02": "Relay 2"   # Relay điều khiển quạt
}
```

---

# BƯỚC 2: ĐĂNG KÝ THIẾT BỊ VỚI HỆ THỐNG

## Tại sao phải đăng ký?
- Hệ thống cần biết thiết bị tồn tại
- Tạo record trong database
- Tự động tạo sensors với unit, name và threshold dựa trên type
- Cấp quyền truy cập MQTT topics
- Liên kết với room (phòng)

## 2.1. Đăng ký qua MQTT (Khuyến nghị)

**Lưu ý quan trọng:** Khi đăng ký sensors, bạn chỉ cần gửi `type`, server sẽ tự động:
- Set `unit` (ví dụ: "°C" cho temperature, "%" cho humidity)
- Set `name` (ví dụ: "Nhiệt độ" cho temperature, "Độ ẩm" cho humidity)
- Set `threshold` (ví dụ: (10.0, 40.0) cho temperature, (30.0, 80.0) cho humidity)

```python
import json

def register_device(client):
    """
    Đăng ký thiết bị qua MQTT topic device/register
    Chỉ cần gửi type cho sensors, server sẽ tự động set unit, name và threshold
    """
    
    # Payload đăng ký
    register_payload = {
        "device_id": DEVICE_ID,  # Device tự tạo ID
        "name": DEVICE_NAME,
        "type": DEVICE_TYPE,  # "esp32", "arduino", etc.
        "ip": "",  # Có thể để trống
        "sensors": [
            # Chỉ cần gửi type và pin, server sẽ tự động set unit, name và threshold
            {"sensor_id": "sensor_01", "type": "temperature", "pin": 4},
            {"sensor_id": "sensor_02", "type": "humidity", "pin": 5},
            {"sensor_id": "sensor_03", "type": "gas", "pin": 34},
            # Hoặc có thể gửi đầy đủ (name, unit sẽ được override nếu không có)
            {"sensor_id": "sensor_04", "type": "light", "name": "Ánh sáng", "unit": "lux", "pin": 6}
        ],
        "actuators": [
            {"actuator_id": "act_01", "type": "relay", "name": "Đèn trần", "pin": 23},
            {"actuator_id": "act_02", "type": "relay", "name": "Quạt", "pin": 22}
        ]
    }
    
    try:
        print(f"📝 Đang đăng ký thiết bị qua MQTT...")
        print(f"   Topic: device/register")
        print(f"   Device ID: {DEVICE_ID}")
        print(f"   Sensors: {len(register_payload['sensors'])} sensors")
        print(f"   (Chỉ gửi type, server tự set unit/name/threshold)")
        
        # Publish đăng ký lên topic device/register
        topic = "device/register"
        message = json.dumps(register_payload)
        
        result = client.publish(topic, message, qos=1)
        
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"✅ Đăng ký thành công!")
            print(f"   Server sẽ tự động tạo sensors với unit, name và threshold")
            time.sleep(2)  # Đợi server xử lý
            return True
        else:
            print(f"❌ Lỗi gửi đăng ký. Error code: {result.rc}")
            return False
            
    except Exception as e:
        print(f"❌ Lỗi đăng ký: {e}")
        return False
```

## 2.2. Các sensor type được hỗ trợ

Server tự động nhận diện các type sau và set unit/name/threshold tương ứng:

| Type | Unit | Name | Min Threshold | Max Threshold |
|------|------|------|---------------|---------------|
| `temperature` | `°C` | `Nhiệt độ` | 10.0 | 40.0 |
| `humidity` | `%` | `Độ ẩm` | 30.0 | 80.0 |
| `gas` | `ppm` | `Khí gas` | None | 100.0 |
| `light` | `lux` | `Ánh sáng` | None | 1000.0 |
| `motion` | `` | `Cảm biến chuyển động` | None | None |

## 2.3. Xử lý kết quả đăng ký

```python
# Trong hàm main(), sau khi kết nối MQTT
registration_success = register_device(client)

if registration_success:
    print("✅ Thiết bị đã đăng ký thành công!")
    print("   Server đã tự động tạo sensors với unit, name và threshold")
    # Tiếp tục gửi dữ liệu
else:
    print("❌ Không thể đăng ký. Dừng chương trình.")
    exit(1)
```

---

# BƯỚC 3: KẾT NỐI MQTT

## Tại sao dùng MQTT?
- Giao tiếp real-time giữa thiết bị và server
- Nhẹ, phù hợp với IoT
- Hỗ trợ QoS (Quality of Service)
- Kết nối an toàn qua TLS/SSL

## 3.1. Cài đặt thư viện

```bash
pip install paho-mqtt requests
```

## 3.2. Code kết nối MQTT

```python
import paho.mqtt.client as mqtt
import ssl
import time

def setup_mqtt_client():
    """
    Tạo và cấu hình MQTT client
    """
    
    # Tạo client với ID duy nhất
    client_id = f"ESP32-{DEVICE_ID}-{int(time.time())}"
    client = mqtt.Client(
        client_id=client_id,
        protocol=mqtt.MQTTv5
    )
    
    # Cấu hình TLS/SSL (bắt buộc với HiveMQ Cloud)
    client.tls_set(
        ca_certs=None,
        certfile=None, 
        keyfile=None,
        cert_reqs=ssl.CERT_NONE,
        tls_version=ssl.PROTOCOL_TLS
    )
    client.tls_insecure_set(True)
    
    # Cấu hình username/password
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    # Gán callback functions
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect  
    client.on_message = on_message
    
    return client

def connect_mqtt(client):
    """
    Kết nối đến MQTT broker
    """
    try:
        print(f"🔌 Đang kết nối MQTT...")
        print(f"   Broker: {MQTT_BROKER}:{MQTT_PORT}")
        print(f"   Client ID: {client._client_id}")
        
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        client.loop_start()  # Bắt đầu loop xử lý message
        
        # Đợi kết nối
        time.sleep(2)
        return True
        
    except Exception as e:
        print(f"❌ Lỗi kết nối MQTT: {e}")
        return False
```

## 3.3. Callback functions

```python
def on_connect(client, userdata, flags, rc, properties=None):
    """
    Được gọi khi kết nối MQTT thành công/thất bại
    """
    if rc == 0:
        print(f"✅ Kết nối MQTT thành công!")
        
        # Subscribe topic để nhận lệnh từ server
        command_topic = f"device/{DEVICE_ID}/command"
        client.subscribe(command_topic, qos=1)
        print(f"📡 Đã subscribe: {command_topic}")
        
        # Gửi thông báo thiết bị online
        send_online_status(client)
        
    else:
        print(f"❌ Kết nối MQTT thất bại, mã lỗi: {rc}")
        if rc == 5:
            print("   → Lỗi xác thực: Kiểm tra username/password")
        elif rc == 1:
            print("   → Lỗi protocol version")

def on_disconnect(client, userdata, rc, properties=None):
    """
    Được gọi khi mất kết nối MQTT
    """
    print(f"⚠️ Mất kết nối MQTT (code: {rc})")
    if rc != 0:
        print("   → Kết nối bị ngắt bất ngờ, sẽ tự động reconnect")

def on_message(client, userdata, msg):
    """
    Được gọi khi nhận được message từ server
    """
    try:
        topic = msg.topic
        payload = msg.payload.decode('utf-8')
        
        print(f"\n📨 Nhận lệnh từ server:")
        print(f"   Topic: {topic}")
        print(f"   Message: {payload}")
        
        # Xử lý lệnh (xem BƯỚC 5)
        process_command(payload)
        
    except Exception as e:
        print(f"❌ Lỗi xử lý message: {e}")
```

---

# BƯỚC 4: GỬI DỮ LIỆU SENSOR

## Thiết bị cần gửi gì?
- Dữ liệu từ các sensors (nhiệt độ, độ ẩm, gas...)
- Trạng thái các actuators (relay, motor...)
- Trạng thái thiết bị (online, battery...)

## 4.1. Format dữ liệu gửi lên

```json
{
  "device_id": "device_01",
  "sensors": [
    {
      "sensor_id": "sensor_01",
      "value": 25.5
    },
    {
      "sensor_id": "sensor_02", 
      "value": 65.2
    }
  ],
  "actuators": [
    {
      "actuator_id": "act_01",
      "state": true
    }
  ]
}
```

## 4.2. Code gửi dữ liệu

```python
import random

# Trạng thái hiện tại của thiết bị
sensor_states = {
    "sensor_01": True,  # Sensor có hoạt động không
    "sensor_02": True,
    "sensor_03": True
}

actuator_states = {
    "act_01": False,  # Trạng thái actuator
    "act_02": False
}

device_enabled = True  # Thiết bị có được bật không

def read_sensors():
    """
    Đọc dữ liệu từ sensors thật
    (Ở đây dùng dữ liệu giả lập)
    """
    sensor_data = {}
    
    if sensor_states.get("sensor_01", False):
        # Đọc nhiệt độ từ sensor thật
        # temperature = read_temperature_sensor()
        temperature = round(25 + random.uniform(-3, 3), 1)
        sensor_data["sensor_01"] = temperature
    
    if sensor_states.get("sensor_02", False):
        # Đọc độ ẩm từ sensor thật  
        # humidity = read_humidity_sensor()
        humidity = round(60 + random.uniform(-10, 10), 1)
        sensor_data["sensor_02"] = humidity
        
    if sensor_states.get("sensor_03", False):
        # Đọc gas từ sensor thật
        # gas = read_gas_sensor() 
        gas = int(200 + random.uniform(-50, 50))
        sensor_data["sensor_03"] = gas
    
    return sensor_data

def send_sensor_data(client):
    """
    Gửi dữ liệu sensor lên server
    """
    if not device_enabled:
        print("⚠️ Thiết bị bị tắt, không gửi dữ liệu")
        return
    
    # Đọc dữ liệu sensors
    sensor_data = read_sensors()
    
    # Tạo payload
    payload = {
        "device_id": DEVICE_ID,
        "sensors": [],
        "actuators": []
    }
    
    # Thêm sensor data
    for sensor_id, value in sensor_data.items():
        payload["sensors"].append({
            "sensor_id": sensor_id,
            "value": value
        })
    
    # Thêm actuator states
    for actuator_id, state in actuator_states.items():
        payload["actuators"].append({
            "actuator_id": actuator_id,
            "state": state
        })
    
    # Gửi qua MQTT
    topic = f"device/{DEVICE_ID}/data"
    message = json.dumps(payload)
    
    result = client.publish(topic, message, qos=1)
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"📤 Đã gửi dữ liệu:")
        print(f"   Sensors: {len(payload['sensors'])}")
        print(f"   Actuators: {len(payload['actuators'])}")
        for sensor in payload['sensors']:
            print(f"      {sensor['sensor_id']}: {sensor['value']}")
    else:
        print(f"❌ Lỗi gửi dữ liệu: {result.rc}")

def send_online_status(client):
    """
    Gửi thông báo thiết bị online
    """
    payload = {"status": "online"}
    topic = f"device/{DEVICE_ID}/status"
    
    client.publish(topic, json.dumps(payload), qos=1)
    print(f"📤 Đã gửi trạng thái online")
```

---

# BƯỚC 5: NHẬN VÀ XỬ LÝ LỆNH TỪ SERVER

## Server có thể gửi lệnh gì?
- Bật/tắt thiết bị
- Bật/tắt từng sensor
- Điều khiển actuators (relay, motor...)
- Cập nhật cấu hình

## 5.1. Format lệnh từ server

```json
{
  "device_enabled": true,
  "sensors": {
    "sensor_01": true,
    "sensor_02": false,
    "sensor_03": true
  },
  "actuators": {
    "act_01": true,
    "act_02": false
  }
}
```

## 5.2. Code xử lý lệnh

```python
def process_command(payload_str):
    """
    Xử lý lệnh từ server
    """
    try:
        # Parse JSON
        command = json.loads(payload_str)
        
        # Xử lý device_enabled
        if "device_enabled" in command:
            global device_enabled
            new_state = command["device_enabled"]
            
            if new_state != device_enabled:
                device_enabled = new_state
                print(f"🔄 Thiết bị {'BẬT' if device_enabled else 'TẮT'}")
                
                if not device_enabled:
                    # Tắt thiết bị → tắt tất cả sensors và actuators
                    turn_off_all_sensors()
                    turn_off_all_actuators()
        
        # Xử lý sensors
        if "sensors" in command and device_enabled:
            sensors_cmd = command["sensors"]
            
            for sensor_id, enabled in sensors_cmd.items():
                if sensor_id in sensor_states:
                    old_state = sensor_states[sensor_id]
                    sensor_states[sensor_id] = enabled
                    
                    if old_state != enabled:
                        print(f"🔄 Sensor {sensor_id}: {'BẬT' if enabled else 'TẮT'}")
                        
                        # Thực hiện hành động thật trên hardware
                        if enabled:
                            enable_sensor_hardware(sensor_id)
                        else:
                            disable_sensor_hardware(sensor_id)
        
        # Xử lý actuators  
        if "actuators" in command and device_enabled:
            actuators_cmd = command["actuators"]
            
            for actuator_id, state in actuators_cmd.items():
                if actuator_id in actuator_states:
                    old_state = actuator_states[actuator_id]
                    actuator_states[actuator_id] = state
                    
                    if old_state != state:
                        print(f"🔄 Actuator {actuator_id}: {'BẬT' if state else 'TẮT'}")
                        
                        # Thực hiện hành động thật trên hardware
                        control_actuator_hardware(actuator_id, state)
        
        print("✅ Xử lý lệnh hoàn tất")
        
    except json.JSONDecodeError as e:
        print(f"❌ Lỗi parse JSON: {e}")
    except Exception as e:
        print(f"❌ Lỗi xử lý lệnh: {e}")

def turn_off_all_sensors():
    """Tắt tất cả sensors"""
    global sensor_states
    for sensor_id in sensor_states:
        sensor_states[sensor_id] = False
        disable_sensor_hardware(sensor_id)
    print("🔴 Đã tắt tất cả sensors")

def turn_off_all_actuators():
    """Tắt tất cả actuators"""
    global actuator_states
    for actuator_id in actuator_states:
        actuator_states[actuator_id] = False
        control_actuator_hardware(actuator_id, False)
    print("🔴 Đã tắt tất cả actuators")

# Hardware control functions (cần implement cho từng loại thiết bị)
def enable_sensor_hardware(sensor_id):
    """Bật sensor trên hardware thật"""
    print(f"   → Hardware: Bật sensor {sensor_id}")
    # GPIO.output(sensor_pins[sensor_id], GPIO.HIGH)

def disable_sensor_hardware(sensor_id):
    """Tắt sensor trên hardware thật"""
    print(f"   → Hardware: Tắt sensor {sensor_id}")
    # GPIO.output(sensor_pins[sensor_id], GPIO.LOW)

def control_actuator_hardware(actuator_id, state):
    """Điều khiển actuator trên hardware thật"""
    print(f"   → Hardware: Actuator {actuator_id} = {state}")
    # GPIO.output(actuator_pins[actuator_id], GPIO.HIGH if state else GPIO.LOW)
```

---

# BƯỚC 6: VÒNG LẶP CHÍNH - DUY TRÌ HOẠT ĐỘNG

## 6.1. Code vòng lặp chính

```python
def main():
    """
    Hàm chính - điều khiển toàn bộ thiết bị
    """
    print("🚀 Khởi động thiết bị IoT")
    print(f"   Device ID: {DEVICE_ID}")
    print(f"   Device Name: {DEVICE_NAME}")
    print("-" * 50)
    
    # BƯỚC 1: Đăng ký thiết bị
    print("\n📝 BƯỚC 1: Đăng ký thiết bị...")
    if not register_device():
        print("❌ Không thể đăng ký. Thoát chương trình.")
        return
    
    # BƯỚC 2: Kết nối MQTT
    print("\n🔌 BƯỚC 2: Kết nối MQTT...")
    client = setup_mqtt_client()
    if not connect_mqtt(client):
        print("❌ Không thể kết nối MQTT. Thoát chương trình.")
        return
    
    # BƯỚC 3: Vòng lặp chính
    print("\n🔄 BƯỚC 3: Bắt đầu hoạt động...")
    print("✅ Thiết bị đã sẵn sàng! Nhấn Ctrl+C để dừng.\n")
    
    # Cấu hình thời gian
    sensor_interval = 5  # Gửi dữ liệu mỗi 5 giây
    status_interval = 30  # In trạng thái mỗi 30 giây
    
    last_sensor_time = 0
    last_status_time = 0
    
    try:
        while True:
            current_time = time.time()
            
            # Gửi dữ liệu sensor định kỳ
            if current_time - last_sensor_time >= sensor_interval:
                send_sensor_data(client)
                last_sensor_time = current_time
            
            # In trạng thái định kỳ
            if current_time - last_status_time >= status_interval:
                print_device_status()
                last_status_time = current_time
            
            # Kiểm tra kết nối MQTT
            if not client.is_connected():
                print("⚠️ Mất kết nối MQTT, đang reconnect...")
                connect_mqtt(client)
            
            time.sleep(1)  # Đợi 1 giây
            
    except KeyboardInterrupt:
        print("\n\n🛑 Đang dừng thiết bị...")
        
        # Gửi thông báo offline
        offline_payload = {"status": "offline"}
        client.publish(f"device/{DEVICE_ID}/status", json.dumps(offline_payload))
        
        # Đóng kết nối
        client.loop_stop()
        client.disconnect()
        
        print("✅ Thiết bị đã dừng an toàn.")
    
    except Exception as e:
        print(f"❌ Lỗi không xác định: {e}")
        import traceback
        traceback.print_exc()

def print_device_status():
    """In trạng thái hiện tại của thiết bị"""
    print("\n" + "="*50)
    print(f"📊 TRẠNG THÁI THIẾT BỊ")
    print("="*50)
    print(f"Device ID: {DEVICE_ID}")
    print(f"Device Enabled: {'🟢 BẬT' if device_enabled else '🔴 TẮT'}")
    
    print("\nSensors:")
    for sensor_id, enabled in sensor_states.items():
        status = "🟢 HOẠT ĐỘNG" if enabled else "🔴 TẮT"
        sensor_name = SENSORS.get(sensor_id, sensor_id)
        print(f"  {sensor_name} ({sensor_id}): {status}")
    
    print("\nActuators:")
    for actuator_id, state in actuator_states.items():
        status = "🟢 BẬT" if state else "🔴 TẮT"
        actuator_name = ACTUATORS.get(actuator_id, actuator_id)
        print(f"  {actuator_name} ({actuator_id}): {status}")
    
    print("="*50 + "\n")

if __name__ == "__main__":
    main()
```

---

# BƯỚC 7: CHẠY THIẾT BỊ

## 7.1. Cài đặt dependencies

```bash
pip install paho-mqtt requests
```

## 7.2. Chạy chương trình

```bash
python your_device_code.py
```

## 7.3. Output mong đợi

```
🚀 Khởi động thiết bị IoT
   Device ID: device_01
   Device Name: ESP32 Living Room
--------------------------------------------------

📝 BƯỚC 1: Đăng ký thiết bị...
🔄 Đang đăng ký thiết bị...
   Device ID: device_01
   Server: http://localhost:8000/iot/device/register
✅ Đăng ký thành công!
   Device ID: device_01
   Device Name: ESP32 Living Room
   Status: active

🔌 BƯỚC 2: Kết nối MQTT...
🔌 Đang kết nối MQTT...
   Broker: 707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud:8883
   Client ID: ESP32-device_01-1703123456
✅ Kết nối MQTT thành công!
📡 Đã subscribe: device/device_01/command
📤 Đã gửi trạng thái online

🔄 BƯỚC 3: Bắt đầu hoạt động...
✅ Thiết bị đã sẵn sàng! Nhấn Ctrl+C để dừng.

📤 Đã gửi dữ liệu:
   Sensors: 3
   Actuators: 2
      sensor_01: 24.8
      sensor_02: 58.3
      sensor_03: 187

📨 Nhận lệnh từ server:
   Topic: device/device_01/command
   Message: {"sensors": {"sensor_01": false}}
🔄 Sensor sensor_01: TẮT
   → Hardware: Tắt sensor sensor_01
✅ Xử lý lệnh hoàn tất
```

---

# TROUBLESHOOTING - XỬ LÝ LỖI

## Lỗi đăng ký thiết bị

### ❌ Không thể kết nối đến server
```
❌ Không thể kết nối đến server: http://localhost:8000
   Kiểm tra server có đang chạy không?
```
**Giải pháp:**
- Kiểm tra backend server có đang chạy không
- Thử ping IP server: `ping 192.168.1.100`
- Kiểm tra firewall có chặn port không

### ❌ Device ID đã tồn tại
```
❌ Đăng ký thất bại: Device ID already exists
```
**Giải pháp:**
- Đổi DEVICE_ID thành giá trị khác
- Hoặc xóa device cũ trong database

## Lỗi kết nối MQTT

### ❌ Return code 5 (Not Authorized)
```
❌ Kết nối MQTT thất bại, mã lỗi: 5
   → Lỗi xác thực: Kiểm tra username/password
```
**Giải pháp:**
- Kiểm tra MQTT_USERNAME và MQTT_PASSWORD
- Vào HiveMQ Console để lấy credentials mới

### ❌ Return code 1 (Protocol version)
```
❌ Kết nối MQTT thất bại, mã lỗi: 1
   → Lỗi protocol version
```
**Giải pháp:**
- Thử đổi protocol: `mqtt.MQTTv311` thay vì `mqtt.MQTTv5`

### ❌ Timeout kết nối
```
❌ Lỗi kết nối MQTT: [Errno 110] Connection timed out
```
**Giải pháp:**
- Kiểm tra internet connection
- Kiểm tra firewall có chặn port 8883 không
- Thử ping broker: `ping 707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud`

## Lỗi gửi/nhận dữ liệu

### ❌ Không nhận được lệnh từ server
**Kiểm tra:**
- Topic subscribe đúng chưa: `device/{DEVICE_ID}/command`
- QoS level (khuyến nghị dùng QoS 1)
- Client có đang connected không

### ❌ Dữ liệu không gửi được
**Kiểm tra:**
- Topic publish đúng chưa: `device/{DEVICE_ID}/data`
- JSON format có hợp lệ không
- Kích thước message có quá lớn không (max 256KB)

---

# TÍCH HỢP VỚI ESP32 THẬT

## Arduino IDE Code

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT credentials
const char* mqtt_server = "707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_username = "ngohai";
const char* mqtt_password = "NgoHai0804";

// Device info
String device_id = "esp32_001";
String device_name = "ESP32 Living Room";

// MQTT client
WiFiClientSecure espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  
  // Connect WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected!");
  
  // Connect MQTT first
  connectMQTT();
  
  // Register device via MQTT (chỉ cần gửi type, server tự set unit/name/threshold)
  if (registerDevice()) {
    Serial.println("Device registered successfully!");
    Serial.println("Server will auto-set unit, name and thresholds for sensors");
  } else {
    Serial.println("Failed to register device!");
    return;
  }
  
  // Setup MQTT (đã connect ở trên)
  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    connectMQTT();
  }
  client.loop();
  
  // Send sensor data every 5 seconds
  static unsigned long lastSend = 0;
  if (millis() - lastSend > 5000) {
    sendSensorData();
    lastSend = millis();
  }
}

bool registerDevice() {
  HTTPClient http;
  http.begin("http://192.168.1.100:8000/iot/device/register");
  http.addHeader("Content-Type", "application/json");
  
  String payload = "{";
  payload += "\"device_id\":\"" + device_id + "\",";
  payload += "\"device_name\":\"" + device_name + "\",";
  payload += "\"device_type\":\"esp32\",";
  payload += "\"note\":\"ESP32 Device\"";
  payload += "}";
  
  int httpResponseCode = http.POST(payload);
  
  if (httpResponseCode == 200) {
    String response = http.getString();
    Serial.println("Registration response: " + response);
    http.end();
    return true;
  } else {
    Serial.println("HTTP Error: " + String(httpResponseCode));
    http.end();
    return false;
  }
}

void connectMQTT() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT...");
    
    String clientId = "ESP32-" + device_id + "-" + String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
      Serial.println("connected");
      
      // Subscribe to command topic
      String commandTopic = "device/" + device_id + "/command";
      client.subscribe(commandTopic.c_str());
      
      // Send online status
      String statusTopic = "device/" + device_id + "/status";
      client.publish(statusTopic.c_str(), "{\"status\":\"online\"}");
      
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.println("Received: " + message);
  
  // Parse JSON and process command
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, message);
  
  if (doc.containsKey("device_enabled")) {
    bool enabled = doc["device_enabled"];
    Serial.println("Device enabled: " + String(enabled));
    // Control device hardware
  }
  
  if (doc.containsKey("actuators")) {
    JsonObject actuators = doc["actuators"];
    for (JsonPair kv : actuators) {
      String actuator_id = kv.key().c_str();
      bool state = kv.value();
      Serial.println("Actuator " + actuator_id + ": " + String(state));
      // Control actuator hardware
    }
  }
}

void sendSensorData() {
  DynamicJsonDocument doc(1024);
  doc["device_id"] = device_id;
  
  JsonArray sensors = doc.createNestedArray("sensors");
  
  // Read temperature sensor
  float temperature = 25.0 + random(-30, 30) / 10.0;
  JsonObject sensor1 = sensors.createNestedObject();
  sensor1["sensor_id"] = "sensor_01";
  sensor1["value"] = temperature;
  
  // Read humidity sensor  
  float humidity = 60.0 + random(-100, 100) / 10.0;
  JsonObject sensor2 = sensors.createNestedObject();
  sensor2["sensor_id"] = "sensor_02";
  sensor2["value"] = humidity;
  
  JsonArray actuators = doc.createNestedArray("actuators");
  JsonObject actuator1 = actuators.createNestedObject();
  actuator1["actuator_id"] = "act_01";
  actuator1["state"] = false;
  
  String payload;
  serializeJson(doc, payload);
  
  String dataTopic = "device/" + device_id + "/data";
  client.publish(dataTopic.c_str(), payload.c_str());
  
  Serial.println("Sent: " + payload);
}
```

---

# KẾT LUẬN

Thiết bị IoT mới cần thực hiện đúng trình tự:

1. **Chuẩn bị thông tin** - Device ID, server URL, MQTT credentials
2. **Đăng ký với hệ thống** - HTTP POST để tạo record trong database  
3. **Kết nối MQTT** - TLS/SSL connection với HiveMQ Cloud
4. **Gửi dữ liệu** - Định kỳ gửi sensor data lên server
5. **Nhận lệnh** - Subscribe topic và xử lý command từ server
6. **Duy trì kết nối** - Reconnect khi mất kết nối, heartbeat

Thiết bị hoạt động hoàn toàn tự động sau khi được cấu hình ban đầu. Hệ thống hỗ trợ nhiều thiết bị cùng lúc và có thể mở rộng dễ dàng.