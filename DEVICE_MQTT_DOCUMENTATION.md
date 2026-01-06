# Tài liệu MQTT cho Thiết bị IoT

Tài liệu này mô tả chi tiết cách thiết bị IoT (ESP32, Arduino, v.v.) giao tiếp với hệ thống qua MQTT.

**Phiên bản:** 2.0  
**Cập nhật:** Hỗ trợ sensor binary (PIR motion, IR obstacle)

---

## 1. Thông tin Server và MQTT Broker

### 1.1. MQTT Broker

**HiveMQ Cloud Broker:**
- **Broker Address:** `707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud`
- **Port:** `8883` (TLS/SSL)
- **Protocol:** MQTT v3.1.1 hoặc v5.0
- **Security:** TLS/SSL (bắt buộc)
- **Authentication:** Username/Password (bắt buộc)

**Lấy Credentials:**
1. Truy cập: https://console.hivemq.cloud/
2. Đăng nhập vào tài khoản
3. Chọn Cluster của bạn
4. Vào **Access Management** → **Credentials**
5. Tạo hoặc xem credentials hiện có
6. Copy **Username** và **Password**

### 1.2. Backend Server

**API Base URL:**
- Development: `http://localhost:8000`
- Production: `https://iot-20251.onrender.com`

**Timezone:** UTC+7 (Vietnam)

---

## 2. Các MQTT Topics

### 2.1. Topics Device Publish (Gửi lên Server)

| Topic | Mô tả | QoS | Retain |
|-------|-------|-----|--------|
| `device/register` | Đăng ký thiết bị với hệ thống | 1 | false |
| `device/{device_id}/data` | Gửi dữ liệu sensor và actuator | 1 | false |
| `device/{device_id}/lwt` | Last Will and Testament (tự động) | 1 | false |

### 2.2. Topics Device Subscribe (Nhận từ Server)

| Topic | Mô tả | QoS |
|-------|-------|-----|
| `device/{device_id}/command` | Nhận lệnh điều khiển từ server | 1 |
| `device/{device_id}/register/response` | Nhận phản hồi đăng ký | 1 |

---

## 3. Payload Formats

### 3.1. Đăng ký Thiết bị (`device/register`)

**Device → Server**

```json
{
  "device_id": "device_01",
  "name": "ESP32 Phòng Khách",
  "type": "esp32",
  "ip": "192.168.1.20",
  "sensors": [
    {
      "sensor_id": "sensor_01",
      "type": "temperature",
      "pin": 4
    },
    {
      "sensor_id": "sensor_02",
      "type": "humidity",
      "pin": 5
    },
    {
      "sensor_id": "sensor_03",
      "type": "gas",
      "pin": 34
    },
    {
      "sensor_id": "sensor_04",
      "type": "motion",
      "pin": 27
    },
    {
      "sensor_id": "sensor_05",
      "type": "obstacle",
      "pin": 33
    }
  ],
  "actuators": [
    {
      "actuator_id": "act_01",
      "type": "relay",
      "name": "Đèn trần",
      "pin": 23
    },
    {
      "actuator_id": "act_02",
      "type": "relay",
      "name": "Quạt",
      "pin": 22
    }
  ]
}
```

**Lưu ý quan trọng:**
- Chỉ cần gửi `type` cho sensors, server sẽ tự động:
  - Set `unit` (ví dụ: "°C" cho temperature, "%" cho humidity)
  - Set `name` (ví dụ: "Nhiệt độ" cho temperature, "Độ ẩm" cho humidity)
  - Set `threshold` (chỉ cho sensor analog, không áp dụng cho sensor binary)
- `device_id`: Thiết bị tự tạo ID duy nhất (không trùng với thiết bị khác)
- `sensor_id`: ID duy nhất cho mỗi sensor trong device
- `actuator_id`: ID duy nhất cho mỗi actuator trong device

**Các Sensor Types được hỗ trợ:**

| Type | Unit | Name | Min Threshold | Max Threshold | Loại |
|------|------|------|----------------|---------------|------|
| `temperature` | `°C` | `Nhiệt độ` | 10.0 | 40.0 | Analog |
| `humidity` | `%` | `Độ ẩm` | 30.0 | 80.0 | Analog |
| `gas` | `ppm` | `Khí gas` | None | 100.0 | Analog |
| `motion` | - | `Cảm biến chuyển động` | None | None | Binary (0/1) |
| `obstacle` | - | `Cảm biến vật cản` | None | None | Binary (0/1) |

