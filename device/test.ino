/*
 * ESP32 Smart Home Device
 * Tích hợp với hệ thống IoT qua MQTT
 * 
 * Chức năng:
 * - Kết nối WiFi (tự động hoặc setup mode)
 * - Kết nối MQTT với TLS/SSL
 * - Đăng ký thiết bị qua MQTT
 * - Gửi dữ liệu sensor/actuator định kỳ
 * - Nhận và xử lý lệnh từ server
 * - Last Will and Testament (LWT)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WebServer.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ==================== CẤU HÌNH MQTT ====================
#define MQTT_BROKER "707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883
#define MQTT_USERNAME "ngohai"
#define MQTT_PASSWORD "NgoHai0804"
#define MQTT_MAX_PACKET_SIZE 2048

// ==================== CẤU HÌNH THIẾT BỊ ====================
String DEVICE_ID = "device_01";  // Device tự tạo ID duy nhất
String DEVICE_NAME = "ESP32 Smart Home";
String DEVICE_TYPE = "esp32";

// ==================== CẤU HÌNH SENSORS ====================
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

#define PIR_PIN 27
#define IR_PIN 33

// Sensor IDs
String SENSOR_TEMP_ID = "sensor_01";
String SENSOR_HUMIDITY_ID = "sensor_02";
String SENSOR_PIR_ID = "sensor_03";
String SENSOR_IR_ID = "sensor_04";

// ==================== CẤU HÌNH ACTUATORS ====================
#define LED_PIR_PIN 26
#define LED_IR_PIN 32

// Actuator IDs
String ACTUATOR_RELAY_ID = "act_01";
String ACTUATOR_LED_IR_ID = "act_02";

// ==================== CẤU HÌNH OLED ====================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
bool oledEnabled = true;

// ==================== CẤU HÌNH THỜI GIAN ====================
const unsigned long DHT_INTERVAL = 2000;      // Đọc DHT mỗi 2 giây
const unsigned long MQTT_DATA_INTERVAL = 5000; // Gửi dữ liệu MQTT mỗi 5 giây
const unsigned long OLED_INTERVAL = 1000;      // Cập nhật OLED mỗi 1 giây
const unsigned long WIFI_CONNECT_TIMEOUT = 30000;
const unsigned long WIFI_LOST_TIMEOUT = 30000;

unsigned long lastDHT = 0;
unsigned long lastMQTT = 0;
unsigned long lastOLED = 0;

// ==================== BIẾN TRẠNG THÁI ====================
float temperature = NAN;
float humidity = NAN;
bool pirState = false;
bool irState = false;

bool deviceEnabled = true;
bool sensorStates[4] = {true, true, true, true}; // temp, humidity, pir, ir
bool actuatorStates[2] = {false, false};         // relay, led_ir

bool mqttConnected = false;
bool deviceRegistered = false;
bool mqttRegisterSent = false;

// ==================== WIFI SETUP MODE ====================
const char *AP_SSID = "ESP32_AP";
const char *AP_PASSWORD = "12345678";
bool isSetupMode = false;
bool wasConnected = false;
unsigned long wifiLostTime = 0;

WebServer server(80);
Preferences prefs;

// Form HTML cho WiFi setup
const char *htmlForm = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ESP32 WiFi Setup</title>
  <style>
    body { font-family: Arial; margin: 40px; }
    input { padding:8px; margin:6px 0; width: 100%; box-sizing: border-box; }
    button { padding:10px; background: #4CAF50; color: white; border: none; cursor: pointer; }
    .container { max-width:400px; margin:auto; }
  </style>
</head>
<body>
  <div class="container">
    <h2>WiFi Setup</h2>
    <form action="/connect" method="post">
      <label>SSID:</label>
      <input type="text" name="ssid" required>
      <label>Password:</label>
      <input type="password" name="password">
      <button type="submit">Connect</button>
    </form>
  </div>
</body>
</html>
)rawliteral";

// ==================== MQTT CLIENT ====================
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

// ==================== HÀM WIFI ====================

/**
 * Xử lý request root (hiển thị form)
 */
void handleRoot() {
  server.send(200, "text/html", htmlForm);
}

/**
 * Xử lý request connect WiFi
 */
