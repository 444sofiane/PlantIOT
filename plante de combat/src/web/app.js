window.config = null;

let recognizer = null;
let isListening = false;
let conversationHistory = [];

const talkBtn = document.getElementById('talkBtn');
const checkStatusBtn = document.getElementById('checkStatusBtn');
const btnText = document.getElementById('btnText');
const statusDiv = document.getElementById('status');
const plantResponse = document.getElementById('plantResponse');
const historyDiv = document.getElementById('history');
const configModal = document.getElementById('configModal');
const moistureEl = document.getElementById('moisture');
const temperatureEl = document.getElementById('temperature');
const humidityEl = document.getElementById('humidity');


document.addEventListener('DOMContentLoaded', () => {
    console.log('--- App iniciando ---');

    const saved = localStorage.getItem('plantMonitorConfig');
    console.log('localStorage plantMonitorConfig:', saved);

    if (saved) {
        window.config = JSON.parse(saved);
        console.log('Config cargada OK:', window.config);
    } else {
        console.log('No hay config guardada');
        window.config = {
            speechKey: '',
            speechRegion: 'switzerlandnorth',
            logicAppUrl: '',
            deviceId: 'IOTProjectDevice'
        };
    }

    loadHistory();

    if (!window.config.speechKey || !window.config.logicAppUrl) {
        console.log('Config incompleta, mostrando modal');
        showConfigModal();
    }

    talkBtn.addEventListener('click', handleTalkButton);
    checkStatusBtn.addEventListener('click', checkPlantStatus);
    document.getElementById('saveConfig').addEventListener('click', saveConfiguration);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

    setInterval(() => {
        if (window.config && window.config.logicAppUrl) {
            updateSensorData();
        }
    }, 10000);

    if (window.config && window.config.logicAppUrl) {
        updateSensorData();
    }
});


function saveConfiguration() {
    window.config = {
        speechKey: document.getElementById('speechKey').value.trim(),
        speechRegion: document.getElementById('speechRegion').value.trim(),
        logicAppUrl: document.getElementById('logicAppUrl').value.trim(),
        deviceId: document.getElementById('deviceId').value.trim()
    };

    if (!window.config.speechKey || !window.config.logicAppUrl) {
        showStatus('Please fill in all required fields', 'error');
        return;
    }

    localStorage.setItem('plantMonitorConfig', JSON.stringify(window.config));
    console.log('Config guardada:', window.config);
    hideConfigModal();
    showStatus('Configuration saved successfully!', 'success');
}

function showConfigModal() {
    configModal.classList.add('show');
    if (window.config) {
        document.getElementById('speechKey').value = window.config.speechKey || '';
        document.getElementById('speechRegion').value = window.config.speechRegion || 'switzerlandnorth';
        document.getElementById('logicAppUrl').value = window.config.logicAppUrl || '';
        document.getElementById('deviceId').value = window.config.deviceId || 'IOTProjectDevice';
    }
}

function hideConfigModal() {
    configModal.classList.remove('show');
}


async function callLogicApp(body) {
    let response = await fetch(window.config.logicAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    console.log('Logic App status inicial:', response.status);

    if (response.status === 202) {
        const locationUrl = response.headers.get('Location');
        console.log('202 recibido. Location URL:', locationUrl);

        if (!locationUrl) {
            console.error('202 sin Location header');
            return null;
        }

        for (let i = 0; i < 15; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log('Polling intento ' + (i + 1) + '...');

            response = await fetch(locationUrl);
            console.log('Poll status:', response.status);

            if (response.status === 200) {
                console.log('Respuesta recibida en intento ' + (i + 1));
                break;
            }
        }
    }

    const text = await response.text();
    console.log('Logic App respuesta cruda:', text);

    if (!text || text.trim() === '') {
        console.log('Respuesta vacía después del polling');
        return null;
    }

    try {
        const data = JSON.parse(text);
        console.log('Logic App respuesta parseada:', data);
        return data;
    } catch (e) {
        console.error('No es JSON válido:', e);
        return null;
    }
}


function handleTalkButton() {
    if (!window.config || !window.config.speechKey || !window.config.logicAppUrl) {
        showConfigModal();
        return;
    }
    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
}

function startListening() {
    try {
        isListening = true;
        talkBtn.classList.add('listening');
        btnText.textContent = 'Listening...';
        showStatus('🎤 Listening... Ask your plant a question!', 'success');

        const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
            window.config.speechKey,
            window.config.speechRegion
        );
        speechConfig.speechRecognitionLanguage = "en-US";

        const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

        recognizer.recognized = (s, e) => {
            if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
                console.log('Recognized:', e.result.text);
                handleUserQuestion(e.result.text);
            } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
                showStatus('No speech detected. Please try again.', 'error');
            }
            stopListening();
        };

        recognizer.canceled = (s, e) => {
            console.error('Recognition canceled:', e.errorDetails);
            showStatus('Error: ' + e.errorDetails, 'error');
            stopListening();
        };

        recognizer.startContinuousRecognitionAsync();

    } catch (error) {
        console.error('Speech recognition error:', error);
        showStatus('Failed to start speech recognition', 'error');
        stopListening();
    }
}

