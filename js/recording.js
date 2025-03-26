/**
 * Audio recording functionality using MediaStream Recording API
 */

// State variables
let mediaRecorder = null;
let audioStream = null;
let isRecording = false;
let isPaused = false;
let mouseData = [];
let audioChunks = [];
let recordingTimerInterval = null;
let recordingStartTime = 0;
let pauseStartTime = 0;
let pausedTime = 0;

document.addEventListener('DOMContentLoaded', function() {
    console.log('Recording system initialized');
    logMessage('Recording system initialized');
});

/**
 * Toggle recording on/off
 */
function toggleRecording() {
    console.log('toggleRecording called - current state:', isRecording);
    
    const recordBtn = document.getElementById('record-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    const recordingTimer = document.getElementById('recording-timer');
    const volumeMeter = document.getElementById('volume-meter');
    
    if (isRecording) {
        // Stop recording
        console.log('Stopping recording');
        
        isRecording = false;
        isPaused = false;
        recordBtn.textContent = 'Start Recording';
        recordBtn.classList.replace('btn-secondary', 'btn-danger');
        pauseBtn.disabled = true;
        
        if (recordingIndicator) recordingIndicator.style.display = 'none';
        if (recordingTimer) recordingTimer.style.display = 'none'; 
        if (volumeMeter) volumeMeter.style.display = 'none';
        
        // Stop timer
        clearInterval(recordingTimerInterval);
        
        // Stop audio recording
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
        
        logMessage('Recording stopped');
    } else {
        // Start recording
        console.log('Starting recording');
        
        // Reset recording data
        audioChunks = [];
        mouseData = [];
        pausedTime = 0;
        
        isRecording = true;
        isPaused = false;
        recordBtn.textContent = 'Stop Recording';
        recordBtn.classList.replace('btn-danger', 'btn-secondary');
        pauseBtn.disabled = false;
        
        if (recordingIndicator) {
            recordingIndicator.style.display = 'inline';
            recordingIndicator.style.color = 'red';
        }
        if (recordingTimer) recordingTimer.style.display = 'inline';
        if (volumeMeter) volumeMeter.style.display = 'block';
        
        // Start recording timer
        recordingStartTime = Date.now();
        if (recordingTimer) recordingTimer.textContent = '00:00';
        recordingTimerInterval = setInterval(updateRecordingTimer, 1000);
        
        // Start audio recording
        startAudioRecording();
        
        logMessage('Recording started');
    }
}

/**
 * Update the recording timer display
 */
function updateRecordingTimer() {
    if (!isRecording) return;
    
    let elapsedMilliseconds = Date.now() - recordingStartTime - pausedTime;
    if (isPaused) {
        elapsedMilliseconds = pauseStartTime - recordingStartTime - pausedTime;
    }
    
    const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
    const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
    
    document.getElementById('recording-timer').textContent = `${minutes}:${seconds}`;
}

/**
 * Start audio recording
 */
function startAudioRecording() {
    // Check if browser supports getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('getUserMedia not supported');
        logMessage('ERROR: Browser does not support audio recording');
        return;
    }
    
    console.log('Requesting microphone access...');
    logMessage('Requesting microphone access...');
    
    navigator.mediaDevices.getUserMedia({ 
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        } 
    })
    .then(function(stream) {
        console.log('Microphone access granted');
        logMessage('Microphone access granted');
        audioStream = stream;
        
        // Create MediaRecorder
        try {
            // Try different mimeTypes
            let options = {};
            const mimeTypes = [
                'audio/webm',
                'audio/webm;codecs=opus',
                'audio/ogg;codecs=opus',
                'audio/mp4'
            ];
            
            // Find the first supported mimeType
            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    options.mimeType = mimeType;
                    console.log(`Using mimeType: ${mimeType}`);
                    break;
                }
            }
            
            // Create audio context for volume meter
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            // Use a moderate FFT size for good frequency resolution while still being responsive
            analyser.fftSize = 128; // Medium size for balance between responsiveness and accuracy
            analyser.smoothingTimeConstant = 0.3; // Increased for smoother response
            source.connect(analyser);
            
            // Start volume meter
            const volumeLevel = document.getElementById('volume-level');
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            function updateVolumeMeter() {
                if (!isRecording) return;
                
                // Only update when not paused
                if (!isPaused) {
                    analyser.getByteFrequencyData(dataArray);
                    
                    // Focus on voice frequencies (approximately bins 2-20 for 128 FFT size)
                    // Human voice is typically between 85Hz-400Hz
                    let voiceSum = 0;
                    let voiceCount = 0;
                    
                    // Calculate frequency per bin based on sample rate and FFT size
                    const sampleRate = audioContext.sampleRate;
                    const binSize = sampleRate / analyser.fftSize;
                    
                    // Loop through frequency data focusing on voice range
                    for (let i = 0; i < dataArray.length; i++) {
                        const frequency = i * binSize;
                        // Weight frequencies in human voice range (85-400Hz) more heavily
                        if (frequency >= 85 && frequency <= 1000) {
                            // Apply higher weight to the core voice frequencies
                            const weight = (frequency >= 150 && frequency <= 400) ? 2.0 : 1.0;
                            voiceSum += dataArray[i] * weight;
                            voiceCount += weight;
                        }
                    }
                    
                    // Calculate weighted average of voice frequencies
                    const voiceAverage = voiceCount > 0 ? voiceSum / voiceCount : 0;
                    
                    // Apply moderate non-linear scaling
                    const scaledValue = Math.pow(voiceAverage / 255, 0.8) * 100;
                    
                    // Apply balanced damping (40% old, 60% new)
                    const currentWidth = parseFloat(volumeLevel.style.width) || 0;
                    const newWidth = currentWidth * 0.4 + scaledValue * 0.6;
                    
                    volumeLevel.style.width = `${newWidth}%`;
                }
                
                requestAnimationFrame(updateVolumeMeter);
            }
            
            updateVolumeMeter();
            
            // Create and start MediaRecorder
            mediaRecorder = new MediaRecorder(stream, options);
            
            mediaRecorder.ondataavailable = function(event) {
                console.log('Data available event fired');
                if (event.data && event.data.size > 0) {
                    audioChunks.push(event.data);
                    console.log('Received audio chunk');
                }
            };
            
            mediaRecorder.onstart = function() {
                console.log('MediaRecorder started');
                logMessage('Audio recording started');
            };
            
            mediaRecorder.onpause = function() {
                console.log('MediaRecorder paused');
                logMessage('Audio recording paused');
            };
            
            mediaRecorder.onresume = function() {
                console.log('MediaRecorder resumed');
                logMessage('Audio recording resumed');
            };
            
            mediaRecorder.onstop = function() {
                console.log('MediaRecorder stopped');
                
                if (audioChunks.length > 0) {
                    const audioBlob = new Blob(audioChunks, { type: options.mimeType || 'audio/webm' });
                    console.log('Audio recording completed: ' + audioBlob.size + ' bytes');
                    logMessage('Audio recording completed: ' + audioBlob.size + ' bytes');
                    
                    // Save the blob for later use
                    window.audioBlob = audioBlob;
                    
                    // Create an audio element for testing
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    audio.controls = true;
                    document.body.appendChild(audio);
                    logMessage('Audio added to page for testing');
                } else {
                    console.warn('No audio chunks recorded');
                    logMessage('Warning: No audio data was captured');
                }
            };
            
            // Start recording with 100ms timeslice to get data frequently
            mediaRecorder.start(100);
            
        } catch (error) {
            console.error('Error creating MediaRecorder:', error);
            logMessage('Error setting up audio recording: ' + error.message);
        }
    })
    .catch(function(error) {
        console.error('Error accessing microphone:', error);
        logMessage('Error accessing microphone: ' + error.message);
    });
}