void handleConnect() {
  if (server.method() != HTTP_POST) {
    server.send(405, "text/plain", "Method Not Allowed");
    return;
  }

  String ssid = server.arg("ssid");
  String password = server.arg("password");

  server.send(200, "text/html", "<html><body><h3>Connecting to " + ssid + "...</h3></body></html>");

  // Lưu credentials
  prefs.begin("wifi", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", password);
  prefs.end();

  // Kết nối WiFi
  connectWiFi(ssid, password);
}

/**
 * Xử lý 404
 */
void handleNotFound() {
  server.send(404, "text/plain", "404: Not found");
}

/**
 * Kết nối WiFi với SSID và password
 */
void connectWiFi(String ssid, String password) {
  WiFi.disconnect(true);
  delay(500);

  WiFi.mode(WIFI_AP_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);

  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid.c_str(), password.c_str());

  unsigned long start = millis();
  while (millis() - start < WIFI_CONNECT_TIMEOUT) {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nWiFi connected!");
      Serial.print("IP: ");
      Serial.println(WiFi.localIP());
      WiFi.softAPdisconnect(true);
      isSetupMode = false;
      server.stop();
      return;
    }
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connection failed!");
  startSetupMode();
}

/**
 * Thử kết nối WiFi từ credentials đã lưu
 */
void tryAutoConnectWiFi() {
  prefs.begin("wifi", true);
  String ssid = prefs.getString("ssid", "");
  String pass = prefs.getString("pass", "");
  prefs.end();

  if (ssid.length() > 0) {
    Serial.print("Auto-connecting to: ");
    Serial.println(ssid);
    connectWiFi(ssid, pass);
  } else {
    Serial.println("No saved WiFi credentials - Entering setup mode");
    startSetupMode();
  }
}

/**
 * Bắt đầu setup mode (AP mode)
 */
void startSetupMode() {
  isSetupMode = true;
  Serial.println("Starting setup mode...");
  WiFi.disconnect(true);
  delay(1000);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);

  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP: ");
  Serial.println(IP);

  server.on("/", HTTP_GET, handleRoot);
  server.on("/connect", HTTP_POST, handleConnect);
  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println("WebServer started at http://192.168.4.1/");
}

/**
 * Kiểm tra và xử lý trạng thái WiFi
 */
void checkWiFiStatus() {
  bool wifiConnected = (WiFi.status() == WL_CONNECTED);

  if (wifiConnected) {
    wasConnected = true;
    wifiLostTime = 0;
  } else {
    if (wasConnected) {
      if (wifiLostTime == 0) {
        wifiLostTime = millis();
        Serial.println("WiFi lost - Waiting 30s before setup mode...");
      } else if (millis() - wifiLostTime >= WIFI_LOST_TIMEOUT) {
        Serial.println("WiFi lost too long - Entering setup mode");
        startSetupMode();
      }
    }
  }
}

// ==================== HÀM MQTT ====================

/**
 * Thiết lập Last Will and Testament (LWT)
 */
void setupMQTTLWT() {
  String lwtTopic = "device/" + DEVICE_ID + "/lwt";
  String lwtPayload = "{\"status\":\"offline\"}";
  mqttClient.setWill(lwtTopic.c_str(), lwtPayload.c_str(), 1, false);
  Serial.println("LWT configured: " + lwtTopic);
}

/**
 * Callback khi kết nối MQTT thành công
 */
void onMQTTConnect() {
  Serial.println("MQTT connected!");
  mqttConnected = true;

  // Subscribe topic command
  String commandTopic = "device/" + DEVICE_ID + "/command";
  mqttClient.subscribe(commandTopic.c_str(), 1);
  Serial.println("Subscribed to: " + commandTopic);

  // Subscribe topic register response
  String responseTopic = "device/" + DEVICE_ID + "/register/response";
  mqttClient.subscribe(responseTopic.c_str(), 1);
  Serial.println("Subscribed to: " + responseTopic);
}

/**
 * Kết nối MQTT
 */
