# Hướng dẫn cấu hình MQTT với HiveMQ Cloud

## Lỗi Return Code 5 - Not Authorized

Lỗi này xảy ra khi thiếu hoặc sai thông tin xác thực (username/password) cho HiveMQ Cloud.

## Các bước khắc phục:

### 1. Lấy Username và Password từ HiveMQ Cloud Console

1. Truy cập: https://console.hivemq.cloud/
2. Đăng nhập vào tài khoản của bạn
3. Chọn Cluster của bạn
4. Vào **Access Management** (hoặc **Credentials**)
5. Tạo credentials mới hoặc xem credentials hiện có
6. Copy **Username** và **Password**

### 2. Cấu hình trong Backend

**Cách 1: Sử dụng file .env (Khuyến nghị)**

Tạo file `.env` trong thư mục `backend/` với nội dung:

```env
MQTT_BROKER=707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=your_username_from_hivemq_console
MQTT_PASSWORD=your_password_from_hivemq_console
```

**Cách 2: Cập nhật trực tiếp trong code**

Mở file `backend/utils/mqtt_client.py` và cập nhật:

```python
MQTT_USERNAME = "your_username_from_hivemq_console"
MQTT_PASSWORD = "your_password_from_hivemq_console"
```

### 3. Khởi động lại server

```bash
cd backend
uvicorn main:app --reload
```

## Kiểm tra kết nối

Khi kết nối thành công, bạn sẽ thấy log:

```
✅ Connected to MQTT broker successfully
📡 Subscribed to topics:
   - iot/device/+/data (QoS 1) - Format cũ
   - iot/device/+/status (QoS 1) - Format cũ
   - device/+/sensor/+/data (QoS 1) - Format mới
   - device/+/status (QoS 1) - Format mới
```

## Kiến trúc hệ thống

```
Frontend (Web/App)
    |
    |  HTTPS (REST / WebSocket)
    v
Backend / API Server
    |
    |  MQTT (Command)
    v
IoT Device (ESP32)
    |
    |  MQTT (Status)
    v
Backend
```

## MQTT Topics

### Topics Backend Subscribe (Nhận từ thiết bị):

- `iot/device/{device_id}/data` - Nhận dữ liệu sensor (format cũ)
- `iot/device/{device_id}/status` - Nhận trạng thái thiết bị (format cũ)
- `device/{device_id}/sensor/{sensor_id}/data` - Nhận dữ liệu sensor (format mới)
- `device/{device_id}/status` - Nhận trạng thái thiết bị (format mới)

### Topics Backend Publish (Gửi đến thiết bị):

- `device/{device_id}/command` - Gửi lệnh điều khiển đến thiết bị

## Format Message

### Sensor Data (từ thiết bị):
**Format cũ** (`iot/device/{device_id}/data`):
```json
{
  "sensor_id": "sensor_001",
  "value": 25.5,
  "type": "temperature",
  "name": "Temperature Sensor"
}
```

**Format mới** (`device/{device_id}/sensor/{sensor_id}/data`):
```json
{
  "value": 25.5,
  "unit": "°C"
}
```

### Device Status (từ thiết bị):
```json
{
  "status": "online",
  "battery": 75,
  "cloud_status": "on"
}
```

### Command (gửi đến thiết bị):
```json
{
  "action": "set_cloud_status",
  "cloud_status": "on"
}
```

Hoặc các command khác:
```json
{
  "action": "turn_on",
  "params": {}
}
```

## Troubleshooting

### Lỗi Return Code 4 hoặc 5:
- Kiểm tra lại username và password
- Đảm bảo credentials còn hiệu lực
- Kiểm tra cluster đang hoạt động

### Lỗi kết nối:
- Kiểm tra firewall có chặn port 8883 không
- Kiểm tra internet connection
- Thử ping đến broker: `ping 707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud`

