#include <Arduino.h>
#include <AzIoTSasToken.h>
#include "SerialLogger.h"
#include <WiFi.h>
#include <az_core.h>
#include <azure_ca.h>
#include <ctime>
#include "WiFiClientSecure.h"

#include "DHTesp.h"
#include "PubSubClient.h"
#include "ArduinoJson.h"

/* Azure auth data */
const char* deviceKey = "kPYCEWsFADFkTaioMXSufcy0YQ+38/SdmAIoTDYVzUE=";	 // Azure Primary key for device
const char* iotHubHost = "IOTProjectFOIHub.azure-devices.net";		 //[Azure IoT host name].azure-devices.net
const int tokenDuration = 60;

const char* deviceId = "IOTProjectDevice";  // Device ID as specified in the list of devices on IoT Hub

/* MQTT data for IoT Hub connection */
const char* mqttBroker = iotHubHost;  // MQTT host = IoT Hub link
const int mqttPort = AZ_IOT_DEFAULT_MQTT_CONNECT_PORT;	// Secure MQTT port
const char* mqttC2DTopic = AZ_IOT_HUB_CLIENT_C2D_SUBSCRIBE_TOPIC;	// Topic where we can receive cloud to device messages

// These three are just buffers - actual clientID/username/password is generated
// using the SDK functions in initIoTHub()
char mqttClientId[128];
char mqttUsername[128];
char mqttPasswordBuffer[200];
char publishTopic[200];

/* Auth token requirements */

uint8_t sasSignatureBuffer[256];  // Make sure it's of correct size, it will just freeze otherwise :/

az_iot_hub_client client;
AzIoTSasToken sasToken(
	&client, az_span_create_from_str((char*)deviceKey),
	AZ_SPAN_FROM_BUFFER(sasSignatureBuffer),
	AZ_SPAN_FROM_BUFFER(
		mqttPasswordBuffer));	 // Authentication token for our specific device


const int DHT_PIN = 21;

DHTesp dht;
SerialLogger LogIOT;

WiFiClientSecure wifiClient;
PubSubClient mqttClient(wifiClient);

const char* ssid = "SofianeIOT";
const char* pass = "repz7250";
short timeoutCounter = 0;

void setupWiFi() {
	LogIOT.Info("Connecting to WiFi");

	
  wifiClient.setInsecure();

	WiFi.mode(WIFI_STA);
	WiFi.begin(ssid, pass);

	while (WiFi.status() != WL_CONNECTED) { // Wait until we connect...
		Serial.print(".");
		delay(500);

		timeoutCounter++;
		if (timeoutCounter >= 20) ESP.restart(); // Or restart if we waited for too long, not much else can you do
	}

	LogIOT.Info("WiFi connected");
}



// Use pool pool.ntp.org to get the current time
// Define a date on 1.1.2023. and wait until the current time has the same year (by default it's 1.1.1970.)
void initializeTime() {	 // MANDATORY or SAS tokens won't generate

}

void setupDHTSensor() { // NOTE: change to DHT22 if you are using the white temp/humidity sensor
  dht.setup(DHT_PIN, DHTesp::DHT22);
}

// MQTT is a publish-subscribe based, therefore a callback function is called whenever something is published on a topic that device is subscribed to
// It's also a binary-safe protocol, therefore instead of transfering text, bytes are transfered and they aren't null terminated - so we need ot add \0 to terminate the string
void callback(char *topic, byte *payload, unsigned int length) {

  LogIOT.Info("Message arrived on topic: " + String(topic));
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  LogIOT.Info("Message: " + message);
}

