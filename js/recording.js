/**
 * Recording functionality for the image annotation application
 */

// State variables
let recorder;
let mouseTrackingInterval;
let mouseData = [];
let audioBlob = null;
let isRecording = false;
let isPaused = false;
let audioContext;
let audioStream;
let recordingStartTime;
let recordingTimer;
let pausedTime = 0;
let pauseStartTime = 0;
let lastKnownMousePosition = { x: 0, y: 0 }; // Store last known mouse position

/**
 * Toggle recording on/off
 */
function toggleRecording() {
    const recordBtn = document.getElementById('record-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    const recordingTimer = document.getElementById('recording-timer');
    const volumeMeter = document.getElementById('volume-meter');
    
    if (isRecording) {
        // Stop recording
        isRecording = false;
        isPaused = false;
        recordBtn.textContent = 'Start Recording';
        recordBtn.classList.replace('btn-secondary', 'btn-danger');
        pauseBtn.disabled = true;
        recordingIndicator.style.display = 'none';
        recordingTimer.style.display = 'none';
        volumeMeter.style.display = 'none';
        
        // Stop timer
        clearInterval(recordingTimer);
        
        // Stop mouse tracking
        clearInterval(mouseTrackingInterval);
        
        // Stop audio recording
        if (recorder) {
            recorder.stopRecording(function() {
                audioBlob = recorder.getBlob();
                logMessage(`Audio recording completed: ${Math.round(audioBlob.size / 1024)} KB`);
            });
        }
        
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
        
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        
        logMessage(`Recording stopped. Captured ${mouseData.length} mouse positions.`);
    } else {
        // Start recording
        isRecording = true;
        isPaused = false;
        pausedTime = 0;
        recordBtn.textContent = 'Stop Recording';
        recordBtn.classList.replace('btn-danger', 'btn-secondary');
        pauseBtn.disabled = false;
        pauseBtn.textContent = 'Pause Recording';
        recordingIndicator.style.display = 'inline';
        recordingIndicator.style.color = 'red';
        recordingTimer.style.display = 'inline';
        volumeMeter.style.display = 'block';
        
        // Reset data
        mouseData = [];
        audioBlob = null;
        recordingStartTime = Date.now();
        
        // Start recording timer
        recordingTimer.textContent = '00:00';
        recordingTimer = setInterval(updateRecordingTimer, 1000);
        
        // Start mouse tracking (5 times per second)
        mouseTrackingInterval = setInterval(function() {
            if (isPaused) return;
            
            // Use the last known mouse position from the global variable
            const pointer = lastKnownMousePosition || { x: 0, y: 0 };
            
            // Log position occasionally for debugging
            if (mouseData.length % 25 === 0) { // Log every 25th frame
                logMessage(`Recording mouse position: X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}`);
            }
            
            mouseData.push({
                timestamp: Date.now(),
                x: pointer.x,
                y: pointer.y,
                isDown: canvas.isDrawingMode ? canvas.isDrawing : false
            });
        }, 200); // 5 times per second = 200ms
        
        // Start audio recording
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function(stream) {
                audioStream = stream;
                
                // Create audio context for volume meter
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createMediaStreamSource(stream);
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                
                // Start volume meter
                const volumeLevel = document.getElementById('volume-level');
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                
                function updateVolumeMeter() {
                    if (!isRecording) return;
                    
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / dataArray.length;
                    const percentage = (average / 255) * 100;
                    
                    volumeLevel.style.width = `${percentage}%`;
                    requestAnimationFrame(updateVolumeMeter);
                }
                
                updateVolumeMeter();
                
                // Start recording
                recorder = RecordRTC(stream, {
                    type: 'audio',
                    mimeType: 'audio/webm',
                    recorderType: RecordRTC.StereoAudioRecorder,
                    disableLogs: true
                });
                recorder.startRecording();
                
                logMessage('Audio recording started');
            })
            .catch(function(error) {
                console.error('Error accessing microphone:', error);
                alert('Error accessing microphone. Please check your permissions.');
                logMessage('Error accessing microphone: ' + error.message);
                
                // Stop recording if microphone fails
                isRecording = false;
                recordBtn.textContent = 'Start Recording';
                recordBtn.classList.replace('btn-secondary', 'btn-danger');
                pauseBtn.disabled = true;
                recordingIndicator.style.display = 'none';
                recordingTimer.style.display = 'none';
                volumeMeter.style.display = 'none';
                
                clearInterval(mouseTrackingInterval);
            });
        
        logMessage('Recording started');
    }
}

/**
 * Pause or resume recording
 */