**Lưu ý về Sensor Binary:**
- Sensor binary (`motion`, `obstacle`) chỉ trả về giá trị 0 hoặc 1
- Không có threshold (ngưỡng) cho sensor binary
- Frontend sẽ không hiển thị tùy chọn cài đặt threshold cho sensor binary
- Giá trị gửi lên phải là số nguyên: 0 (không phát hiện) hoặc 1 (phát hiện)

**Response từ Server (`device/{device_id}/register/response`):**

```json
{
  "status": "success",
  "device_id": "device_01",
  "message": "Device registered successfully"
}
```

---

### 3.2. Gửi Dữ liệu Sensor và Actuator (`device/{device_id}/data`)

**Device → Server**

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
    },
    {
      "sensor_id": "sensor_03",
      "value": 187
    },
    {
      "sensor_id": "sensor_04",
      "type": "motion",
      "value": 1
    },
    {
      "sensor_id": "sensor_05",
      "type": "obstacle",
      "value": 0
    }
  ],
  "actuators": [
    {
      "actuator_id": "act_01",
      "state": true
    },
    {
      "actuator_id": "act_02",
      "state": false
    }
  ]
}
```

**Xử lý của Server:**
1. Cập nhật `status = "online"` và `last_seen` cho device
2. Lưu dữ liệu sensor vào `sensor_data` collection
3. Cập nhật `state` của actuators
4. Tự động tạo sensor/actuator nếu chưa tồn tại
5. Kiểm tra ngưỡng và tạo notification nếu vượt quá (chỉ cho sensor analog)

**Lưu ý:**
- Gửi định kỳ (khuyến nghị: mỗi 5-10 giây)
- Chỉ gửi sensors đang enabled
- `value` phải là số (float hoặc int)
  - **Sensor analog** (temperature, humidity, gas): giá trị số thực (ví dụ: 25.5, 65.2, 187)
  - **Sensor binary** (`motion`, `obstacle`): chỉ 0 hoặc 1 (số nguyên)
    - `0`: Không phát hiện (ví dụ: không có chuyển động, không có vật cản)
    - `1`: Phát hiện (ví dụ: có chuyển động, có vật cản)
- Sensor binary có thể gửi kèm trường `type` trong payload để server xác định loại sensor
- `state` của actuator là boolean (true/false)
- Sensor binary không có threshold, server sẽ không kiểm tra ngưỡng
- Frontend sẽ hiển thị biểu đồ cho sensor binary với giá trị 0/1

**Ví dụ gửi dữ liệu cho sensor binary:**

```json
{
  "sensor_id": "sensor_04",
  "type": "motion",
  "value": 1
}
```

hoặc

```json
{
  "sensor_id": "sensor_05",
  "type": "obstacle",
  "value": 0
}
```

---

### 3.3. Nhận Lệnh Điều khiển (`device/{device_id}/command`)

**Server → Device**

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

**Xử lý của Device:**
1. **`device_enabled`**: Bật/tắt toàn bộ thiết bị
   - Nếu `false`: Tắt tất cả sensors và actuators
   - Nếu `true`: Bật lại theo cấu hình

2. **`sensors`**: Bật/tắt từng sensor
   - Key: `sensor_id`
   - Value: `true` (bật) hoặc `false` (tắt)

3. **`actuators`**: Điều khiển trạng thái actuator
   - Key: `actuator_id`
   - Value: `true` (bật) hoặc `false` (tắt)

**Xử lý của Device:**
- Parse JSON payload
- Kiểm tra `device_enabled`: nếu `false` thì tắt tất cả sensors và actuators
- Duyệt qua `sensors` object và cập nhật trạng thái từng sensor
- Duyệt qua `actuators` object và điều khiển trạng thái từng actuator
- Thực hiện các hành động tương ứng trên hardware (GPIO, relay, v.v.)

---

### 3.4. Last Will and Testament (LWT)

**Topic:** `device/{device_id}/lwt`

**Payload:**
```json
{
  "status": "offline"
}
```

**Cách thiết lập:**
- Khi kết nối MQTT, thiết lập Last Will and Testament với:
  - Topic: `device/{device_id}/lwt`
  - Payload: `{"status": "offline"}`
  - QoS: 1
  - Retain: false
- Sử dụng hàm `will_set()` hoặc tương đương trong thư viện MQTT của bạn

**Xử lý của Server:**
- Khi device disconnect bất thường, broker tự động publish LWT message
- Server nhận được và cập nhật `status = "offline"` ngay lập tức
- Không cần device gửi status message thủ công

---

## 4. Hướng xử lý và Flow

### 4.1. Quy trình Kết nối và Đăng ký

```
1. Kết nối WiFi
   ↓
