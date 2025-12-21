# Luồng Đăng Ký Thiết Bị

## 📋 Tổng Quan

Khi ESP32 boot, nó sẽ tự động đăng ký với server qua MQTT. Server sẽ kiểm tra và tạo device trong database nếu chưa có.

## 🔄 Luồng Hoạt Động

```
ESP32 Boot
   ↓
Publish device/register
   ↓
Server nhận và xử lý
   ↓
Kiểm tra device đã tồn tại?
   ├─ Có → Cập nhật thông tin
   └─ Không → Tạo device mới
   ↓
Tạo/Cập nhật Room nếu cần
   ↓
Tạo Sensors và Actuators
   ↓
Gửi response: device/{device_id}/register/response
   ↓
ESP32 nhận response
   ↓
Bắt đầu gửi telemetry
```

## 📡 MQTT Topics

### Đăng ký
- **Topic:** `device/register`
- **QoS:** 1
- **Direction:** ESP32 → Server

### Response
- **Topic:** `device/{device_id}/register/response`
- **QoS:** 1
- **Direction:** Server → ESP32

## 📦 Format Message

### Register Request (ESP32 → Server)

```json
{
  "device_id": "device_01",  // Optional: để trống để server tự tạo
  "name": "ESP32 Phòng Khách",
  "type": "esp32",
  "room_name": "Phòng khách",  // Tên phòng (sẽ tạo nếu chưa có)
  "ip": "192.168.1.20",
  "sensors": [
    {
      "sensor_id": "sensor_01",
      "type": "temperature",
      "name": "Nhiệt độ",
      "unit": "°C",
      "pin": 4
    },
    {
      "sensor_id": "sensor_02",
      "type": "humidity",
      "name": "Độ ẩm",
      "unit": "%",
      "pin": 4
    }
  ],
  "actuators": [
    {
      "actuator_id": "act_01",
      "type": "relay",
      "name": "Đèn trần",
      "pin": 23
    }
  ]
}
```

### Register Response (Server → ESP32)

```json
{
  "status": "success",
  "device_id": "device_01",
  "room_id": "room_01",
  "message": "Device registered successfully"
}
```

## 🔧 Xử Lý Trên Server

1. **Nhận register message** từ topic `device/register`
2. **Kiểm tra/Create Room:**
   - Tìm room theo `room_name`
   - Nếu chưa có → tạo room mới
3. **Kiểm tra/Create Device:**
   - Nếu có `device_id` → kiểm tra đã tồn tại chưa
   - Nếu chưa có → tạo device mới
   - Nếu đã có → cập nhật thông tin
4. **Tạo Sensors:**
   - Duyệt qua danh sách sensors
   - Tạo sensor nếu chưa tồn tại
5. **Tạo Actuators:**
   - Duyệt qua danh sách actuators
   - Tạo actuator nếu chưa tồn tại
6. **Gửi response** về ESP32

## ✅ Lợi Ích

1. **Tự động hóa:** ESP32 tự đăng ký khi boot, không cần cấu hình thủ công
2. **Linh hoạt:** Có thể chỉ định `device_id` hoặc để server tự tạo
3. **Đầy đủ:** Tự động tạo room, sensors, actuators trong một lần
4. **An toàn:** Kiểm tra device đã tồn tại trước khi tạo mới

## 🧪 Test

1. Chạy simulator: `python esp32_simulator.py`
2. Kiểm tra log:
   - Simulator gửi register
   - Server nhận và xử lý
   - Server gửi response
   - Simulator nhận response
3. Kiểm tra database:
   - Device được tạo/cập nhật
   - Room được tạo nếu chưa có
   - Sensors và Actuators được tạo
