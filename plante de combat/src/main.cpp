#include <Arduino.h>
#include <Wire.h>
#include <DHTesp.h>
// put function declarations here:
int myFunction(int, int);
const int DHT_PIN = 21;
DHTesp dht;

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
  delay(500);
  dht.setup(DHT_PIN, DHTesp::DHT22);
}

void loop() {
  // put your main code here, to run repeatedly:
  float temperature = dht.getTemperature();
  float humidity = dht.getHumidity();
  Serial.println("Temperature " + String(temperature) + " C");
  Serial.println("Humidity " + String(humidity) );
  delay(2000);
}