2. Kết nối MQTT Broker (TLS/SSL)
   - Broker: 707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud:8883
   - Username/Password từ HiveMQ Console
   - Thiết lập LWT
   ↓
3. Subscribe topic: device/{device_id}/command
   ↓
4. Publish đăng ký: device/register
   - Payload: device_id, name, type, sensors[], actuators[]
   ↓
5. Nhận response: device/{device_id}/register/response
   - Kiểm tra status = "success"
   ↓
6. Bắt đầu gửi dữ liệu định kỳ: device/{device_id}/data
```

### 4.2. Vòng lặp Hoạt động

```
WHILE device_enabled:
    IF (current_time - last_send_time >= interval):
        # Đọc dữ liệu từ sensors
        sensor_data = read_sensors()
        
        # Đọc trạng thái actuators
        actuator_states = read_actuators()
        
        # Gửi lên server
        publish("device/{device_id}/data", {
            "device_id": DEVICE_ID,
            "sensors": sensor_data,
            "actuators": actuator_states
        })
        
        last_send_time = current_time
    
    # Xử lý lệnh từ server (trong callback on_message)
    IF received_command:
        process_command(received_command)
    
    # Kiểm tra kết nối
    IF not mqtt_connected:
        reconnect_mqtt()
    
    delay(1 second)
```

### 4.3. Xử lý Lệnh từ Server

```
ON_MESSAGE(topic = "device/{device_id}/command"):
    command = parse_json(payload)
    
    IF command.device_enabled == false:
        # Tắt toàn bộ thiết bị
        FOR EACH sensor IN sensors:
            disable_sensor(sensor)
        FOR EACH actuator IN actuators:
            turn_off_actuator(actuator)
        RETURN
    
    # Xử lý sensors
    FOR EACH (sensor_id, enabled) IN command.sensors:
        IF enabled:
            enable_sensor(sensor_id)
        ELSE:
            disable_sensor(sensor_id)
    
    # Xử lý actuators
    FOR EACH (actuator_id, state) IN command.actuators:
        IF state:
            turn_on_actuator(actuator_id)
        ELSE:
            turn_off_actuator(actuator_id)
```

### 4.4. Xử lý Mất Kết nối

```
ON_DISCONNECT():
    # Broker tự động publish LWT message
    # Server sẽ cập nhật status = "offline"
    
    # Device tự động reconnect
    WHILE not connected:
        delay(5 seconds)
        reconnect_mqtt()
        IF connected:
            # Resubscribe topics
            subscribe("device/{device_id}/command")
            # Gửi lại đăng ký nếu cần
            register_device()
            BREAK