void connectMQTT() {
  if (mqttClient.connected()) {
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  Serial.print("Connecting to MQTT broker...");

  // Thiết lập LWT trước khi kết nối
  setupMQTTLWT();

  // Tạo client ID duy nhất
  String clientId = "ESP32-" + DEVICE_ID + "-" + String(random(0xffff), HEX);

  if (mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
    onMQTTConnect();
    
    // Gửi đăng ký nếu chưa gửi
    if (!mqttRegisterSent) {
      delay(500);
      registerDevice();
      mqttRegisterSent = true;
    }
  } else {
    Serial.print(" failed, state=");
    Serial.println(mqttClient.state());
    mqttConnected = false;
  }
}

/**
 * Callback khi nhận message từ MQTT
 */
void onMQTTMessage(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("Received MQTT message: ");
  Serial.print(topic);
  Serial.print(" - ");
  Serial.println(message);

  String topicStr = String(topic);

  // Xử lý register response
  if (topicStr.indexOf("/register/response") >= 0) {
    handleRegisterResponse(message);
    return;
  }

  // Xử lý command
  if (topicStr.indexOf("/command") >= 0) {
    handleCommand(message);
    return;
  }
}

/**
 * Xử lý response đăng ký thiết bị
 */
void handleRegisterResponse(String payload) {
  DynamicJsonDocument doc(512);
  deserializeJson(doc, payload);

  if (doc["status"] == "success") {
    deviceRegistered = true;
    Serial.println("Device registered successfully!");
    Serial.print("Device ID: ");
    Serial.println(doc["device_id"].as<String>());
  } else {
    Serial.println("Device registration failed!");
    deviceRegistered = false;
  }
}

/**
 * Xử lý lệnh từ server
 */
void handleCommand(String payload) {
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, payload);

  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }

  // Xử lý device_enabled
  if (doc.containsKey("device_enabled")) {
    deviceEnabled = doc["device_enabled"].as<bool>();
    Serial.print("Device enabled: ");
    Serial.println(deviceEnabled ? "ON" : "OFF");

    if (!deviceEnabled) {
      turnOffAllSensors();
      turnOffAllActuators();
    }
  }

  // Xử lý sensors (chỉ khi device enabled)
  if (doc.containsKey("sensors") && deviceEnabled) {
    JsonObject sensors = doc["sensors"];
    
    if (sensors.containsKey(SENSOR_TEMP_ID)) {
      sensorStates[0] = sensors[SENSOR_TEMP_ID].as<bool>();
    }
    if (sensors.containsKey(SENSOR_HUMIDITY_ID)) {
      sensorStates[1] = sensors[SENSOR_HUMIDITY_ID].as<bool>();
    }
    if (sensors.containsKey(SENSOR_PIR_ID)) {
      sensorStates[2] = sensors[SENSOR_PIR_ID].as<bool>();
    }
    if (sensors.containsKey(SENSOR_IR_ID)) {
      sensorStates[3] = sensors[SENSOR_IR_ID].as<bool>();
    }

    Serial.println("Sensor states updated");
  }

  // Xử lý actuators (chỉ khi device enabled)
  if (doc.containsKey("actuators") && deviceEnabled) {
    JsonObject actuators = doc["actuators"];
    
    if (actuators.containsKey(ACTUATOR_RELAY_ID)) {
      bool state = actuators[ACTUATOR_RELAY_ID].as<bool>();
      actuatorStates[0] = state;
      digitalWrite(LED_PIR_PIN, state ? HIGH : LOW);
      Serial.print("Relay: ");
      Serial.println(state ? "ON" : "OFF");
    }
    
    if (actuators.containsKey(ACTUATOR_LED_IR_ID)) {
      bool state = actuators[ACTUATOR_LED_IR_ID].as<bool>();
      actuatorStates[1] = state;
      digitalWrite(LED_IR_PIN, state ? HIGH : LOW);
      Serial.print("LED IR: ");
      Serial.println(state ? "ON" : "OFF");
    }

    Serial.println("Actuator states updated");
  }
}

/**
 * Đăng ký thiết bị với server qua MQTT
 */