function stopListening() {
    if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(
            () => { recognizer.close(); recognizer = null; },
            (err) => { console.error('Error stopping:', err); recognizer.close(); recognizer = null; }
        );
    }
    isListening = false;
    talkBtn.classList.remove('listening');
    btnText.textContent = 'Talk to Plant';
}


async function handleUserQuestion(question) {
    showStatus('Processing your question...', 'success');
    plantResponse.innerHTML = '<p>Thinking...</p>';

    try {
        const data = await callLogicApp({
            action: 'askPlant',
            question: question,
            deviceId: window.config.deviceId,
            history: conversationHistory
        });

        if (data && data.response) {
            displayPlantResponse(data.response);
            speakResponse(data.response);
            addToHistory(question, data.response);
            if (data.sensorData) updateSensorDisplay(data.sensorData);
        } else {
            plantResponse.innerHTML = '<p>Sorry, I could not get a response. Check Logic App.</p>';
            showStatus('No response received', 'error');
        }

    } catch (error) {
        console.error('Error:', error);
        showStatus('Failed: ' + error.message, 'error');
        plantResponse.innerHTML = '<p>Sorry, something went wrong. Please try again.</p>';
    }
}


async function checkPlantStatus() {
    if (!window.config || !window.config.logicAppUrl) {
        showConfigModal();
        return;
    }

    showStatus('Checking plant status...', 'success');
    plantResponse.innerHTML = '<p>Checking sensors...</p>';

    try {
        const data = await callLogicApp({
            action: 'getStatus',
            question: 'What is your status?',
            deviceId: window.config.deviceId,
            history: conversationHistory
        });

        if (data && data.response) {
            displayPlantResponse(data.response);
            speakResponse(data.response);
            if (data.sensorData) updateSensorDisplay(data.sensorData);
        } else {
            plantResponse.innerHTML = '<p>Could not retrieve plant status. Logic App returned empty response.</p>';
            showStatus('Empty response from Logic App', 'error');
        }

    } catch (error) {
        console.error('Error:', error);
        showStatus('Failed: ' + error.message, 'error');
        plantResponse.innerHTML = '<p>Could not retrieve plant status</p>';
    }
}


async function updateSensorData() {
    if (!window.config || !window.config.logicAppUrl) {
        return; // No hacer nada si no hay config
    }

    try {
        const data = await callLogicApp({
            action: 'getSensorData',
            question: 'Get sensor data',
            deviceId: window.config.deviceId
        });

        if (data && data.sensorData) {
            updateSensorDisplay(data.sensorData);
        }

    } catch (error) {
        console.error('Error updating sensor data:', error);
    }
}

function updateSensorDisplay(sensorData) {
    if (sensorData.moisture !== undefined) moistureEl.textContent = (100 - sensorData.moisture) + '%';
    if (sensorData.temperature !== undefined) temperatureEl.textContent = sensorData.temperature + '°C';
    if (sensorData.humidity !== undefined) humidityEl.textContent = sensorData.humidity + '%';
}


function displayPlantResponse(text) {
    plantResponse.innerHTML = '<p>' + text + '</p>';
    showStatus('', '');
}


function speakResponse(text) {
    try {
        const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
            window.config.speechKey,
            window.config.speechRegion
        );
        speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";

        const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);
        synthesizer.speakTextAsync(
            text,
            result => { console.log('TTS done:', result.reason); synthesizer.close(); },
            error => { console.error('TTS error:', error); synthesizer.close(); }
        );
    } catch (error) {
        console.error('Error in TTS:', error);
    }
}


function addToHistory(question, response) {
    conversationHistory.unshift({
        timestamp: new Date().toISOString(),
        question: question,
        response: response
    });
    if (conversationHistory.length > 10) conversationHistory = conversationHistory.slice(0, 10);
    localStorage.setItem('plantConversationHistory', JSON.stringify(conversationHistory));
    renderHistory();
}

function loadHistory() {
    const saved = localStorage.getItem('plantConversationHistory');
    if (saved) {
        conversationHistory = JSON.parse(saved);
        renderHistory();
    }
}

function clearHistory() {
    conversationHistory = [];
    localStorage.removeItem('plantConversationHistory');
    renderHistory();
}

function renderHistory() {
    if (conversationHistory.length === 0) {
        historyDiv.innerHTML = '<p style="color: #999; text-align: center;">No conversations yet</p>';
        return;
    }
    historyDiv.innerHTML = conversationHistory.map(item => {
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return '<div class="history-item">' +
            '<div class="timestamp">' + timeStr + '</div>' +
            '<div class="question">Q: ' + item.question + '</div>' +
            '<div class="response">A: ' + item.response + '</div>' +
            '</div>';
    }).join('');
}


function showStatus(message, type) {
    if (!message) { statusDiv.classList.remove('show'); return; }
    statusDiv.textContent = message;
    statusDiv.className = 'status-message show';
    if (type) statusDiv.classList.add(type);
}

configModal.addEventListener('click', (e) => {
    if (e.target === configModal && window.config && window.config.speechKey && window.config.logicAppUrl) {
        hideConfigModal();
    }
});