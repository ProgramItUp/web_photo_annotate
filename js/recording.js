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
let audioBlob = null;

// Tracking variable for mouse move throttling
let lastMouseMoveCapture = 0;
const MOUSE_MOVE_CAPTURE_INTERVAL = 50; // Capture at most every 50ms (20 points per second)

// Expose recording state to other modules
window.isRecording = function() { return isRecording; };
window.isPaused = function() { return isPaused; };
window.mouseData = mouseData;  // Make mouseData available to other modules

// Add hook to capture cursor trail updates directly
window.updateCursorTrailPosition = function(x, y) {
    // If we are recording, also store this position in the mouse data
    if (isRecording && !isPaused) {
        const now = Date.now();
        // Don't throttle laser pointer movements for better trail quality
        const isLaserActive = true; // If this function is called, we know laser is active
        
        // Get elapsed recording time
        const elapsedTimeMs = getCurrentRecordingTime();
        
        // Store mouse data with timestamp
        mouseData.push({
            type: 'move',
            x: x,
            y: y,
            timeOffset: elapsedTimeMs, // Time in ms from recording start
            realTime: now,
            isLaserPointer: isLaserActive, // This is definitely a laser pointer movement
            source: 'cursorTrail' // Mark the source of this data point
        });
        
        // Log occasionally to prevent log spam
        if (now % 1000 < 20) {
            logMessage(`Captured cursor trail position: X: ${Math.round(x)}, Y: ${Math.round(y)}`, 'DEBUG');
        }
    }
};

// Add direct mouse event capture functions
window.captureMouseDownDirect = function(x, y, button) {
    if (!isRecording || isPaused) return;
    
    const now = Date.now();
    const elapsedTimeMs = getCurrentRecordingTime();
    
    // Log that we're capturing this event
    logMessage(`Direct capture of mouse down: X: ${Math.round(x)}, Y: ${Math.round(y)}, button: ${button}`, 'DEBUG');
    
    // Store in mouse data
    mouseData.push({
        type: 'down',
        button: button,
        x: x,
        y: y,
        timeOffset: elapsedTimeMs,
        realTime: now,
        isLaserPointer: true, // Since this comes from cursor trail system
        source: 'direct' // Mark the source
    });
};

window.captureMouseUpDirect = function(x, y, button) {
    if (!isRecording || isPaused) return;
    
    const now = Date.now();
    const elapsedTimeMs = getCurrentRecordingTime();
    
    // Log that we're capturing this event
    logMessage(`Direct capture of mouse up: X: ${Math.round(x)}, Y: ${Math.round(y)}, button: ${button}`, 'DEBUG');
    
    // Store in mouse data
    mouseData.push({
        type: 'up',
        button: button,
        x: x,
        y: y,
        timeOffset: elapsedTimeMs,
        realTime: now,
        isLaserPointer: true, // Since this comes from cursor trail system
        source: 'direct' // Mark the source
    });
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('Recording system initialized');
    // Make sure logMessage exists before calling it
    if (typeof logMessage === 'function') {
        logMessage('Recording system initialized', 'DEBUG');
    }
    
    // Initialize recording buttons
    initializeRecordingButtons();
});

/**
 * Initialize recording buttons with event listeners
 */
