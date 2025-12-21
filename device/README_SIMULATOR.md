# ESP32 Device Simulator - Hướng Dẫn Sử Dụng

## 📋 Mô Tả

Script Python giả lập thiết bị ESP32 để test hệ thống trước khi dùng thiết bị thật.

## 🚀 Cài Đặt

### 1. Cài đặt Python dependencies

```bash
pip install -r requirements.txt
```

Hoặc:

```bash
pip install paho-mqtt
```

### 2. Cấu hình

Mở file `esp32_simulator.py` và cập nhật các thông tin sau:

```python
# MQTT Credentials
MQTT_USERNAME = "YOUR_MQTT_USERNAME"  # Thay bằng username thật
MQTT_PASSWORD = "YOUR_MQTT_PASSWORD"  # Thay bằng password thật

# Device ID (phải khớp với database)
DEVICE_ID = "device_01"

# Sensor IDs (phải khớp với database)
SENSOR_TEMP_ID = "sensor_01"
SENSOR_HUMIDITY_ID = "sensor_02"
SENSOR_GAS_ID = "sensor_03"

# Actuator IDs (phải khớp với database)
ACTUATOR_RELAY1_ID = "act_01"
ACTUATOR_RELAY2_ID = "act_02"
```

## 🎯 Chạy Simulator

```bash
python esp32_simulator.py
```

## 📡 Hoạt Động

### Gửi Dữ Liệu

Simulator sẽ tự động gửi dữ liệu sensor mỗi 5 giây:

```json
{
  "device_id": "device_01",
  "sensors": [
    { "sensor_id": "sensor_01", "value": 25.5 },
    { "sensor_id": "sensor_02", "value": 60.2 },
    { "sensor_id": "sensor_03", "value": 200 }
  ],
  "actuators": [
    { "actuator_id": "act_01", "state": false },
    { "actuator_id": "act_02", "state": false }
  ]
}
```

### Nhận Lệnh

Simulator sẽ lắng nghe lệnh từ server trên topic:
- `device/{device_id}/command`

Format lệnh:
```json
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
```

## 🔧 Tính Năng

1. **Giả lập Sensors:**
   - Nhiệt độ: 20-30°C (biến động ngẫu nhiên)
   - Độ ẩm: 50-70% (biến động ngẫu nhiên)
   - Gas: 100-300 ppm (biến động ngẫu nhiên)

2. **Điều khiển từ Server:**
   - Bật/tắt device
   - Bật/tắt từng sensor
   - Điều khiển actuators

3. **Hiển thị Status:**
   - In trạng thái mỗi 30 giây
   - Hiển thị giá trị sensors và actuators

## 📊 Output Mẫu

```
🚀 ESP32 Device Simulator
Device ID: device_01
MQTT Broker: 707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud:8883
--------------------------------------------------
🔌 Connecting to MQTT broker...
✅ Connected to MQTT broker
📡 Subscribed to: device/device_01/command
📤 Published status to device/device_01/status

✅ Simulator started! Press Ctrl+C to stop.

📤 Published to device/device_01/data:
   Sensors: 3
   Actuators: 2
      - sensor_01: 25.3
      - sensor_02: 61.5
      - sensor_03: 198

📨 Received message on topic: device/device_01/command
   Payload: {"device_enabled": true, "sensors": {"sensor_01": true}, "actuators": {"act_01": true}}
   Device enabled: True
   Sensor sensor_01 enabled: True
   Actuator act_01 state: True

==================================================
📊 Device Status: device_01
==================================================
Device Enabled: True

Sensors:
  - sensor_01: 🟢 ON (value: 25.3)
  - sensor_02: 🟢 ON (value: 61.5)
  - sensor_03: 🟢 ON (value: 198)

Actuators:
  - act_01: 🟢 ON
  - act_02: 🔴 OFF
==================================================
```

## ⚠️ Lưu Ý

1. **Device ID phải khớp với database:** Đảm bảo `DEVICE_ID`, `SENSOR_*_ID`, `ACTUATOR_*_ID` khớp với dữ liệu trong MongoDB.

2. **MQTT Credentials:** Phải có username và password hợp lệ từ HiveMQ Cloud.

3. **Network:** Đảm bảo có kết nối internet và có thể kết nối đến MQTT broker.

## 🧪 Test

1. Chạy simulator
2. Kiểm tra backend nhận được dữ liệu
3. Thử điều khiển từ frontend/API:
   - Bật/tắt device: `POST /devices/device_01/power`
   - Bật/tắt sensor: `POST /sensors/sensor_01/enable`
   - Điều khiển actuator: `POST /actuators/act_01/control`
4. Kiểm tra simulator nhận được lệnh và phản hồi

## 🐛 Troubleshooting

### Không kết nối được MQTT
- Kiểm tra username/password
- Kiểm tra kết nối internet
- Kiểm tra firewall

### Không nhận được lệnh
- Kiểm tra device_id có đúng không
- Kiểm tra backend có gửi lệnh không
- Kiểm tra MQTT topic

### Dữ liệu không được lưu
- Kiểm tra device_id có tồn tại trong database không
- Kiểm tra sensor_id, actuator_id có đúng không
- Kiểm tra backend MQTT client có xử lý đúng không