void registerDevice() {
  if (!mqttClient.connected()) {
    return;
  }

  Serial.println("Registering device...");

  DynamicJsonDocument doc(2048);
  doc["device_id"] = DEVICE_ID;
  doc["name"] = DEVICE_NAME;
  doc["type"] = DEVICE_TYPE;
  doc["ip"] = WiFi.localIP().toString();

  // Sensors - chỉ cần gửi type, server tự set unit/name/threshold
  JsonArray sensors = doc.createNestedArray("sensors");
  
  JsonObject sensorTemp = sensors.createNestedObject();
  sensorTemp["sensor_id"] = SENSOR_TEMP_ID;
  sensorTemp["type"] = "temperature";
  sensorTemp["pin"] = DHTPIN;

  JsonObject sensorHum = sensors.createNestedObject();
  sensorHum["sensor_id"] = SENSOR_HUMIDITY_ID;
  sensorHum["type"] = "humidity";
  sensorHum["pin"] = DHTPIN;

  JsonObject sensorPir = sensors.createNestedObject();
  sensorPir["sensor_id"] = SENSOR_PIR_ID;
  sensorPir["type"] = "motion";
  sensorPir["pin"] = PIR_PIN;

  JsonObject sensorIr = sensors.createNestedObject();
  sensorIr["sensor_id"] = SENSOR_IR_ID;
  sensorIr["type"] = "obstacle";   // hoặc "infrared" / "binary"
  sensorIr["pin"] = IR_PIN;

  // Actuators
  JsonArray actuators = doc.createNestedArray("actuators");
  
  JsonObject actuatorRelay = actuators.createNestedObject();
  actuatorRelay["actuator_id"] = ACTUATOR_RELAY_ID;
  actuatorRelay["type"] = "relay";
  actuatorRelay["name"] = "Relay PIR";
  actuatorRelay["pin"] = LED_PIR_PIN;

  JsonObject actuatorLed = actuators.createNestedObject();
  actuatorLed["actuator_id"] = ACTUATOR_LED_IR_ID;
  actuatorLed["type"] = "led";
  actuatorLed["name"] = "LED IR";
  actuatorLed["pin"] = LED_IR_PIN;

  String payload;
  serializeJson(doc, payload);

  String topic = "device/register";
  bool result = mqttClient.publish(topic.c_str(), payload.c_str(), false);
  
  Serial.print("Register published: ");
  Serial.println(result ? "OK" : "FAIL");
  Serial.print("Payload: ");
  Serial.println(payload);
}

/**
 * Gửi dữ liệu sensor và actuator lên server
 */
void sendSensorData() {
  if (!mqttClient.connected() || !deviceEnabled) {
    return;
  }

  DynamicJsonDocument doc(1024);
  doc["device_id"] = DEVICE_ID;

  // Sensors - chỉ gửi sensors đang enabled
  JsonArray sensors = doc.createNestedArray("sensors");

  if (sensorStates[0] && !isnan(temperature)) {
    JsonObject temp = sensors.createNestedObject();
    temp["sensor_id"] = SENSOR_TEMP_ID;
    temp["value"] = temperature;
  }

  if (sensorStates[1] && !isnan(humidity)) {
    JsonObject hum = sensors.createNestedObject();
    hum["sensor_id"] = SENSOR_HUMIDITY_ID;
    hum["value"] = humidity;
  }

  // ===== PIR =====
  if (sensorStates[2]) {
    JsonObject pir = sensors.createNestedObject();
    pir["sensor_id"] = SENSOR_PIR_ID;
    pir["type"] = "motion";
    pir["value"] = pirState ? 1 : 0;
  }

  // ===== IR (VẬT CẢN) =====
  if (sensorStates[3]) {
    JsonObject ir = sensors.createNestedObject();
    ir["sensor_id"] = SENSOR_IR_ID;
    ir["type"] = "obstacle";   // hoặc "infrared" / "binary"
    ir["value"] = irState ? 1 : 0;
  }

  // Actuators - gửi trạng thái hiện tại
  JsonArray actuators = doc.createNestedArray("actuators");

  JsonObject relay = actuators.createNestedObject();
  relay["actuator_id"] = ACTUATOR_RELAY_ID;
  relay["state"] = actuatorStates[0];

  JsonObject led = actuators.createNestedObject();
  led["actuator_id"] = ACTUATOR_LED_IR_ID;
  led["state"] = actuatorStates[1];

  String payload;
  serializeJson(doc, payload);

  String topic = "device/" + DEVICE_ID + "/data";
  bool result = mqttClient.publish(topic.c_str(), payload.c_str(), false);

  Serial.print("Data published: ");
  Serial.println(result ? "OK" : "FAIL");
  Serial.print("Payload: ");
  Serial.println(payload);
}

// ==================== HÀM SENSOR ====================

/**
 * Đọc dữ liệu từ DHT11
 */
void readDHT() {
  if (!sensorStates[0] && !sensorStates[1]) {
    return; // Cả temperature và humidity đều tắt
  }

  temperature = dht.readTemperature();
  humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT read failed!");
    return;
  }
}

/**
 * Đọc dữ liệu từ PIR sensor
 */
void readPIR() {
  if (!sensorStates[2]) {
    return;
  }
  pirState = digitalRead(PIR_PIN) == HIGH;
}

/**
 * Đọc dữ liệu từ IR sensor
 */
