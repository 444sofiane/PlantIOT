// Configuración global
window.config = {
    speechKey: '',
    speechRegion: 'northeurope',
    logicAppUrl: '',
    deviceId: 'PlantMonitor001'
};

let recognizer = null;
let isListening = false;
let conversationHistory = [];

// Elementos DOM
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

// Inicialización cuando carga la página
document.addEventListener('DOMContentLoaded', () => {
    console.log('Página cargada, iniciando...');
    loadConfiguration();
    loadHistory();
    
    if (!window.config.speechKey || !window.config.logicAppUrl) {
        console.log('Config incompleta, mostrando modal');
        showConfigModal();
    } else {
        console.log('Config completa:', window.config);
    }
    
    talkBtn.addEventListener('click', handleTalkButton);
    checkStatusBtn.addEventListener('click', checkPlantStatus);
    document.getElementById('saveConfig').addEventListener('click', saveConfiguration);
});

function loadConfiguration() {
    console.log('Cargando configuración...');
    const saved = localStorage.getItem('plantMonitorConfig');
    console.log('localStorage contiene:', saved);
    
    if (saved) {
        try {
            window.config = JSON.parse(saved);
            console.log('Config cargada exitosamente:', window.config);
        } catch (error) {
            console.error('Error parseando config:', error);
        }
    } else {
        console.log('No hay config en localStorage');
    }
}

function saveConfiguration() {
    console.log('Guardando configuración...');
    
    window.config.speechKey = document.getElementById('speechKey').value.trim();
    window.config.speechRegion = document.getElementById('speechRegion').value.trim();
    window.config.logicAppUrl = document.getElementById('logicAppUrl').value.trim();
    window.config.deviceId = document.getElementById('deviceId').value.trim();
    
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
    document.getElementById('speechKey').value = window.config.speechKey || '';
    document.getElementById('speechRegion').value = window.config.speechRegion || 'northeurope';
    document.getElementById('logicAppUrl').value = window.config.logicAppUrl || '';
    document.getElementById('deviceId').value = window.config.deviceId || 'PlantMonitor001';
}

function hideConfigModal() {
    configModal.classList.remove('show');
}

function handleTalkButton() {
    if (!window.config.speechKey || !window.config.logicAppUrl) {
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
                const spokenText = e.result.text;
                console.log('Recognized:', spokenText);
                handleUserQuestion(spokenText);
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
            () => {
                recognizer.close();
                recognizer = null;
            },
            (error) => {
                console.error('Error stopping recognition:', error);
                recognizer.close();
                recognizer = null;
            }
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
        const response = await fetch(window.config.logicAppUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'askPlant',
                question: question,
                deviceId: window.config.deviceId
            })
        });
        
        if (!response.ok) {
            throw new Error('Logic App returned error: ' + response.status);
        }
        
        const data = await response.json();
        
        if (data.response) {
            displayPlantResponse(data.response);
            speakResponse(data.response);
            addToHistory(question, data.response);
        } else {
            throw new Error('No response from plant');
        }
        
    } catch (error) {
        console.error('Error communicating with plant:', error);
        showStatus('Failed to communicate with plant: ' + error.message, 'error');
        plantResponse.innerHTML = '<p>Sorry, I could not understand that. Please try again.</p>';
    }
}

async function checkPlantStatus() {
    console.log('checkPlantStatus llamado');
    console.log('Config actual:', window.config);
    
    showStatus('Checking plant status...', 'success');
    plantResponse.innerHTML = '<p>Checking sensors...</p>';
    
    try {
        const response = await fetch(window.config.logicAppUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'getStatus',
                question: 'What is your status?',
                deviceId: window.config.deviceId
            })
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error('Failed to get status');
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.response) {
            displayPlantResponse(data.response);
            speakResponse(data.response);
            
            if (data.sensorData) {
                moistureEl.textContent = data.sensorData.moisture + '%';
                temperatureEl.textContent = data.sensorData.temperature + '°C';
                humidityEl.textContent = data.sensorData.humidity + '%';
            }
        }
        
    } catch (error) {
        console.error('Error getting status:', error);
        showStatus('Failed to get plant status: ' + error.message, 'error');
        plantResponse.innerHTML = '<p>Could not retrieve plant status</p>';
    }
}

function displayPlantResponse(text) {
    plantResponse.innerHTML = `<p>${text}</p>`;
    showStatus('', '');
}

function speakResponse(text) {
    console.log('speakResponse llamado con:', text);
    console.log('Config para TTS:', window.config);
    
    try {
        const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
            window.config.speechKey,
            window.config.speechRegion
        );
        
        speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";
        
        const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);
        
        synthesizer.speakTextAsync(
            text,
            result => {
                console.log('TTS Result:', result.reason);
                if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                    console.log('Speech synthesis completed');
                } else {
                    console.error('Speech synthesis failed:', result.errorDetails);
                }
                synthesizer.close();
            },
            error => {
                console.error('TTS error:', error);
                synthesizer.close();
            }
        );
        
    } catch (error) {
        console.error('Error in text-to-speech:', error);
    }
}

function addToHistory(question, response) {
    const historyItem = {
        timestamp: new Date().toISOString(),
        question: question,
        response: response
    };
    
    conversationHistory.unshift(historyItem);
    
    if (conversationHistory.length > 10) {
        conversationHistory = conversationHistory.slice(0, 10);
    }
    
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

function renderHistory() {
    if (conversationHistory.length === 0) {
        historyDiv.innerHTML = '<p style="color: #999; text-align: center;">No conversations yet</p>';
        return;
    }
    
    historyDiv.innerHTML = conversationHistory.map(item => {
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="history-item">
                <div class="timestamp">${timeStr}</div>
                <div class="question">Q: ${item.question}</div>
                <div class="response">A: ${item.response}</div>
            </div>
        `;
    }).join('');
}

function showStatus(message, type = '') {
    if (!message) {
        statusDiv.classList.remove('show');
        return;
    }
    
    statusDiv.textContent = message;
    statusDiv.className = 'status-message show';
    
    if (type) {
        statusDiv.classList.add(type);
    }
}

configModal.addEventListener('click', (e) => {
    if (e.target === configModal) {
        if (window.config.speechKey && window.config.logicAppUrl) {
            hideConfigModal();
        }
    }
});