function initializeRecordingButtons() {
    // Record button
    const recordBtn = document.getElementById('record-btn');
    if (recordBtn) {
        recordBtn.addEventListener('click', toggleRecording);
        logMessage('Record button enabled', 'DEBUG');
    }
    
    // Pause button
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', pauseResumeRecording);
        logMessage('Pause button enabled', 'DEBUG');
    }
    
    // Save button
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveAnnotationData);
        logMessage('Save button enabled', 'DEBUG');
    }
    
    // Load button
    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
        loadBtn.addEventListener('click', function() {
            // Trigger the hidden file input
            document.getElementById('load-file').click();
        });
        
        // Set up the actual file input handler
        const loadFile = document.getElementById('load-file');
        if (loadFile) {
            loadFile.addEventListener('change', loadAnnotationData);
        }
        
        logMessage('Load button enabled', 'DEBUG');
    }
    
    // Replay button
    const replayBtn = document.getElementById('replay-btn');
    if (replayBtn) {
        replayBtn.addEventListener('click', replayAnnotation);
        logMessage('Replay button enabled', 'DEBUG');
    }
    
    // Email button
    const emailBtn = document.getElementById('email-btn');
    if (emailBtn) {
        emailBtn.addEventListener('click', function() {
            // Show notification that email generation is in progress
            const notification = document.createElement('div');
            notification.className = 'alert alert-info position-fixed top-50 start-50 translate-middle';
            notification.style.zIndex = '9999';
            notification.style.maxWidth = '350px';
            notification.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
                    <div>Preparing email data...</div>
                    <div class="small text-muted">This may take a few seconds</div>
                </div>
            `;
            document.body.appendChild(notification);
            
            // Execute the prepareEmailData function directly (renamed from sendEmail)
            prepareEmailData('user@example.com', 'User', notification);
        });
        
        logMessage('Email button enabled', 'DEBUG');
    }
}

/**
 * Toggle recording on/off
 */
function toggleRecording() {
    if (!isRecording) {
        // Start recording
        startAudioRecording();
    } else {
        // Stop recording
        stopAudioRecording();
    }
}

/**
 * Update the recording timer display
 */
function updateRecordingTimer() {
    if (!isRecording) return;
    
    const recordingTimer = document.getElementById('recording-timer');
    if (!recordingTimer) return;
    
    // Calculate elapsed time accounting for pauses
    const now = Date.now();
    let elapsedTimeMs = now - recordingStartTime - pausedTime;
    
    // If currently paused, don't include time since pause started
    if (isPaused) {
        elapsedTimeMs -= (now - pauseStartTime);
    }
    
    // Format time as MM:SS
    const totalSeconds = Math.floor(elapsedTimeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    recordingTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Start audio recording
 */
function startAudioRecording() {
    // Check if mediaRecorder is already active
    if (isRecording) return;
    
    logMessage('Requesting microphone access...', 'INFO');
    
    // Request microphone access
    navigator.mediaDevices.getUserMedia({ audio: true })
    .then(function(stream) {
        audioStream = stream;
            
            // Create new media recorder from the audio stream
            mediaRecorder = new MediaRecorder(stream);
            
            // Set up event handlers for the media recorder
            mediaRecorder.ondataavailable = function(event) {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = function() {
                // Combine recorded audio chunks into a single blob
                audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                
                // Update UI
                updateRecordingUI(false);
                
                logMessage('Recording stopped', 'INFO');
            };
            
            // Clear existing data
            audioChunks = [];
            mouseData = [];
            
            // Start capturing mouse data
            startCaptureMouseData();
            
            // Start recording
            mediaRecorder.start();
            isRecording = true;
        isPaused = false;
            
            // Record the start time and reset paused time
            recordingStartTime = Date.now();
            pausedTime = 0;
            
            // Start timer updates
            recordingTimerInterval = setInterval(updateRecordingTimer, 1000);
            
            // Update UI
            updateRecordingUI(true);
            
            // Start updating volume meter
            startVolumeMeter(stream);
            
            logMessage('Recording started', 'INFO');
    })
    .catch(function(error) {
        console.error('Error accessing microphone:', error);
            logMessage('Error accessing microphone: ' + error.message, 'ERROR');
    });
}

/**
 * Stop audio recording
 */
function stopAudioRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    // Stop the media recorder
    mediaRecorder.stop();
    
    // Stop all tracks in the stream to release the microphone
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
    }
    
    // Clear the timer interval
    if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = null;
    }
    
    // Stop capturing mouse data
    stopCaptureMouseData();
    
    // Stop volume meter
    stopVolumeMeter();
    
    // Reset state
    isRecording = false;
        isPaused = false;
    
    logMessage('Recording ended', 'INFO');
}

/**
 * Toggle pause/resume recording
 */
function pauseResumeRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    if (!isPaused) {
        // Pause recording
        mediaRecorder.pause();
        isPaused = true;
        pauseStartTime = Date.now();
        
        // Update UI
        updatePauseUI(true);
        
        logMessage('Recording paused', 'INFO');
    } else {
        // Resume recording
        mediaRecorder.resume();
        isPaused = false;
        
        // Update paused time
        pausedTime += (Date.now() - pauseStartTime);
        
        // Update UI
        updatePauseUI(false);
        
        logMessage('Recording resumed', 'INFO');
    }
}

/**
 * Update recording UI elements
 * @param {boolean} isRecording - Whether recording is active
 */
function updateRecordingUI(isRecording) {
    // Update record button
    const recordBtn = document.getElementById('record-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    const volumeMeter = document.getElementById('volume-meter');
    
    if (recordBtn) {
        recordBtn.textContent = isRecording ? 'Stop Recording' : 'Start Recording';
        recordBtn.classList.toggle('btn-danger', isRecording);
        recordBtn.classList.toggle('btn-success', !isRecording);
    }
    
    if (pauseBtn) {
        pauseBtn.disabled = !isRecording;
        pauseBtn.textContent = 'Pause Recording';
    }
        
        if (recordingIndicator) {
        recordingIndicator.style.display = isRecording ? 'inline' : 'none';
    }
    
    if (volumeMeter) {
        volumeMeter.style.display = isRecording ? 'block' : 'none';
    }
}

/**
 * Update pause UI elements
 * @param {boolean} isPaused - Whether recording is paused
 */
function updatePauseUI(isPaused) {
    const pauseBtn = document.getElementById('pause-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    
    if (pauseBtn) {
        pauseBtn.textContent = isPaused ? 'Resume Recording' : 'Pause Recording';
        pauseBtn.classList.toggle('btn-warning', !isPaused);
        pauseBtn.classList.toggle('btn-info', isPaused);
    }
    
    if (recordingIndicator) {
        recordingIndicator.textContent = isPaused ? '❚❚ Paused' : '● Recording';
    }
}

/**
 * Start capturing mouse movement data
 */
function startCaptureMouseData() {
    // Clear existing mouse data
    mouseData = [];
    
    // Set up the mouse move listener on the canvas
    if (window.canvas) {
        // Get canvas element
        const canvasEl = window.canvas.getElement();
        
        // Add mouse move listener
        canvasEl.addEventListener('mousemove', captureMouseMove);
        
        // Add mouse down/up listeners to track interactions
        canvasEl.addEventListener('mousedown', captureMouseDown);
        canvasEl.addEventListener('mouseup', captureMouseUp);
        
        logMessage('Mouse data capture started', 'DEBUG');
        logMessage('Mouse events will be captured and stored in the JSON', 'INFO');
    } else {
        logMessage('Canvas not available for mouse tracking', 'WARN');
    }
}

/**
 * Stop capturing mouse movement data
 */
function stopCaptureMouseData() {
    if (window.canvas) {
        // Get canvas element
        const canvasEl = window.canvas.getElement();
        
        // Remove event listeners
        canvasEl.removeEventListener('mousemove', captureMouseMove);
        canvasEl.removeEventListener('mousedown', captureMouseDown);
        canvasEl.removeEventListener('mouseup', captureMouseUp);
        
        // Log details about the captured mouse data
        logMessage('Mouse data capture stopped', 'DEBUG');
        
        // Count different types of mouse events
        const moveCount = mouseData.filter(d => d.type === 'move').length;
        const downCount = mouseData.filter(d => d.type === 'down').length;
        const upCount = mouseData.filter(d => d.type === 'up').length;
        const laserCount = mouseData.filter(d => d.isLaserPointer).length;
        
        logMessage(`Captured ${mouseData.length} mouse data points total:`, 'INFO');
        logMessage(`- ${moveCount} move events`, 'INFO');
        logMessage(`- ${downCount} down events`, 'INFO');
        logMessage(`- ${upCount} up events`, 'INFO');
        logMessage(`- ${laserCount} laser pointer events`, 'INFO');
        
        // Log a few sample points if available
        if (mouseData.length > 0) {
            logMessage('Sample mouse data point:', 'DEBUG');
            logMessage(JSON.stringify(mouseData[0], null, 2), 'DEBUG');
        } else {
            logMessage('WARNING: No mouse data was captured during recording!', 'WARN');
            logMessage('Check that the mouse event listeners are working properly', 'DEBUG');
        }
    }
}

/**
 * Capture mouse move event with timing
 * @param {MouseEvent} e - Mouse event
 */
function captureMouseMove(e) {
    if (!isRecording) return;
    
    const now = Date.now();
    
    // Get multiple ways to check if laser is active
    const isLaserActive = 
        window.showCursorTail === true || 
        window.cursorTrailActive === true ||
        document.body.classList.contains('laser-active');
    
    // Throttle mouse move events to avoid excessive data points
    // Only capture if it's been at least MOUSE_MOVE_CAPTURE_INTERVAL ms since last capture
    // Exception: always capture if laser pointer is active (for better trail quality)
    if (!isLaserActive && now - lastMouseMoveCapture < MOUSE_MOVE_CAPTURE_INTERVAL) {
        return;
    }
    
    // Update last capture time
    lastMouseMoveCapture = now;
    
    // Get canvas and position
    const canvas = window.canvas;
    const pointer = canvas.getPointer(e);
    
    // Get elapsed recording time
    const elapsedTimeMs = getCurrentRecordingTime();
    
    // Log what we're capturing (but not too often to avoid log spam)
    if (now % 500 < 50) { // Only log approximately every 500ms
        logMessage(`Capturing mouse move: X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}, laser: ${isLaserActive}`, 'DEBUG');
    }
    
    // Store mouse data with timestamp
    mouseData.push({
        type: 'move',
        x: pointer.x,
        y: pointer.y,
        timeOffset: elapsedTimeMs, // Time in ms from recording start
        realTime: now,
        isLaserPointer: isLaserActive // Flag if this is a laser pointer movement
    });
}

/**
 * Capture mouse down event with timing
 * @param {MouseEvent} e - Mouse event
 */
function captureMouseDown(e) {
    if (!isRecording) return;
    
    // Get canvas and position
    const canvas = window.canvas;
    const pointer = canvas.getPointer(e);
    
    // Get elapsed recording time
    const elapsedTimeMs = getCurrentRecordingTime();
    
    // Check if cursor trail/laser pointer is enabled - try multiple ways to detect this
    const isLaserEnabled = 
        window.cursorTrailEnabled === true || 
        window.laserEnabled === true || 
        (typeof getCurrentTool === 'function' && getCurrentTool() === 'laser');
    
    // Debug log all the different ways to check if laser is enabled
    logMessage(`Laser detection - cursorTrailEnabled: ${window.cursorTrailEnabled}, ` +
               `laserEnabled: ${window.laserEnabled}, ` +
               `getCurrentTool: ${typeof getCurrentTool === 'function' ? getCurrentTool() : 'undefined'}`, 'DEBUG');
    
    // Log what we're capturing
    logMessage(`Capturing mouse down: X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}, button: ${e.button}, laser: ${isLaserEnabled}`, 'DEBUG');
    
    // Store mouse data with timestamp
    mouseData.push({
        type: 'down',
        button: e.button,
        x: pointer.x,
        y: pointer.y,
        timeOffset: elapsedTimeMs, // Time in ms from recording start
        realTime: Date.now(),
        isLaserPointer: isLaserEnabled && e.button === 0 // Flag if this is a laser pointer activation
    });
}

/**
 * Capture mouse up event with timing
 * @param {MouseEvent} e - Mouse event
 */
function captureMouseUp(e) {
    if (!isRecording) return;
    
    // Get canvas and position
    const canvas = window.canvas;
    const pointer = canvas.getPointer(e);
    
    // Get elapsed recording time
    const elapsedTimeMs = getCurrentRecordingTime();
    
    // Check if cursor trail/laser pointer was active (now being deactivated)
    const wasLaserActive = window.showCursorTail === true;
    
    // Log what we're capturing
    logMessage(`Capturing mouse up: X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}, button: ${e.button}, laser: ${wasLaserActive}`, 'DEBUG');
    
    // Store mouse data with timestamp
    mouseData.push({
        type: 'up',
        button: e.button,
        x: pointer.x,
        y: pointer.y,
        timeOffset: elapsedTimeMs, // Time in ms from recording start
        realTime: Date.now(),
        isLaserPointer: wasLaserActive && e.button === 0 // Flag if this is ending a laser pointer session
    });
}

/**
 * Get current recording time in milliseconds, accounting for pauses
 * @returns {number} Time in milliseconds
 */
function getCurrentRecordingTime() {
    if (!recordingStartTime) return 0;
    
    // Calculate elapsed time accounting for pauses
    const now = Date.now();
    let elapsedTimeMs = now - recordingStartTime - pausedTime;
    
    // If currently paused, don't include time since pause started
    if (isPaused && pauseStartTime) {
        elapsedTimeMs -= (now - pauseStartTime);
    }
    
    return elapsedTimeMs;
}

/**
 * Start volume meter visualization
 * @param {MediaStream} stream - The audio stream
 */
function startVolumeMeter(stream) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
            source.connect(analyser);
            
        // Store reference to audio context for later cleanup
        window.currentAudioContext = audioContext;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
            
            function updateVolumeMeter() {
                if (!isRecording) return;
                
            // Get volume data
                    analyser.getByteFrequencyData(dataArray);
                    
            // Calculate average volume level (0-100%)
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const volumePercent = Math.min(100, Math.round((average / 255) * 100 * 2)); // Scale up for better visibility
            
            // Update volume meter
            const volumeLevel = document.getElementById('volume-level');
            if (volumeLevel) {
                volumeLevel.style.width = volumePercent + '%';
            }
            
            // Continue updating
            if (isRecording) {
                requestAnimationFrame(updateVolumeMeter);
            }
        }
        
        // Start updating
        requestAnimationFrame(updateVolumeMeter);
        
        logMessage('Volume meter started', 'DEBUG');
    } catch (error) {
        console.error('Error starting volume meter:', error);
        logMessage('Error starting volume meter: ' + error.message, 'ERROR');
    }
}

/**
 * Stop volume meter visualization
 */
function stopVolumeMeter() {
    try {
        // Close audio context if it exists
        if (window.currentAudioContext) {
            window.currentAudioContext.close();
            window.currentAudioContext = null;
        }
        
        // Reset volume meter display
        const volumeLevel = document.getElementById('volume-level');
        if (volumeLevel) {
            volumeLevel.style.width = '0%';
        }
        
        logMessage('Volume meter stopped', 'DEBUG');
    } catch (error) {
        console.error('Error stopping volume meter:', error);
    }
}

/**
 * Save annotation data to a file
 */
function saveAnnotationData() {
    try {
        logMessage('Preparing annotation data for download...', 'INFO');
        
        // Check if we have a canvas with an image
        if (!window.canvas) {
            logMessage('No canvas found to save image data', 'WARN');
            return;
        }
        
        // Get current timestamp for filename
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const filename = `annotation-data-${timestamp}.json`;
        
        // Create a comprehensive data object
        const annotationData = {
            timestamp: timestamp,
            image: {
                dataUrl: null,  // Will be populated with image data
                width: 0,
                height: 0
            },
            audio: {
                dataUrl: null,  // Will be populated with audio data
                duration: 0
            },
            mouseData: mouseData || [],
            annotations: []  // Will contain drawing annotations
        };
        
        // 1. Get image data
        getImageDataFromCanvas()
            .then(imageData => {
                annotationData.image = imageData;
                logMessage('Image data captured', 'DEBUG');
                return getAudioData();
            })
            .then(audioData => {
                annotationData.audio = audioData;
                logMessage('Audio data captured', 'DEBUG');
                return getAnnotationsFromCanvas();
            })
            .then(annotations => {
                annotationData.annotations = annotations;
                logMessage('Annotation data captured', 'DEBUG');
                
                // Create abbreviated version for logging
                const logVersion = JSON.parse(JSON.stringify(annotationData));
                
                // Truncate image data URL
                if (logVersion.image && logVersion.image.dataUrl) {
                    const dataUrlPrefix = logVersion.image.dataUrl.substring(0, 50);
                    logVersion.image.dataUrl = dataUrlPrefix + '... [truncated]';
                }
                
                // Truncate audio data URL
                if (logVersion.audio && logVersion.audio.dataUrl) {
                    const audioUrlPrefix = logVersion.audio.dataUrl.substring(0, 50);
                    logVersion.audio.dataUrl = audioUrlPrefix + '... [truncated]';
                }
                
                // Log the abbreviated JSON
                logMessage('Annotation data JSON (abbreviated):', 'INFO');
                logMessage(JSON.stringify(logVersion, null, 2), 'INFO');
                
                // Create and download the JSON file
                const jsonString = JSON.stringify(annotationData, null, 2);
                const jsonBlob = new Blob([jsonString], { type: 'application/json' });
                
                // Download the file
                downloadFile(jsonBlob, filename);
                
                logMessage(`Annotation data saved to ${filename}`, 'INFO');
            })
            .catch(error => {
                console.error('Error saving annotation data:', error);
                logMessage('Error saving annotation data: ' + error.message, 'ERROR');
            });
    } catch (error) {
        console.error('Error in saveAnnotationData:', error);
        logMessage('Error saving data: ' + error.message, 'ERROR');
    }
}

/**
 * Get image data from the canvas
 * @returns {Promise} Promise that resolves with image data object
 */
function getImageDataFromCanvas() {
    return new Promise((resolve, reject) => {
        try {
            const canvas = window.canvas;
            if (!canvas) {
                return reject(new Error('Canvas not available'));
            }
            
            // Find image object on canvas
            const objects = canvas.getObjects();
            const imgObject = objects.find(obj => obj.type === 'image');
            
            if (!imgObject) {
                return reject(new Error('No image found on canvas'));
            }
            
            // Get image dimensions
            const width = imgObject.width * imgObject.scaleX;
            const height = imgObject.height * imgObject.scaleY;
            
            // Convert canvas to data URL
            let dataUrl;
            try {
                // Try to get data URL directly from canvas
                dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            } catch (e) {
                console.warn('Could not get dataURL from main canvas, creating temporary canvas', e);
                
                // Create a temporary canvas with just the image
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const ctx = tempCanvas.getContext('2d');
                
                // Draw image to temp canvas
                imgObject.clone(function(cloned) {
                    cloned.set({
                        left: 0,
                        top: 0,
                        scaleX: 1,
                        scaleY: 1
                    });
                    
                    tempCanvas.width = width;
                    tempCanvas.height = height;
                    
                    cloned.render(ctx);
                    dataUrl = tempCanvas.toDataURL('image/jpeg', 0.8);
                    
                    resolve({
                        dataUrl: dataUrl,
                        width: width,
                        height: height,
                        originalWidth: imgObject.width,
                        originalHeight: imgObject.height
                    });
                });
                return; // Don't resolve here, it will be resolved in the clone callback
            }
            
            // If we got here, we have a dataUrl from the main canvas
            resolve({
                dataUrl: dataUrl,
                width: width,
                height: height,
                originalWidth: imgObject.width,
                originalHeight: imgObject.height
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Get audio data as base64
 * @returns {Promise} Promise that resolves with audio data object
 */
function getAudioData() {
    return new Promise((resolve, reject) => {
        try {
            if (!audioBlob) {
                // No audio recording, return empty audio data
                return resolve({
                    dataUrl: null,
                    duration: 0
                });
            }
            
            // Convert audio blob to base64 data URL
            const reader = new FileReader();
            reader.onload = function(e) {
                const dataUrl = e.target.result;
                
                // Calculate audio duration based on recording time
                const duration = recordingStartTime ? 
                    (Date.now() - recordingStartTime - pausedTime) / 1000 : 0;
                
                resolve({
                    dataUrl: dataUrl,
                    duration: duration,
                    format: 'audio/webm'
                });
            };
            
            reader.onerror = function() {
                reject(new Error('Error reading audio data'));
            };
            
            reader.readAsDataURL(audioBlob);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Get annotations from canvas
 * @returns {Promise} Promise that resolves with annotation objects
 */
function getAnnotationsFromCanvas() {
    return new Promise((resolve, reject) => {
        try {
            const canvas = window.canvas;
            if (!canvas) {
                return resolve([]);
            }
            
            // Get all objects from canvas except the main image
            const objects = canvas.getObjects();
            const annotations = objects
                .filter(obj => obj.type !== 'image' && !obj.isCursorTrail)
                .map(obj => {
                    // Basic properties all objects have
                    const annotation = {
                        type: obj.type,
                        left: obj.left,
                        top: obj.top,
                        width: obj.width,
                        height: obj.height,
                        angle: obj.angle,
                        timestamp: obj.timestamp || Date.now(), // When this annotation was created
                        properties: {
                            fill: obj.fill,
                            stroke: obj.stroke,
                            strokeWidth: obj.strokeWidth
                        }
                    };
                    
                    // Additional properties for specific types
                    if (obj.type === 'path') {
                        annotation.path = obj.path;
                    } else if (obj.type === 'text') {
                        annotation.text = obj.text;
                        annotation.fontSize = obj.fontSize;
                        annotation.fontFamily = obj.fontFamily;
                    }
                    
                    return annotation;
                });
            
            // Include laser pointer data from mouse movements
            // Filter mouse data for times when laser pointer was active
            const laserPointerData = mouseData.filter(data => 
                // Check for laser pointer activation by time and mouse down state
                data.isLaserPointer || // If it's explicitly marked
                (data.type === 'down' || 
                (data.button === 0 && data.type === 'move' && window.showCursorTail))
            );
            
            if (laserPointerData.length > 0) {
                // Group laser pointer points into sessions (each mouse down to mouse up)
                let currentSession = [];
                let sessions = [];
                
                laserPointerData.forEach(point => {
                    if (point.type === 'down') {
                        // Start a new session
                        if (currentSession.length > 0) {
                            sessions.push(currentSession);
                        }
                        currentSession = [point];
                    } else if (point.type === 'up') {
                        // End the current session
                        currentSession.push(point);
                        sessions.push(currentSession);
                        currentSession = [];
                } else {
                        // Add to current session
                        currentSession.push(point);
                    }
                });
                
                // Add the last session if it exists
                if (currentSession.length > 0) {
                    sessions.push(currentSession);
                }
                
                // Convert sessions to annotation objects
                sessions.forEach((session, index) => {
                    if (session.length < 2) return; // Skip sessions with just one point
                    
                    const startTime = session[0].timeOffset;
                    const endTime = session[session.length - 1].timeOffset;
                    
                    // Create an annotation for this laser pointer session
                    const laserAnnotation = {
                        type: 'laserPointer',
                        sessionId: index,
                        startTime: startTime,
                        endTime: endTime,
                        duration: endTime - startTime,
                        points: session.map(point => ({
                            x: point.x,
                            y: point.y,
                            timeOffset: point.timeOffset,
                            type: point.type || 'move'
                        })),
                        timestamp: session[0].realTime || Date.now()
                    };
                    
                    annotations.push(laserAnnotation);
                });
                
                logMessage(`Added ${sessions.length} laser pointer sessions to annotations`, 'DEBUG');
            }
            
            resolve(annotations);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Download a file using the FileSaver.js library
 * @param {Blob} blob - The data to download
 * @param {string} filename - The name of the file to download
 */
function downloadFile(blob, filename) {
    try {
        // Check if FileSaver.js is available
        if (typeof saveAs === 'function') {
            saveAs(blob, filename);
            logMessage(`File "${filename}" downloaded`, 'INFO');
        } else {
            // Fallback if FileSaver.js is not available
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            logMessage(`File "${filename}" downloaded (fallback method)`, 'INFO');
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        logMessage('Error downloading file: ' + error.message, 'ERROR');
    }
}

/**
 * Load annotation data from a JSON file
 */
function loadAnnotationData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        // Read the JSON file
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                // Store the mouse data
                mouseData = data.mouseData || [];
                
                logMessage('Annotation data loaded', 'INFO');
            } catch (jsonError) {
                console.error('Error parsing JSON:', jsonError);
                logMessage('Error parsing JSON: ' + jsonError.message, 'ERROR');
            }
        };
        
        reader.onerror = function() {
            logMessage('Error reading file', 'ERROR');
        };
        
        reader.readAsText(file);
            } catch (error) {
        console.error('Error loading annotation data:', error);
        logMessage('Error loading annotation data: ' + error.message, 'ERROR');
    }
}

/**
 * Play back the recorded annotation data
 */
function replayAnnotation() {
    if (!audioBlob && mouseData.length === 0) {
        logMessage('No recording or annotation data to replay', 'WARN');
        return;
    }
    
    try {
        logMessage('Starting replay of annotation data', 'INFO');
        
        // Create a replay cursor if it doesn't exist
        createReplayCursor();
        
        // Variables to track replay state
        let isReplaying = true;
        let replayStartTime = Date.now();
        let audioElement = null;
        let animationFrameId = null;
        
        // If we have audio, play it
        if (audioBlob) {
            const audioURL = URL.createObjectURL(audioBlob);
            audioElement = new Audio(audioURL);
            
            // Set up event listeners
            audioElement.onplay = function() {
                logMessage('Audio playback started', 'DEBUG');
                // Reset replay start time when audio actually starts
                replayStartTime = Date.now();
            };
            
            audioElement.onended = function() {
                logMessage('Audio playback ended', 'INFO');
                isReplaying = false;
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
                hideReplayCursor();
                URL.revokeObjectURL(audioURL);
            };
            
            // Play the audio
            audioElement.play().catch(error => {
                logMessage('Error playing audio: ' + error.message, 'ERROR');
                // Continue with cursor replay even if audio fails
            });
        }
        
        // Sort mouse data by timeOffset for reliable playback
        const sortedMouseData = [...mouseData].sort((a, b) => a.timeOffset - b.timeOffset);
        
        // If we have mouse data, animate it
        if (sortedMouseData.length > 0) {
            let currentDataIndex = 0;
            
            // Function to update cursor position based on elapsed time
            function updateCursorPosition() {
                if (!isReplaying) return;
                
                // Calculate elapsed time since replay started
                const elapsedMs = Date.now() - replayStartTime;
                
                // Find all data points that should have happened by now
                while (currentDataIndex < sortedMouseData.length && 
                       sortedMouseData[currentDataIndex].timeOffset <= elapsedMs) {
                    
                    // Get the current data point
                    const dataPoint = sortedMouseData[currentDataIndex];
                    
                    // Update cursor position
                    updateReplayCursor(dataPoint);
                    
                    // Move to next data point
                    currentDataIndex++;
                }
                
                // If we've gone through all data points
                if (currentDataIndex >= sortedMouseData.length) {
                    // If we don't have audio, end the replay
                    if (!audioElement) {
                        isReplaying = false;
                        hideReplayCursor();
                        logMessage('Replay completed', 'INFO');
                        return;
                    }
                } 
                
                // Continue animation
                if (isReplaying) {
                    animationFrameId = requestAnimationFrame(updateCursorPosition);
                }
            }
            
            // Start the animation
            updateCursorPosition();
        } else if (audioElement) {
            // If we only have audio but no mouse data
            logMessage('Playing audio only (no mouse data to replay)', 'INFO');
        }
    } catch (error) {
        console.error('Error replaying annotation:', error);
        logMessage('Error replaying: ' + error.message, 'ERROR');
    }
}

/**
 * Create or get the replay cursor element
 */
function createReplayCursor() {
    // Check if cursor already exists
    let cursor = document.getElementById('replay-cursor');
    if (!cursor) {
        // Create a new cursor element
        cursor = document.createElement('div');
        cursor.id = 'replay-cursor';
        cursor.className = 'replay-cursor';
        cursor.style.position = 'absolute';
        cursor.style.width = '20px';
        cursor.style.height = '20px';
        cursor.style.borderRadius = '50%';
        cursor.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
        cursor.style.border = '2px solid red';
        cursor.style.transform = 'translate(-50%, -50%)';
        cursor.style.pointerEvents = 'none';
        cursor.style.zIndex = '1000';
        cursor.style.display = 'none';
        
        // Add to the canvas container
        const canvasContainer = document.getElementById('image-container');
        if (canvasContainer) {
            canvasContainer.style.position = 'relative'; // Ensure container is positioned
            canvasContainer.appendChild(cursor);
    } else {
            document.body.appendChild(cursor);
        }
    }
    
    // Show the cursor
    cursor.style.display = 'block';
    return cursor;
}

/**
 * Update the replay cursor position
 * @param {Object} dataPoint - Mouse data point with x, y coordinates
 */
function updateReplayCursor(dataPoint) {
    const cursor = document.getElementById('replay-cursor');
    if (!cursor) return;
    
    // Get canvas position and scale
    const canvas = window.canvas;
    if (!canvas) return;
    
    // Calculate position
    const x = dataPoint.x;
    const y = dataPoint.y;
    
    // Update cursor position
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    
    // Show cursor events 
    if (dataPoint.type === 'down') {
        // Mouse down - make cursor larger and more opaque
        cursor.style.width = '24px';
        cursor.style.height = '24px';
        cursor.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        
        // If this is a laser pointer activation, start drawing the trail
        if (dataPoint.isLaserPointer) {
            startLaserTrail();
        }
    } else if (dataPoint.type === 'up') {
        // Mouse up - return to normal
        cursor.style.width = '20px';
        cursor.style.height = '20px';
        cursor.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
        
        // If this is a laser pointer deactivation, clear the trail
        if (dataPoint.isLaserPointer) {
            clearLaserTrail();
        }
    } else if (dataPoint.type === 'move' && dataPoint.isLaserPointer) {
        // If this is a laser pointer movement, add to the trail
        addToLaserTrail(x, y);
    }
    
    // Update coordinates display
    updateCoordinatesDisplay(Math.round(x), Math.round(y));
}

/**
 * Hide the replay cursor
 */
function hideReplayCursor() {
    const cursor = document.getElementById('replay-cursor');
    if (cursor) {
        cursor.style.display = 'none';
    }
    
    // Clear any laser trails
    clearLaserTrail();
    
    // Hide the trail container
    const trailContainer = document.getElementById('laser-trail-container');
    if (trailContainer) {
        trailContainer.style.display = 'none';
    }
    
    // Reset coordinates display
    updateCoordinatesDisplay(0, 0);
}

/**
 * Update coordinates display
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
function updateCoordinatesDisplay(x, y) {
    const coordsDisplay = document.getElementById('coordinates');
    if (coordsDisplay) {
        coordsDisplay.textContent = `Mouse: X: ${x}, Y: ${y}`;
    }
}

/**
 * Prepare email data for sharing
 * @param {string} emailAddress - Recipient email address
 * @param {string} senderName - Sender name
 * @param {HTMLElement} notification - Notification element to remove when done
 */
function prepareEmailData(emailAddress, senderName, notification) {
    // Add visual feedback to the email button
    const emailBtn = document.getElementById('email-btn');
    if (emailBtn) {
        emailBtn.classList.add('btn-processing');
        emailBtn.disabled = true;
    }
    
    logMessage('Email button clicked - preparing email data...', 'INFO');
    
    if (!emailAddress) {
        // Use a default fallback address
        emailAddress = 'user@example.com';
        logMessage('Using default email address', 'WARN');
    }
    
    // Default sender name if not provided
    senderName = senderName || 'Me';
    const senderEmail = 'me@me.com'; // Placeholder email
    
    logMessage(`Preparing email data for ${emailAddress} from ${senderName}...`, 'INFO');
    
    // Create annotation data object similar to when saving
    const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 16);
    const annotationData = {
        timestamp: timestamp,
        image: {
            dataUrl: null,
            width: 0,
            height: 0
        },
        audio: {
            dataUrl: null,
            duration: 0
        },
        mouseData: mouseData || [],
        annotations: []
    };
    
    // Get image data, audio data, and annotations
    getImageDataFromCanvas()
        .then(imageData => {
            annotationData.image = imageData;
            logMessage('Image data captured for email', 'DEBUG');
            return getAudioData();
        })
        .then(audioData => {
            annotationData.audio = audioData;
            logMessage('Audio data captured for email', 'DEBUG');
            return getAnnotationsFromCanvas();
        })
        .then(annotations => {
            annotationData.annotations = annotations;
            logMessage('Annotation data captured for email', 'DEBUG');
            
            try {
                // Convert the JSON to base64 using our utility function
                const base64Data = window.encodeAnnotationData(annotationData);
                
                // Format the email body according to the specification
                const emailBody = `