void connectMQTT() {
  mqttClient.setServer(mqttBroker, mqttPort);
  mqttClient.setCallback(callback);

  while (!mqttClient.connected()) {
    LogIOT.Info("Connecting to MQTT...");

    // Generate new SAS token for authentication
    if (az_result_failed(sasToken.Generate(tokenDuration))) {
      LogIOT.Error("Failed generating SAS token");
      delay(1000);
      continue;
    }

    String mqttPassword = String((char*)sasToken.Get()._internal.ptr, sasToken.Get()._internal.size);

    LogIOT.Info("Using MQTT Client ID: " + String(mqttClientId));
    LogIOT.Info("Using MQTT Username: " + String(mqttUsername));
    //LogIOT.Info("Using MQTT Password: " + mqttPassword); // Uncomment for debug purposes only, do NOT log passwords in production code!

    if (mqttClient.connect(mqttClientId, mqttUsername, mqttPassword.c_str())) {
      LogIOT.Info("MQTT connected");

      // Subscribe to cloud-to-device topic to receive messages from IoT Hub
      if (mqttClient.subscribe(mqttC2DTopic)) {
        LogIOT.Info("Subscribed to C2D topic");
      } else {
        LogIOT.Error("Failed subscribing to C2D topic");
      }

    } else {
      LogIOT.Error("Failed connecting to MQTT, rc=" + String(mqttClient.state()));
      delay(2000);
    }
  }
  
}

void mqttReconnect() {
  while (!mqttClient.connected()) {
    connectMQTT();
  }
}


String getTelemetryData() { // Get the data and pack it in a JSON message
  JsonDocument doc; // Create a JSON document we'll reuse to serialize our data into JSON
  String output = "";


	JsonObject Ambient = doc["Ambient"].to<JsonObject>();
	Ambient["Temperature"] = dht.getTemperature();
	Ambient["Humidity"] = dht.getHumidity();

	doc["DeviceID"] = (String)deviceId;

	serializeJson(doc, output);

	LogIOT.Info(output);
  return output;
}

void sendTelemetryData() {

}

long lastTime, currentTime = 0;
int interval = 5000;
void checkTelemetry() { // Do not block using delay(), instead check if enough time has passed between two calls using millis() 

}

void sendTestMessageToIoTHub() {
  az_result res = az_iot_hub_client_telemetry_get_publish_topic(&client, NULL, publishTopic, 200, NULL ); // The receive topic isn't hardcoded and depends on chosen properties, therefore we need to use az_iot_hub_client_telemetry_get_publish_topic()
  LogIOT.Info(String(publishTopic));
  
  mqttClient.publish(publishTopic, deviceId); // Use https://github.com/Azure/azure-iot-explorer/releases to read the telemetry
}

bool initIoTHub() {
  az_iot_hub_client_options options = az_iot_hub_client_options_default(); // Get a default instance of IoT Hub client options

  if (az_result_failed(az_iot_hub_client_init( // Create an instnace of IoT Hub client for our IoT Hub's host and the current device
          &client,
          az_span_create((unsigned char *)iotHubHost, strlen(iotHubHost)),
          az_span_create((unsigned char *)deviceId, strlen(deviceId)),
          &options)))
  {
    LogIOT.Error("Failed initializing Azure IoT Hub client");
    return false;
  }

  size_t client_id_length;
  if (az_result_failed(az_iot_hub_client_get_client_id(
          &client, mqttClientId, sizeof(mqttClientId) - 1, &client_id_length))) // Get the actual client ID (not our internal ID) for the device
  {
    LogIOT.Error("Failed getting client id");
    return false;
  }

  size_t mqttUsernameSize;
  if (az_result_failed(az_iot_hub_client_get_user_name(
          &client, mqttUsername, sizeof(mqttUsername), &mqttUsernameSize))) // Get the MQTT username for our device
  {
    LogIOT.Error("Failed to get MQTT username ");
    return false;
  }

  LogIOT.Info("Great success");
  LogIOT.Info("Client ID: " + String(mqttClientId));
  LogIOT.Info("Username: " + String(mqttUsername));

  return true;
}

void setup() {
  setupWiFi();
  initializeTime();

  if (initIoTHub()) {
    connectMQTT();
    mqttReconnect();
  }

	setupDHTSensor();

  LogIOT.Info("Setup done");
}


void loop() { // No blocking in the loop, constantly check if we are connected and gather the data if necessary
  checkTelemetry();


}