# PlantIOT – Smart Soil Monitoring System  

**GitHub:** https://github.com/444sofiane/PlantIOT  

## Project Summary  

PlantIOT is an end-to-end IoT system that monitors soil moisture in real time and provides intelligent watering recommendations through a web interface with voice feedback.

The system uses an ESP32 microcontroller connected to a soil moisture sensor to collect environmental data. Sensor telemetry is securely transmitted to Microsoft Azure IoT Hub, enabling reliable device-to-cloud communication and cloud-side data handling.

A JavaScript web application retrieves the sensor data from Azure and evaluates moisture levels to determine whether watering is required. The application integrates Text-to-Speech (TTS) functionality to verbally inform the user if the plant needs water, improving usability and accessibility.

During development, the PlatformIO extension in Visual Studio Code was used to program the ESP32 and monitor real-time serial output for debugging, telemetry validation, and sensor calibration.

## Architecture Overview  

- **Device Layer:** ESP32 + Soil Moisture Sensor  
- **Development Environment:** Visual Studio Code with PlatformIO extension (firmware deployment and serial monitoring)  
- **Cloud Layer:** Microsoft Azure IoT Hub for telemetry ingestion  
- **Application Layer:** JavaScript web application with real-time data retrieval and TTS integration  

## Key Capabilities  

- Real-time soil moisture monitoring  
- Secure IoT device-to-cloud communication  
- Embedded firmware development and serial debugging via PlatformIO  
- Intelligent watering recommendation logic  
- Audio feedback using Text-to-Speech  
- Full-stack IoT implementation (Embedded → Cloud → Web → Voice Output)  