/**
 * Pause or resume recording
 */
function pauseResumeRecording() {
    console.log('pauseResumeRecording called - current state:', isRecording, 'isPaused:', isPaused);
    
    if (!isRecording) return;
    
    const pauseBtn = document.getElementById('pause-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    
    if (!isPaused) {
        // Pause recording
        isPaused = true;
        pauseStartTime = Date.now();
        pauseBtn.textContent = 'Resume Recording';
        if (recordingIndicator) recordingIndicator.style.color = 'orange';
        
        // Pause audio recording
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            try {
                mediaRecorder.pause();
                console.log('MediaRecorder paused');
            } catch (error) {
                console.error('Error pausing MediaRecorder:', error);
                logMessage('Error: This browser might not support pausing recordings');
            }
        }
        
        logMessage('Recording paused');
    } else {
        // Resume recording
        const pauseDuration = Date.now() - pauseStartTime;
        pausedTime += pauseDuration;
        
        isPaused = false;
        pauseBtn.textContent = 'Pause Recording';
        if (recordingIndicator) recordingIndicator.style.color = 'red';
        
        // Resume audio recording
        if (mediaRecorder && mediaRecorder.state === 'paused') {
            try {
                mediaRecorder.resume();
                console.log('MediaRecorder resumed');
            } catch (error) {
                console.error('Error resuming MediaRecorder:', error);
                logMessage('Error: This browser might not support resuming recordings');
            }
        }
        
        logMessage('Recording resumed');
    }
}

/**
 * Helper function to log messages
 */
function logMessage(message) {
    const logArea = document.getElementById('log-area');
    if (logArea) {
        const timestamp = new Date().toISOString().substring(11, 19);
        logArea.value += `[${timestamp}] ${message}\n`;
        logArea.scrollTop = logArea.scrollHeight;
    } else {
        console.log(message);
    }
} 