void readIR() {
  if (!sensorStates[3]) {
    return;
  }
  irState = digitalRead(IR_PIN) == LOW; // LOW = có vật cản
}

/**
 * Đọc tất cả sensors
 */
void readAllSensors() {
  unsigned long now = millis();
  
  if (now - lastDHT >= DHT_INTERVAL) {
    lastDHT = now;
    readDHT();
  }

  readPIR();
  readIR();
}

// ==================== HÀM ACTUATOR ====================

/**
 * Tắt tất cả sensors
 */
void turnOffAllSensors() {
  for (int i = 0; i < 4; i++) {
    sensorStates[i] = false;
  }
  Serial.println("All sensors turned OFF");
}

/**
 * Tắt tất cả actuators
 */
void turnOffAllActuators() {
  actuatorStates[0] = false;
  actuatorStates[1] = false;
  digitalWrite(LED_PIR_PIN, LOW);
  digitalWrite(LED_IR_PIN, LOW);
  Serial.println("All actuators turned OFF");
}

// ==================== HÀM OLED ====================

/**
 * Cập nhật màn hình OLED
 */
void updateOLED() {
  if (!oledEnabled) {
    return;
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // Thông tin device
  display.setCursor(0, 0);
  display.print("Device: ");
  display.println(DEVICE_ID);

  // Temperature
  display.setCursor(0, 10);
  display.print("Temp: ");
  if (!isnan(temperature)) {
    display.print(temperature);
    display.println(" C");
  } else {
    display.println("N/A");
  }

  // Humidity
  display.setCursor(0, 20);
  display.print("Hum: ");
  if (!isnan(humidity)) {
    display.print(humidity);
    display.println(" %");
  } else {
    display.println("N/A");
  }

  // PIR
  display.setCursor(0, 30);
  display.print("PIR: ");
  display.println(pirState ? "YES" : "NO");

  // IR
  display.setCursor(0, 40);
  display.print("IR: ");
  display.println(irState ? "OBST" : "OK");

  // WiFi status
  display.setCursor(0, 50);
  display.print("WiFi: ");
  display.println(WiFi.status() == WL_CONNECTED ? "OK" : "FAIL");

  // MQTT status
  if (WiFi.status() == WL_CONNECTED) {
    display.setCursor(70, 50);
    display.print("MQTT: ");
    display.println(mqttClient.connected() ? "OK" : "FAIL");
  }

  display.display();
}

// ==================== SETUP ====================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("=== ESP32 Smart Home Device ===");
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);

  // Khởi tạo GPIO
  pinMode(PIR_PIN, INPUT);
  pinMode(IR_PIN, INPUT);
  pinMode(LED_PIR_PIN, OUTPUT);
  pinMode(LED_IR_PIN, OUTPUT);
  digitalWrite(LED_PIR_PIN, LOW);
  digitalWrite(LED_IR_PIN, LOW);

  // Khởi tạo I2C cho OLED
  Wire.begin(21, 22);

  // Khởi tạo OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED initialization failed!");
    while (1) delay(1000);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Initializing...");
  display.display();
  delay(1000);

  // Khởi tạo DHT11
  dht.begin();
  Serial.println("DHT11 initialized");

  // Cấu hình MQTT
  espClient.setInsecure(); // Bỏ qua SSL certificate verification
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMQTTMessage);
  mqttClient.setBufferSize(MQTT_MAX_PACKET_SIZE);
  Serial.println("MQTT client configured");

  // Thử kết nối WiFi tự động
  tryAutoConnectWiFi();

  Serial.println("Setup complete!");
}

// ==================== LOOP ====================

void loop() {
  // Xử lý setup mode
  if (isSetupMode) {
    server.handleClient();
    return;
  }

  unsigned long now = millis();

  // Kiểm tra WiFi
  checkWiFiStatus();

  // Kết nối và duy trì MQTT
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      connectMQTT();
    } else {
      mqttClient.loop();
    }
  }

  // Đọc sensors
  readAllSensors();

  // Gửi dữ liệu MQTT định kỳ
  if (WiFi.status() == WL_CONNECTED && mqttClient.connected() && deviceEnabled) {
    if (now - lastMQTT >= MQTT_DATA_INTERVAL) {
      lastMQTT = now;
      sendSensorData();
    }
  }

  // Cập nhật OLED
  if (now - lastOLED >= OLED_INTERVAL) {
    lastOLED = now;
    updateOLED();
  }

  delay(10);
}