To: ${emailAddress}
From: ${senderName} <${senderEmail}>
Subject: Annotations from ${timestamp}

This annotation was created on ${new Date().toLocaleString()} by ${senderName}
Annotations start here --->
${base64Data}
<--- Annotations end here
`;
                
                // Log a shortened version of what we're sending
                const previewLength = 50;
                const base64Preview = base64Data.length > previewLength ? 
                    base64Data.substring(0, previewLength) + '...' : 
                    base64Data;
                
                logMessage(`Email content prepared with ${base64Data.length} characters of base64 data`, 'INFO');
                logMessage(`Base64 data preview: ${base64Preview}`, 'DEBUG');
                
                // Remove the notification
                if (notification && notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                
                // Show a dialog with copy options instead of trying to open an email client
                showEmailDataDialog(emailBody, emailAddress, base64Data);
                
                // Reset UI elements
                resetEmailButton();
                
            } catch (error) {
                console.error('Error encoding data for email:', error);
                logMessage('Error encoding data for email: ' + error.message, 'ERROR');
                resetEmailButton();
                if (notification && notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }
        })
        .catch(error => {
            console.error('Error preparing email data:', error);
            logMessage('Error preparing email data: ' + error.message, 'ERROR');
            resetEmailButton();
            if (notification && notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
}

/**
 * Display a dialog with email data and copy options
 * @param {string} emailBody - The full email content
 * @param {string} emailAddress - The target email address
 * @param {string} base64Data - Just the base64 encoded data
 */
function showEmailDataDialog(emailBody, emailAddress, base64Data) {
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal fade';
    modalContainer.id = 'emailDataModal';
    modalContainer.tabIndex = -1;
    modalContainer.setAttribute('role', 'dialog');
    modalContainer.setAttribute('aria-labelledby', 'emailDataModalLabel');
    modalContainer.setAttribute('aria-hidden', 'true');
    
    // Create modal structure
    modalContainer.innerHTML = `
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="emailDataModalLabel">Email Data Ready</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="alert alert-info mb-3">
                    <h6>Your annotation data is ready!</h6>
                    <p>Choose one of the options below to share your data:</p>
                </div>
                
                <div class="row mb-3">
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header bg-primary text-white">
                                <h6 class="mb-0">Option 1: Save as File</h6>
                            </div>
                            <div class="card-body">
                                <p>Save the annotation data as a file to attach to an email later.</p>
                                <button id="saveEmailDataBtn" class="btn btn-primary">Save Data File</button>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header bg-success text-white">
                                <h6 class="mb-0">Option 2: Copy to Clipboard</h6>
                            </div>
                            <div class="card-body">
                                <p>Copy the complete email text to paste into your email client.</p>
                                <button id="copyEmailBtn" class="btn btn-success">Copy Email Text</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mb-3">
                    <label for="emailPreview" class="form-label">Email Preview (first 200 characters):</label>
                    <textarea id="emailPreview" class="form-control font-monospace" rows="5" readonly></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
    `;
    
    // Add modal to document
    document.body.appendChild(modalContainer);
    
    // Set the preview text
    const previewLength = 200;
    const emailPreview = emailBody.length > previewLength ? 
        emailBody.substring(0, previewLength) + '...' : emailBody;
    
    // Wait for the modal to be fully added to DOM
    setTimeout(() => {
        // Get references to elements
        const previewTextarea = document.getElementById('emailPreview');
        const saveButton = document.getElementById('saveEmailDataBtn');
        const copyButton = document.getElementById('copyEmailBtn');
        
        // Set preview text
        if (previewTextarea) {
            previewTextarea.value = emailPreview;
        }
        
        // Add save button handler
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                const blob = new Blob([emailBody], { type: 'text/plain' });
                const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 16);
                const filename = `annotation-email-${timestamp}.txt`;
                downloadFile(blob, filename);
                logMessage(`Email content saved as ${filename}`, 'INFO');
            });
        }
        
        // Add copy button handler
        if (copyButton) {
            copyButton.addEventListener('click', () => {
                copyToClipboard(emailBody);
            });
        }
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('emailDataModal'));
        modal.show();
        
        // Log success
        logMessage('Email data ready - showing options dialog', 'INFO');
    }, 100);
}

/**
 * Copy text to clipboard with fallbacks for older browsers
 * @param {string} text - Text to copy
 */
function copyToClipboard(text) {
    // Modern approach
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => {
                logMessage('Email content copied to clipboard successfully', 'INFO');
                alert('Email content copied to clipboard!');
            })
            .catch(err => {
                logMessage(`Error copying to clipboard: ${err.message}`, 'ERROR');
                fallbackCopyToClipboard(text);
            });
    } else {
        // Fallback for older browsers
        fallbackCopyToClipboard(text);
    }
}

/**
 * Fallback method to copy text to clipboard
 * @param {string} text - Text to copy
 */
function fallbackCopyToClipboard(text) {
    try {
        // Create textarea element
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Make the textarea out of viewport
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        
        // Select and copy
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            logMessage('Email content copied to clipboard using fallback method', 'INFO');
            alert('Email content copied to clipboard!');
        } else {
            logMessage('Unable to copy to clipboard using fallback method', 'WARN');
            alert('Could not copy to clipboard. Please select the text manually and copy it.');
        }
    } catch (err) {
        logMessage(`Error in fallback copy: ${err.message}`, 'ERROR');
        alert('Could not copy to clipboard. Please select the text manually and copy it.');
    }
}

/**
 * Reset the email button to its original state
 */
function resetEmailButton() {
    const emailBtn = document.getElementById('email-btn');
    if (emailBtn) {
        emailBtn.classList.remove('btn-processing');
        emailBtn.disabled = false;
    }
}

/**
 * Start a new laser pointer trail during replay
 */
function startLaserTrail() {
    // Clear any existing trail first
    clearLaserTrail();
    
    // Create trail container if it doesn't exist
    let trailContainer = document.getElementById('laser-trail-container');
    if (!trailContainer) {
        trailContainer = document.createElement('div');
        trailContainer.id = 'laser-trail-container';
        trailContainer.style.position = 'absolute';
        trailContainer.style.top = '0';
        trailContainer.style.left = '0';
        trailContainer.style.width = '100%';
        trailContainer.style.height = '100%';
        trailContainer.style.pointerEvents = 'none';
        trailContainer.style.zIndex = '999';
        
        // Add to the canvas container
        const canvasContainer = document.getElementById('image-container');
        if (canvasContainer) {
            canvasContainer.appendChild(trailContainer);
        }
    }
    
    // Make it visible
    trailContainer.style.display = 'block';
    
    // Initialize trail points array for this session
    window.currentLaserTrail = [];
    
    logMessage('Laser pointer trail started in replay', 'DEBUG');
}

/**
 * Add a point to the current laser trail during replay
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
function addToLaserTrail(x, y) {
    if (!window.currentLaserTrail) {
        startLaserTrail();
    }
    
    // Add this point to the trail
    window.currentLaserTrail.push({ x, y });
    
    // Keep only the last 20 points for performance
    if (window.currentLaserTrail.length > 20) {
        window.currentLaserTrail.shift();
    }
    
    // Draw the trail
    drawLaserTrail();
}

/**
 * Draw the current laser trail on screen
 */
function drawLaserTrail() {
    const trailContainer = document.getElementById('laser-trail-container');
    if (!trailContainer || !window.currentLaserTrail) return;
    
    // Clear current trail
    trailContainer.innerHTML = '';
    
    // Draw each point in the trail with decreasing opacity
    window.currentLaserTrail.forEach((point, index) => {
        const pointElement = document.createElement('div');
        pointElement.className = 'laser-trail-point';
        
        // Calculate opacity based on position in the trail (newer points are more opaque)
        const opacity = 0.1 + (index / window.currentLaserTrail.length) * 0.7;
        const size = 5 + (index / window.currentLaserTrail.length) * 10;
        
        // Style the point
        pointElement.style.width = `${size}px`;
        pointElement.style.height = `${size}px`;
        pointElement.style.backgroundColor = `rgba(255, 0, 0, ${opacity})`;
        pointElement.style.left = `${point.x}px`;
        pointElement.style.top = `${point.y}px`;
        
        // Add to container
        trailContainer.appendChild(pointElement);
    });
}

/**
 * Clear the laser trail during replay
 */
function clearLaserTrail() {
    const trailContainer = document.getElementById('laser-trail-container');
    if (trailContainer) {
        trailContainer.innerHTML = '';
    }
    
    window.currentLaserTrail = null;
} 