```

---

## 5. Hướng dẫn Triển khai

### 5.1. Kết nối MQTT

**Các bước:**
1. Khởi tạo MQTT client với client_id duy nhất
2. Thiết lập TLS/SSL (bắt buộc cho HiveMQ Cloud)
3. Thiết lập username/password authentication
4. Thiết lập Last Will and Testament (LWT)
5. Kết nối đến broker với keepalive = 60 giây
6. Subscribe topic `device/{device_id}/command`

**Lưu ý:**
- Sử dụng thư viện MQTT phù hợp với platform (Arduino: PubSubClient, ESP32: AsyncMQTTClient, Python: paho-mqtt, v.v.)
- Đảm bảo hỗ trợ TLS/SSL và MQTT v3.1.1 hoặc v5.0

### 5.2. Đăng ký Thiết bị

**Các bước:**
1. Tạo JSON payload với thông tin device, sensors, actuators
2. Publish lên topic `device/register` với QoS 1
3. Đợi response từ topic `device/{device_id}/register/response`
4. Kiểm tra `status = "success"`

**Lưu ý:**
- Chỉ cần gửi `type` cho sensors, server tự động set unit, name và threshold
- `device_id` phải là string duy nhất

### 5.3. Gửi Dữ liệu

**Các bước:**
1. Đọc dữ liệu từ sensors (GPIO, ADC, I2C, SPI, v.v.)
2. Đọc trạng thái hiện tại của actuators
3. Tạo JSON payload với format đúng
4. Publish lên topic `device/{device_id}/data` với QoS 1
5. Lặp lại định kỳ (mỗi 5-10 giây)

**Lưu ý:**
- Chỉ gửi sensors đang enabled
- `value` phải là số (float hoặc int)
- `state` của actuator là boolean

### 5.4. Xử lý Lệnh

**Các bước:**
1. Trong callback `on_message`, parse JSON payload
2. Kiểm tra `device_enabled`: nếu `false` thì tắt toàn bộ
3. Duyệt qua `sensors` và cập nhật trạng thái từng sensor
4. Duyệt qua `actuators` và điều khiển trạng thái từng actuator
5. Thực hiện các hành động tương ứng trên hardware

**Lưu ý:**
- Xử lý lệnh ngay khi nhận được, không delay
- Cập nhật trạng thái actuators và gửi lại trong lần gửi dữ liệu tiếp theo

---

## 6. Troubleshooting

### 6.1. Lỗi Kết nối MQTT

**Return Code 5 (Not Authorized):**
- Kiểm tra username/password từ HiveMQ Console
- Đảm bảo credentials còn hiệu lực

**Return Code 1 (Protocol Version):**
- Thử đổi protocol version (MQTT v3.1.1 thay vì v5.0)

**Timeout:**
- Kiểm tra internet connection
- Kiểm tra firewall có chặn port 8883 không

### 6.2. Không Nhận được Lệnh

- Kiểm tra đã subscribe đúng topic: `device/{device_id}/command`
- Kiểm tra QoS level (khuyến nghị: QoS 1)
- Kiểm tra client có đang connected không

### 6.3. Dữ liệu Không Gửi được

- Kiểm tra topic đúng: `device/{device_id}/data`
- Kiểm tra JSON format hợp lệ
- Kiểm tra kích thước message (max 256KB)

### 6.4. Device Không Hiển thị Online

- Kiểm tra đã gửi dữ liệu định kỳ (mỗi 5-10 giây)
- Kiểm tra LWT đã được thiết lập chưa
- Kiểm tra server có nhận được message không

---

## 7. Best Practices

1. **Keepalive:** Đặt keepalive = 60 giây
2. **QoS:** Sử dụng QoS 1 cho tất cả messages (đảm bảo delivery)
3. **LWT:** Luôn thiết lập Last Will and Testament
4. **Reconnect:** Tự động reconnect khi mất kết nối
5. **Interval:** Gửi dữ liệu định kỳ (5-10 giây)
6. **Error Handling:** Xử lý lỗi và retry khi cần
7. **Logging:** Log các hoạt động quan trọng để debug

---

## 8. Tóm tắt

| Hoạt động | Topic | Direction | QoS |
|-----------|-------|-----------|-----|
| Đăng ký | `device/register` | Device → Server | 1 |
| Response đăng ký | `device/{device_id}/register/response` | Server → Device | 1 |
| Gửi dữ liệu | `device/{device_id}/data` | Device → Server | 1 |
| Nhận lệnh | `device/{device_id}/command` | Server → Device | 1 |
| LWT | `device/{device_id}/lwt` | Auto (Broker) | 1 |

**Lưu ý quan trọng:**
- Server tự động tạo sensors với unit, name và threshold dựa trên `type`
- Device chỉ cần gửi `type` khi đăng ký sensors
- Sensor binary (`motion`, `obstacle`) không có threshold và unit
- Khi gửi dữ liệu, sensor binary có thể gửi kèm trường `type` để đảm bảo server xác định đúng loại
- LWT tự động phát hiện disconnect, không cần gửi status message thủ công
- Gửi dữ liệu định kỳ để cập nhật `last_seen` và `status = "online"`
- Frontend sẽ hiển thị biểu đồ cho tất cả sensors, bao gồm cả sensor binary (với giá trị 0/1)

