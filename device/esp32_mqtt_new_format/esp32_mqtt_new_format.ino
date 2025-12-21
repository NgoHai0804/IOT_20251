/*
 * ESP32 MQTT Client - Format Mới
 * ===============================
 * 
 * Cấu trúc mới:
 * - Room → Device → Sensor/Actuator
 * - Gửi dữ liệu: device/{device_id}/data
 * - Nhận lệnh: device/{device_id}/command
 * 
 * Format gửi lên:
 * {
 *   "device_id": "device_01",
 *   "sensors": [
 *     { "sensor_id": "sensor_01", "value": 30 },
 *     { "sensor_id": "sensor_02", "value": 65 }
 *   ],
 *   "actuators": [
 *     { "actuator_id": "act_01", "state": true }
 *   ]
 * }
 * 
 * Format nhận xuống:
 * {
 *   "device_enabled": true,
 *   "sensors": {
 *     "sensor_01": true,
 *     "sensor_02": false
 *   },
 *   "actuators": {
 *     "act_01": true
 *   }
 * }
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ========== Cấu hình WiFi ==========
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// ========== Cấu hình MQTT ==========
const char* mqtt_server = "707d6798baa54e22a0d6a43694d39e47.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_username = "YOUR_MQTT_USERNAME";
const char* mqtt_password = "YOUR_MQTT_PASSWORD";

// Device ID (phải khớp với database)
const char* device_id = "device_01";

// ========== Sensor IDs ==========
const char* sensor_temp_id = "sensor_01";
const char* sensor_humidity_id = "sensor_02";
const char* sensor_gas_id = "sensor_03";

// ========== Actuator IDs ==========
const char* actuator_relay1_id = "act_01";
const char* actuator_relay2_id = "act_02";

// ========== GPIO Pins ==========
#define DHT_PIN 4
#define DHT_TYPE DHT11
#define GAS_SENSOR_PIN 34
#define RELAY1_PIN 23
#define RELAY2_PIN 22

// ========== Objects ==========
WiFiClientSecure espClient;
PubSubClient client(espClient);
DHT dht(DHT_PIN, DHT_TYPE);

// ========== State Variables ==========
bool device_enabled = true;
bool sensor_temp_enabled = true;
bool sensor_humidity_enabled = true;
bool sensor_gas_enabled = true;
bool actuator_relay1_state = false;
bool actuator_relay2_state = false;

unsigned long lastSensorRead = 0;
const unsigned long sensorInterval = 5000; // 5 giây

// ========== Setup ==========
void setup() {
  Serial.begin(115200);
  
  // Setup GPIO
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  digitalWrite(RELAY1_PIN, LOW);
  digitalWrite(RELAY2_PIN, LOW);
  
  dht.begin();
  
  // Connect WiFi
  setup_wifi();
  
  // Setup MQTT
  espClient.setInsecure(); // Bỏ qua SSL verification (cho development)
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqtt_callback);
  
  Serial.println("ESP32 MQTT Client - Format Mới");
  Serial.println("Device ID: " + String(device_id));
}

// ========== Loop ==========
void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Đọc và gửi dữ liệu sensor định kỳ
  unsigned long now = millis();
  if (now - lastSensorRead >= sensorInterval) {
    lastSensorRead = now;
    
    if (device_enabled) {
      sendSensorData();
    }
  }
}

// ========== WiFi Setup ==========
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

// ========== MQTT Reconnect ==========
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    String clientId = "ESP32-" + String(device_id);
    
    if (client.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
      Serial.println("connected");
      
      // Subscribe to command topic
      String commandTopic = "device/" + String(device_id) + "/command";
      client.subscribe(commandTopic.c_str());
      Serial.println("Subscribed to: " + commandTopic);
      
      // Gửi trạng thái online
      sendDeviceStatus();
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// ========== MQTT Callback ==========
void mqtt_callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  
  // Parse JSON
  StaticJsonDocument<512> doc;
  deserializeJson(doc, payload, length);
  
  // Xử lý device_enabled
  if (doc.containsKey("device_enabled")) {
    device_enabled = doc["device_enabled"];
    Serial.println("Device enabled: " + String(device_enabled ? "true" : "false"));
    
    if (!device_enabled) {
      // Tắt tất cả sensors và actuators
      turnOffAllSensors();
      turnOffAllActuators();
    }
  }
  
  // Xử lý sensors
  if (doc.containsKey("sensors")) {
    JsonObject sensors = doc["sensors"];
    
    if (sensors.containsKey(sensor_temp_id)) {
      sensor_temp_enabled = sensors[sensor_temp_id];
      Serial.println("Sensor temp enabled: " + String(sensor_temp_enabled ? "true" : "false"));
    }
    
    if (sensors.containsKey(sensor_humidity_id)) {
      sensor_humidity_enabled = sensors[sensor_humidity_id];
      Serial.println("Sensor humidity enabled: " + String(sensor_humidity_enabled ? "true" : "false"));
    }
    
    if (sensors.containsKey(sensor_gas_id)) {
      sensor_gas_enabled = sensors[sensor_gas_id];
      Serial.println("Sensor gas enabled: " + String(sensor_gas_enabled ? "true" : "false"));
    }
  }
  
  // Xử lý actuators
  if (doc.containsKey("actuators")) {
    JsonObject actuators = doc["actuators"];
    
    if (actuators.containsKey(actuator_relay1_id)) {
      actuator_relay1_state = actuators[actuator_relay1_id];
      digitalWrite(RELAY1_PIN, actuator_relay1_state ? HIGH : LOW);
      Serial.println("Relay 1: " + String(actuator_relay1_state ? "ON" : "OFF"));
    }
    
    if (actuators.containsKey(actuator_relay2_id)) {
      actuator_relay2_state = actuators[actuator_relay2_id];
      digitalWrite(RELAY2_PIN, actuator_relay2_state ? HIGH : LOW);
      Serial.println("Relay 2: " + String(actuator_relay2_state ? "ON" : "OFF"));
    }
  }
}

// ========== Send Sensor Data ==========
void sendSensorData() {
  StaticJsonDocument<512> doc;
  
  doc["device_id"] = device_id;
  
  // Sensors array
  JsonArray sensors = doc.createNestedArray("sensors");
  
  if (sensor_temp_enabled) {
    float temperature = dht.readTemperature();
    if (!isnan(temperature)) {
      JsonObject sensor = sensors.createNestedObject();
      sensor["sensor_id"] = sensor_temp_id;
      sensor["value"] = temperature;
    }
  }
  
  if (sensor_humidity_enabled) {
    float humidity = dht.readHumidity();
    if (!isnan(humidity)) {
      JsonObject sensor = sensors.createNestedObject();
      sensor["sensor_id"] = sensor_humidity_id;
      sensor["value"] = humidity;
    }
  }
  
  if (sensor_gas_enabled) {
    int gasValue = analogRead(GAS_SENSOR_PIN);
    JsonObject sensor = sensors.createNestedObject();
    sensor["sensor_id"] = sensor_gas_id;
    sensor["value"] = gasValue;
  }
  
  // Actuators array
  JsonArray actuators = doc.createNestedArray("actuators");
  
  JsonObject actuator1 = actuators.createNestedObject();
  actuator1["actuator_id"] = actuator_relay1_id;
  actuator1["state"] = actuator_relay1_state;
  
  JsonObject actuator2 = actuators.createNestedObject();
  actuator2["actuator_id"] = actuator_relay2_id;
  actuator2["state"] = actuator_relay2_state;
  
  // Publish
  String topic = "device/" + String(device_id) + "/data";
  String payload;
  serializeJson(doc, payload);
  
  client.publish(topic.c_str(), payload.c_str());
  Serial.println("Published to " + topic + ": " + payload);
}

// ========== Send Device Status ==========
void sendDeviceStatus() {
  StaticJsonDocument<256> doc;
  doc["status"] = "online";
  
  String topic = "device/" + String(device_id) + "/status";
  String payload;
  serializeJson(doc, payload);
  
  client.publish(topic.c_str(), payload.c_str());
  Serial.println("Published status: " + payload);
}

// ========== Helper Functions ==========
void turnOffAllSensors() {
  sensor_temp_enabled = false;
  sensor_humidity_enabled = false;
  sensor_gas_enabled = false;
  Serial.println("All sensors turned off");
}

void turnOffAllActuators() {
  actuator_relay1_state = false;
  actuator_relay2_state = false;
  digitalWrite(RELAY1_PIN, LOW);
  digitalWrite(RELAY2_PIN, LOW);
  Serial.println("All actuators turned off");
}