function pauseResumeRecording() {
    if (!isRecording) return;
    
    const pauseBtn = document.getElementById('pause-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    
    if (isPaused) {
        // Resume recording
        isPaused = false;
        pauseBtn.textContent = 'Pause Recording';
        recordingIndicator.style.color = 'red';
        
        // Calculate paused duration
        pausedTime += Date.now() - pauseStartTime;
        
        // Resume audio recording if available
        if (recorder) {
            recorder.resumeRecording();
        }
        
        logMessage('Recording resumed');
    } else {
        // Pause recording
        isPaused = true;
        pauseBtn.textContent = 'Resume Recording';
        recordingIndicator.style.color = 'orange';
        pauseStartTime = Date.now();
        
        // Pause audio recording if available
        if (recorder) {
            recorder.pauseRecording();
        }
        
        logMessage('Recording paused');
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
 * Save annotation data to file
 */
function saveAnnotationData() {
    // Create canvas snapshot
    const canvasData = canvas.toJSON();
    
    // Create data object
    const annotationData = {
        canvasData: canvasData,
        mouseData: mouseData,
        hasAudio: audioBlob !== null,
        timestamp: new Date().toISOString()
    };
    
    // Convert to JSON
    const jsonData = JSON.stringify(annotationData);
    
    // Save JSON file
    const jsonBlob = new Blob([jsonData], { type: 'application/json' });
    saveAs(jsonBlob, 'annotation_data.json');
    
    // Save audio if available
    if (audioBlob) {
        saveAs(audioBlob, 'annotation_audio.webm');
    }
    
    logMessage(`Annotation data saved. Objects: ${canvasData.objects.length}, Mouse positions: ${mouseData.length}, Audio: ${audioBlob ? 'Yes' : 'No'}`);
}

/**
 * Load annotation data from file
 * @param {Event} e - The file input change event
 */
function loadAnnotationData(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);
                
                // Load canvas data
                canvas.loadFromJSON(data.canvasData, function() {
                    // Make sure all annotations are on top of the image
                    const image = canvas.getObjects().find(obj => obj.type === 'image');
                    if (image) {
                        image.sendToBack();
                    }
                    
                    canvas.renderAll();
                    logMessage(`Loaded annotation data. Objects: ${canvas.getObjects().length}`);
                });
                
                // Load mouse data
                mouseData = data.mouseData || [];
                logMessage(`Loaded ${mouseData.length} mouse positions from file`);
                
                alert('Annotation data loaded successfully.');
            } catch (error) {
                console.error('Error loading annotation data:', error);
                alert('Error loading annotation data. Please check the file format.');
                logMessage(`Error loading annotation data: ${error.message}`);
            }
        };
        reader.readAsText(file);
    }
}

/**
 * Replay the recorded mouse movements
 */
function replayRecording() {
    if (mouseData.length === 0) {
        alert('No recording data available to replay.');
        logMessage('Replay failed: No mouse data available');
        return;
    }
    
    logMessage(`Replaying recording with ${mouseData.length} frames`);
    
    // Create indicator dot
    const dot = new fabric.Circle({
        left: 0,
        top: 0,
        radius: cursorSize / 2,
        fill: 'red',
        originX: 'center',
        originY: 'center',
        selectable: false,
        id: 'cursor'
    });
    canvas.add(dot);
    dot.bringToFront();
    
    // Create trail elements
    const trail = new fabric.Path('', {
        stroke: 'rgba(255, 0, 0, 0.3)',
        strokeWidth: 2,
        fill: false,
        selectable: false,
        id: 'replayTrail'
    });
    canvas.add(trail);
    trail.bringToFront();
    
    let pathData = [];
    let index = 0;
    
    function playNextFrame() {
        if (index >= mouseData.length) {
            setTimeout(() => {
                canvas.remove(dot);
                canvas.remove(trail);
                canvas.renderAll();
                logMessage('Replay completed');
            }, 1000);
            return;
        }
        
        const frame = mouseData[index];
        dot.set({
            left: frame.x,
            top: frame.y
        });
        
        // Update trail path
        if (index === 0) {
            pathData = ['M', frame.x, frame.y];
        } else {
            pathData.push('L', frame.x, frame.y);
        }
        
        // Only keep the last 3 seconds of trail
        const trailLength = Math.min(15, index); // About 3 seconds at 5 fps
        if (index > trailLength) {
            const startIndex = (index - trailLength) * 3; // Each point is 3 elements (M/L, x, y)
            pathData = ['M', ...pathData.slice(startIndex + 1)];
        }
        
        trail.set({ path: pathData.join(' ') });
        canvas.renderAll();
        
        index++;
        
        // Calculate delay for next frame
        const nextDelay = index < mouseData.length ? 
            mouseData[index].timestamp - mouseData[index - 1].timestamp : 0;
        
        setTimeout(playNextFrame, nextDelay);
    }
    
    playNextFrame();
} 