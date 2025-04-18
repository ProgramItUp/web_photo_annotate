/**
 * Audio recording functionality using MediaStream Recording API
 */

// Make sure drawingTools.js is loaded first
if (!window.DrawingTools) {
    console.error('DrawingTools module not loaded! Make sure drawingTools.js is included before recording.js');
}

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
let microphoneInitialized = false;
let microphoneAccessDenied = false;

// Tracking variable for mouse move throttling
let lastMouseMoveCapture = 0;
const MOUSE_MOVE_CAPTURE_INTERVAL = 50; // Capture at most every 50ms (20 points per second)

// Expose recording state to other modules
window.isRecording = function() { return isRecording; };
window.isPaused = function() { return isPaused; };
window.mouseData = mouseData;  // Make mouseData available to other modules
window.getCurrentRecordingTime = getCurrentRecordingTime; // Make this function available to drawingTools

// The updateCursorTrailPosition function is now moved to drawingTools.js

/**
 * Check if microphone permissions are already granted
 * @returns {Promise<boolean>} Promise that resolves to true if permission is granted
 */
function checkMicrophonePermission() {
    // Check if the Permissions API is available
    if (navigator.permissions && navigator.permissions.query) {
        return navigator.permissions.query({ name: 'microphone' })
            .then(permissionStatus => {
                if (permissionStatus.state === 'granted') {
                    logMessage('Microphone permission already granted', 'INFO');
                    microphoneInitialized = true;
                    return true;
                } else if (permissionStatus.state === 'denied') {
                    logMessage('Microphone permission previously denied', 'WARN');
                    microphoneAccessDenied = true;
                    return false;
                } else {
                    logMessage('Microphone permission status: ' + permissionStatus.state, 'INFO');
                    
                    // Add event listener to track permission changes
                    permissionStatus.onchange = function() {
                        logMessage('Microphone permission changed to: ' + this.state, 'INFO');
                        if (this.state === 'granted') {
                            microphoneInitialized = true;
                            microphoneAccessDenied = false;
                        } else if (this.state === 'denied') {
                            microphoneAccessDenied = true;
                        }
                    };
                    
                    return false;
                }
            })
            .catch(error => {
                console.error('Error checking permission:', error);
                return false;
            });
    } else {
        // Permissions API not supported, use feature detection as fallback
        logMessage('Permissions API not supported, will need to request permissions', 'INFO');
        return Promise.resolve(false);
    }
}

/**
 * Initialize microphone access at page load to avoid repeated permission prompts
 */
function initializeMicrophone() {
    if (microphoneInitialized || microphoneAccessDenied) return;
    
    logMessage('Initializing microphone access...', 'INFO');
    
    // Detect if we're running from file:// protocol
    const isFileProtocol = window.location.protocol === 'file:';
    
    // Check if site is served over HTTPS, which is required for persistent permissions
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        if (isFileProtocol) {
            logMessage('File protocol detected. Microphone permissions cannot be persisted.', 'WARN');
            
            // For file:// protocol, just set a flag to indicate we'll need to request permission each time
            // But don't show any prompts since they won't help
            window.isFileProtocol = true;
            
            // Add a small unobtrusive indicator in the recording button area
            const recordingIndicator = document.getElementById('recording-indicator');
            if (recordingIndicator) {
                const fileProtocolNote = document.createElement('div');
                fileProtocolNote.className = 'small text-muted mb-2';
                fileProtocolNote.innerText = 'File:// mode - Permission required each time';
                fileProtocolNote.style.fontSize = '10px';
                recordingIndicator.parentNode.insertBefore(fileProtocolNote, recordingIndicator);
            }
            
            return; // Don't attempt to initialize microphone early for file:// protocol
        } else {
            logMessage('Warning: Microphone permissions can only be persistent on HTTPS sites', 'WARN');
            // We'll still check, but show a warning to the user
            const httpsWarning = document.createElement('div');
            httpsWarning.className = 'alert alert-warning p-1 m-2 small';
            httpsWarning.innerHTML = 'This site is not running on HTTPS. Microphone permissions will be requested each time.';
            httpsWarning.style.position = 'fixed';
            httpsWarning.style.top = '0';
            httpsWarning.style.right = '0';
            httpsWarning.style.zIndex = '9999';
            document.body.appendChild(httpsWarning);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (httpsWarning.parentNode) {
                    httpsWarning.parentNode.removeChild(httpsWarning);
                }
            }, 5000);
        }
    }
    
    // If using file:// protocol, don't check for existing permissions as it will always fail
    if (isFileProtocol) {
        return;
    }
    
    // First check if permission is already granted - only do this for http/https
    checkMicrophonePermission()
        .then(isGranted => {
            if (isGranted) {
                logMessage('Microphone already accessible, no need to request permission', 'INFO');
                return;
            }
            
            // Add a prompt to inform users about microphone usage - only for http/https
            const micPermissionInfo = document.createElement('div');
            micPermissionInfo.className = 'alert alert-info p-2 m-2';
            micPermissionInfo.innerHTML = 
                '<strong>Microphone Permission</strong><br>' +
                'This app uses your microphone for audio recording. ' +
                '<button id="initialize-mic-btn" class="btn btn-sm btn-primary">Initialize Now</button>' +
                '<button id="dismiss-mic-prompt" class="btn btn-sm btn-secondary ms-2">Later</button>';
            micPermissionInfo.style.position = 'fixed';
            micPermissionInfo.style.top = '10%';
            micPermissionInfo.style.left = '50%';
            micPermissionInfo.style.transform = 'translateX(-50%)';
            micPermissionInfo.style.zIndex = '9999';
            micPermissionInfo.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            document.body.appendChild(micPermissionInfo);
            
            // Set up event listeners for the buttons
            document.getElementById('initialize-mic-btn').addEventListener('click', function() {
                // Request microphone access when user clicks the button
                navigator.mediaDevices.getUserMedia({ audio: true })
                .then(function(stream) {
                    audioStream = stream;
                    microphoneInitialized = true;
                    
                    // Stop the tracks for now to save resources, but keep the permission
                    stream.getTracks().forEach(track => track.stop());
                    audioStream = null;
                    
                    logMessage('Microphone access granted and initialized', 'INFO');
                        
                        // Remove the prompt
                        if (micPermissionInfo.parentNode) {
                            micPermissionInfo.parentNode.removeChild(micPermissionInfo);
                        }
                        
                        // Show success message
                        const successMsg = document.createElement('div');
                        successMsg.className = 'alert alert-success p-2 m-2';
                        successMsg.innerHTML = 'Microphone access granted successfully!';
                        successMsg.style.position = 'fixed';
                        successMsg.style.top = '10%';
                        successMsg.style.left = '50%';
                        successMsg.style.transform = 'translateX(-50%)';
                        successMsg.style.zIndex = '9999';
                        document.body.appendChild(successMsg);
                        
                        // Auto-remove after 3 seconds
                        setTimeout(() => {
                            if (successMsg.parentNode) {
                                successMsg.parentNode.removeChild(successMsg);
                            }
                        }, 3000);
                })
                .catch(function(error) {
                    console.error('Error accessing microphone during initialization:', error);
                    logMessage('Error initializing microphone: ' + error.message, 'ERROR');
                    microphoneAccessDenied = true;
                        
                        // Remove the prompt
                        if (micPermissionInfo.parentNode) {
                            micPermissionInfo.parentNode.removeChild(micPermissionInfo);
                        }
                        
                        // Show error message
                        const errorMsg = document.createElement('div');
                        errorMsg.className = 'alert alert-danger p-2 m-2';
                        errorMsg.innerHTML = 'Microphone access was denied. Recording will not be available.';
                        errorMsg.style.position = 'fixed';
                        errorMsg.style.top = '10%';
                        errorMsg.style.left = '50%';
                        errorMsg.style.transform = 'translateX(-50%)';
                        errorMsg.style.zIndex = '9999';
                        document.body.appendChild(errorMsg);
                        
                        // Auto-remove after 5 seconds
                        setTimeout(() => {
                            if (errorMsg.parentNode) {
                                errorMsg.parentNode.removeChild(errorMsg);
                            }
                        }, 5000);
                    });
            });
            
            document.getElementById('dismiss-mic-prompt').addEventListener('click', function() {
                // Just remove the prompt if user wants to decide later
                if (micPermissionInfo.parentNode) {
                    micPermissionInfo.parentNode.removeChild(micPermissionInfo);
                }
                });
        });
}

// These direct mouse capture functions are now moved to drawingTools.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('Recording system initialized');
    // Make sure logMessage exists before calling it
    if (typeof logMessage === 'function') {
        logMessage('Recording system initialized', 'DEBUG');
    }
    
    // Initialize recording buttons
    initializeRecordingButtons();
    
    // Request microphone permissions early
    initializeMicrophone();
});

/**
 * Initialize recording buttons with event listeners
 */
function initializeRecordingButtons() {
    // Record button
    const recordBtn = document.getElementById('record-btn');
    if (recordBtn) {
        // Simple click handler for toggleRecording
        recordBtn.addEventListener('click', toggleRecording);
        
        logMessage('Record button enabled', 'DEBUG');
    }
    
    // Stop button
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
        stopBtn.addEventListener('click', function() {
            if (isRecording) {
                stopAudioRecording();
                logMessage('Recording stopped via stop button', 'INFO');
            }
        });
        
        logMessage('Stop button enabled', 'DEBUG');
    }
    
    // Save button
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveAnnotationData);
        logMessage('Save button enabled', 'DEBUG');
    }
    
    // Debug button
    const debugBtn = document.getElementById('debug-btn');
    if (debugBtn) {
        debugBtn.addEventListener('click', function() {
            logMessage('Debug button clicked - saving mouse data for diagnostics', 'INFO');
            saveMouseDataForDebug();
        });
        logMessage('Debug button enabled', 'DEBUG');
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
 * Toggle recording start/pause/resume with the record button
 */
function toggleRecording() {
    if (!isRecording) {
        // Start recording
        startAudioRecording();
    } else if (isRecording && !isPaused) {
        // Pause recording
        pauseRecording();
    } else if (isRecording && isPaused) {
        // Resume recording
        resumeRecording();
    }
}

/**
 * Pause recording
 */
function pauseRecording() {
    if (!isRecording || !mediaRecorder || isPaused) return;
    
    // Pause recording
    mediaRecorder.pause();
    isPaused = true;
    pauseStartTime = Date.now();
    
    // Update UI
    updateRecordingUI(true, true);
    
    logMessage('Recording paused', 'INFO');
}

/**
 * Resume recording
 */
function resumeRecording() {
    if (!isRecording || !mediaRecorder || !isPaused) return;
    
    // Resume recording
    mediaRecorder.resume();
    isPaused = false;
    
    // Update paused time
    pausedTime += (Date.now() - pauseStartTime);
    
    // Update UI
    updateRecordingUI(true, false);
    
    logMessage('Recording resumed', 'INFO');
}

/**
 * Update the recording timer display
 */
function updateRecordingTimer() {
    if (!isRecording) return;
    
    const recordingTimer = document.getElementById('recording-timer');
    const totalRecordingTime = document.getElementById('total-recording-time');
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
    
    // Update the real-time recording timer
    recordingTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Update the total recording time display (always visible even when not recording)
    if (totalRecordingTime) {
        totalRecordingTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

/**
 * Show laser pointer usage notification - moved to DrawingTools, keeping stub for compatibility
 */
function showLaserPointerNotification() {
    if (window.DrawingTools) {
        window.DrawingTools.showLaserPointerNotification();
    } else {
        console.error('DrawingTools module not available for showing laser pointer notification');
    }
}

/**
 * Start audio recording
 */
function startAudioRecording() {
    // Check if mediaRecorder is already active
    if (isRecording) return;
    
    // Check if we're running from file:// protocol
    const isFileProtocol = window.location.protocol === 'file:' || window.isFileProtocol === true;
    
    // For file:// protocol, we skip the permission check and go straight to requesting access
    // since permissions can't be persisted anyway
    if (isFileProtocol) {
        logMessage('File protocol detected. Requesting microphone access directly.', 'INFO');
        
        // Show a simplified loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'alert alert-info p-2';
        loadingIndicator.innerHTML = '<div class="spinner-border spinner-border-sm me-2" role="status"></div> Requesting microphone access...';
        loadingIndicator.style.position = 'fixed';
        loadingIndicator.style.top = '10px';
        loadingIndicator.style.right = '10px';
        loadingIndicator.style.zIndex = '9999';
        document.body.appendChild(loadingIndicator);
        
        // Request access directly
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function(stream) {
                // Remove the loading indicator
                if (loadingIndicator.parentNode) {
                    loadingIndicator.parentNode.removeChild(loadingIndicator);
                }
                
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
                    updateRecordingUI(false, false);
                    
                    logMessage('Recording stopped', 'INFO');
                };
                
                // Clear existing data
                audioChunks = [];
                mouseData = [];
                
                // Reset total recording time display
                const totalRecordingTime = document.getElementById('total-recording-time');
                if (totalRecordingTime) {
                    totalRecordingTime.textContent = '00:00';
                }
                
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
                updateRecordingUI(true, false);
                
                // Start updating volume meter
                startVolumeMeter(stream);
                
                logMessage('Recording started', 'INFO');
            })
            .catch(function(error) {
                console.error('Error accessing microphone:', error);
                logMessage('Error accessing microphone: ' + error.message, 'ERROR');
                
                // Remove the loading indicator
                if (loadingIndicator.parentNode) {
                    loadingIndicator.parentNode.removeChild(loadingIndicator);
                }
                
                // Update access denied flag
                microphoneAccessDenied = true;
                
                // Show simplified error for file:// protocol
                alert('Microphone access was denied. You need to grant microphone permission each time when using file:// protocol.');
            });
        
        return;
    }
    
    // Check if microphone access was previously denied - only matters for http/https
    if (microphoneAccessDenied) {
        // Create a more helpful dialog with options to retry
        const deniedDialog = document.createElement('div');
        deniedDialog.className = 'alert alert-warning p-3 m-2';
        deniedDialog.innerHTML = 
            '<h5>Microphone Access Required</h5>' +
            '<p>Microphone access was previously denied. You need to allow microphone access in your browser settings to record audio.</p>' +
            '<p><strong>To fix this:</strong></p>' +
            '<ol>' +
            '<li>Click the camera/microphone icon in your browser\'s address bar</li>' +
            '<li>Change the microphone permission to "Allow"</li>' +
            '<li>Refresh this page</li>' +
            '</ol>' +
            '<button id="retry-mic-access" class="btn btn-primary">Try Again</button>' +
            '<button id="cancel-mic-dialog" class="btn btn-secondary ms-2">Cancel</button>';
        deniedDialog.style.position = 'fixed';
        deniedDialog.style.top = '50%';
        deniedDialog.style.left = '50%';
        deniedDialog.style.transform = 'translate(-50%, -50%)';
        deniedDialog.style.zIndex = '10000';
        deniedDialog.style.maxWidth = '500px';
        deniedDialog.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
        document.body.appendChild(deniedDialog);
        
        // Add backdrop
        const backdrop = document.createElement('div');
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100%';
        backdrop.style.height = '100%';
        backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
        backdrop.style.zIndex = '9999';
        document.body.appendChild(backdrop);
        
        // Set up button handlers
        document.getElementById('retry-mic-access').addEventListener('click', function() {
            // Reset access flags to try again
            microphoneAccessDenied = false;
            microphoneInitialized = false;
            
            // Remove dialog
            document.body.removeChild(deniedDialog);
            document.body.removeChild(backdrop);
            
            // Try to initialize microphone again
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(function(stream) {
                    // Success - now start recording
                    microphoneAccessDenied = false;
                    microphoneInitialized = true;
                    
                    // Stop these tracks as we'll get new ones in the actual recording
                    stream.getTracks().forEach(track => track.stop());
                    
                    // Start recording process again
                    startAudioRecording();
                })
                .catch(function(error) {
                    console.error('Error on retry:', error);
                    logMessage('Microphone access denied again: ' + error.message, 'ERROR');
                    microphoneAccessDenied = true;
                    alert('Microphone access was denied again. Please check your browser settings and refresh the page.');
                });
        });
        
        document.getElementById('cancel-mic-dialog').addEventListener('click', function() {
            document.body.removeChild(deniedDialog);
            document.body.removeChild(backdrop);
        });
        
        return;
    }
    
    logMessage('Starting audio recording...', 'INFO');
    
    // Show a loading indicator while we request permissions
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'alert alert-info p-2';
    loadingIndicator.innerHTML = '<div class="spinner-border spinner-border-sm me-2" role="status"></div> Requesting microphone access...';
    loadingIndicator.style.position = 'fixed';
    loadingIndicator.style.top = '10px';
    loadingIndicator.style.right = '10px';
    loadingIndicator.style.zIndex = '9999';
    document.body.appendChild(loadingIndicator);
    
    // First check if we already have permission
    checkMicrophonePermission()
        .then(isGranted => {
            // Request microphone access (will use cached permission if already granted)
            return navigator.mediaDevices.getUserMedia({ audio: true });
        })
        .then(function(stream) {
            // Remove the loading indicator
            if (loadingIndicator.parentNode) {
                loadingIndicator.parentNode.removeChild(loadingIndicator);
            }
            
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
                updateRecordingUI(false, false);
                
                logMessage('Recording stopped', 'INFO');
            };
            
            // Clear existing data
            audioChunks = [];
            mouseData = [];
            
            // Reset total recording time display
            const totalRecordingTime = document.getElementById('total-recording-time');
            if (totalRecordingTime) {
                totalRecordingTime.textContent = '00:00';
            }
            
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
            updateRecordingUI(true, false);
            
            // Start updating volume meter
            startVolumeMeter(stream);
            
            logMessage('Recording started', 'INFO');
        })
        .catch(function(error) {
            console.error('Error accessing microphone:', error);
            logMessage('Error accessing microphone: ' + error.message, 'ERROR');
            
            // Remove the loading indicator
            if (loadingIndicator.parentNode) {
                loadingIndicator.parentNode.removeChild(loadingIndicator);
            }
            
            // Update access denied flag
            microphoneAccessDenied = true;
            
            // Show better error message with help
            const errorDialog = document.createElement('div');
            errorDialog.className = 'alert alert-danger p-3 m-2';
            errorDialog.innerHTML = 
                '<h5>Microphone Access Required</h5>' +
                '<p>This app needs microphone access to record audio annotations.</p>' +
                '<p><strong>You can fix this by:</strong></p>' +
                '<ol>' +
                '<li>Click the camera/microphone icon in your browser\'s address bar</li>' +
                '<li>Change the microphone permission to "Allow"</li>' +
                '<li>Refresh this page</li>' +
                '</ol>' +
                '<button id="close-error-dialog" class="btn btn-primary">OK</button>';
            errorDialog.style.position = 'fixed';
            errorDialog.style.top = '50%';
            errorDialog.style.left = '50%';
            errorDialog.style.transform = 'translate(-50%, -50%)';
            errorDialog.style.zIndex = '10000';
            errorDialog.style.maxWidth = '500px';
            errorDialog.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
            document.body.appendChild(errorDialog);
            
            // Add backdrop
            const backdrop = document.createElement('div');
            backdrop.style.position = 'fixed';
            backdrop.style.top = '0';
            backdrop.style.left = '0';
            backdrop.style.width = '100%';
            backdrop.style.height = '100%';
            backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
            backdrop.style.zIndex = '9999';
            document.body.appendChild(backdrop);
            
            // Close button handler
            document.getElementById('close-error-dialog').addEventListener('click', function() {
                document.body.removeChild(errorDialog);
                document.body.removeChild(backdrop);
            });
        });
}

/**
 * Stop audio recording
 */
function stopAudioRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    // Store the final recording time before stopping
    const finalRecordingTime = getCurrentRecordingTime();
    
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
    
    // Format and display the final recording time
    const totalSeconds = Math.floor(finalRecordingTime / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const totalRecordingTime = document.getElementById('total-recording-time');
    if (totalRecordingTime) {
        totalRecordingTime.textContent = formattedTime;
    }
    
    // Reset state
    isRecording = false;
    isPaused = false;
    
    logMessage(`Recording ended with total duration: ${formattedTime}`, 'INFO');
}

/**
 * Update recording UI elements
 * @param {boolean} isRecording - Whether recording is active
 * @param {boolean} isPaused - Whether recording is paused (optional, only used if isRecording is true)
 */
function updateRecordingUI(isRecording, isPaused = false) {
    // Get UI elements
    const recordBtn = document.getElementById('record-btn');
    const stopBtn = document.getElementById('stop-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    const volumeMeter = document.getElementById('volume-meter');
    
    if (recordBtn) {
        // Reset all inline styles (to be clean when switching states)
        recordBtn.style.backgroundColor = '';
        recordBtn.style.borderColor = '';
        recordBtn.style.color = '';
        
        if (!isRecording) {
            // Not recording - show Start Recording
            recordBtn.textContent = 'Start Recording';
            recordBtn.classList.remove('btn-danger', 'btn-warning', 'btn-light');
            recordBtn.classList.add('btn-success');
            recordBtn.classList.add('flex-grow-1');
            // Hide stop button when not recording
            if (stopBtn) {
                stopBtn.classList.add('d-none');
            }
        } else if (isRecording && !isPaused) {
            // Recording - show Pause button
            recordBtn.textContent = 'Pause';
            recordBtn.classList.remove('btn-success', 'btn-light');
            recordBtn.classList.add('btn-warning');
            // Show stop button when recording
            if (stopBtn) {
                stopBtn.classList.remove('d-none');
            }
        } else if (isRecording && isPaused) {
            // Paused - show Resume Recording with light green color
            recordBtn.textContent = 'Resume';
            recordBtn.classList.remove('btn-success', 'btn-danger', 'btn-warning');
            recordBtn.classList.add('btn-light');
            recordBtn.style.backgroundColor = '#9fd3a9'; // Light green color
            recordBtn.style.borderColor = '#6ebb83';     // Slightly darker green for border
            recordBtn.style.color = '#1e7e34';          // Dark green text for contrast
            // Keep stop button visible when paused
            if (stopBtn) {
                stopBtn.classList.remove('d-none');
            }
        }
    }
    
    if (recordingIndicator) {
        recordingIndicator.style.display = isRecording ? 'inline' : 'none';
        recordingIndicator.textContent = isPaused ? '❚❚ Paused' : '● Recording';
    }
    
    if (volumeMeter) {
        volumeMeter.style.display = isRecording ? 'block' : 'none';
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
        
        logMessage('Starting mouse data capture...', 'INFO');
        logMessage(`Canvas element found: ${canvasEl ? 'YES' : 'NO'}`, 'DEBUG');
        logMessage(`Recording state: isRecording=${isRecording}, isPaused=${isPaused}`, 'DEBUG');
        
        // Add mouse move listener
        canvasEl.addEventListener('mousemove', captureMouseMove);
        
        // Add mouse down/up listeners to track interactions
        canvasEl.addEventListener('mousedown', captureMouseDown);
        canvasEl.addEventListener('mouseup', captureMouseUp);
        
        // Add direct event listeners to fabric.js canvas for redundancy
        if (window.canvas.on) {
            window.canvas.on('mouse:down', function(options) {
                logMessage(`Fabric mouse:down event captured at (${Math.round(options.pointer.x)}, ${Math.round(options.pointer.y)})`, 'DEBUG');
                // We don't need to do anything here - just confirming events are firing
            });
            
            window.canvas.on('mouse:move', function(options) {
                // Log occasionally to avoid spam
                if (Math.random() < 0.001) {
                    logMessage(`Fabric mouse:move event captured at (${Math.round(options.pointer.x)}, ${Math.round(options.pointer.y)})`, 'DEBUG');
                }
            });
            
            logMessage('Added redundant fabric.js event listeners', 'DEBUG');
        }
        
        // Add global document-level event listener as backup
        document.addEventListener('mousemove', function(e) {
            if (!isRecording || isPaused) return;
            
            // Only process events over the canvas area
            const rect = canvasEl.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && 
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                
                // Check if button is pressed
                if (e.buttons === 1) {
                    // Get elapsed recording time
                    const elapsedTimeMs = getCurrentRecordingTime();
                    const now = Date.now();
                    
                    // Convert to canvas coordinates
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    // Check if we're in bounding box mode
                    const isInBoundingBoxMode = window.DrawingTools && window.DrawingTools.isInBoundingBoxMode && 
                                              window.DrawingTools.isInBoundingBoxMode();
                    
                    // Store in mouse data
                    mouseData.push({
                        type: 'move',
                        x: x,
                        y: y,
                        timeOffset: elapsedTimeMs,
                        realTime: now,
                        isLaserPointer: !isInBoundingBoxMode, // Only mark as laser pointer if NOT in bounding box mode
                        isBoundingBox: isInBoundingBoxMode,   // Explicitly mark as bounding box if in that mode
                        source: 'document', // Mark that this came from document listener
                        buttons: e.buttons
                    });
                    
                    // Call the hook to ensure visual cursor trails match
                    if (typeof window.updateCursorTrail === 'function') {
                        window.updateCursorTrail({x: x, y: y});
                    }
                    
                    if (Math.random() < 0.01) {
                        logMessage(`Captured ${isInBoundingBoxMode ? 'bounding box' : 'laser'} move via document: (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
                        logMessage(`Total mouse data points: ${mouseData.length}`, 'DEBUG');
                    }
                }
            }
        });
        
        // Add document level mouse down/up events
        document.addEventListener('mousedown', function(e) {
            if (!isRecording || isPaused) return;
            
            // Only process events over the canvas area
            const rect = canvasEl.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && 
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                
                // Only handle left button
                if (e.button === 0) {
                    // Get elapsed recording time
                    const elapsedTimeMs = getCurrentRecordingTime();
                    const now = Date.now();
                    
                    // Convert to canvas coordinates
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    logMessage(`Document mousedown detected over canvas at (${Math.round(x)}, ${Math.round(y)})`, 'INFO');
                    
                    // Check if we're in bounding box mode - we need to consult the DrawingTools module
                    const isInBoundingBoxMode = window.DrawingTools && window.DrawingTools.isInBoundingBoxMode && 
                                              window.DrawingTools.isInBoundingBoxMode();
                    
                    // Store in mouse data
                    mouseData.push({
                        type: 'down',
                        button: e.button,
                        x: x,
                        y: y,
                        timeOffset: elapsedTimeMs,
                        realTime: now,
                        isLaserPointer: !isInBoundingBoxMode, // Only mark as laser pointer if NOT in bounding box mode
                        isBoundingBox: isInBoundingBoxMode,   // Explicitly mark as bounding box if in that mode
                        source: 'document' // Mark that this came from document listener
                    });
                    
                    logMessage(`Added mousedown event via document listener - total data points: ${mouseData.length}`, 'DEBUG');
                }
            }
        });
        
        document.addEventListener('mouseup', function(e) {
            if (!isRecording || isPaused) return;
            
            // Only process events over the canvas area
            const rect = canvasEl.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && 
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                
                // Only handle left button
                if (e.button === 0) {
                    // Get elapsed recording time
                    const elapsedTimeMs = getCurrentRecordingTime();
                    const now = Date.now();
                    
                    // Convert to canvas coordinates
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    logMessage(`Document mouseup detected over canvas at (${Math.round(x)}, ${Math.round(y)})`, 'INFO');
                    
                    // Check if we're in bounding box mode - we need to consult the DrawingTools module
                    const isInBoundingBoxMode = window.DrawingTools && window.DrawingTools.isInBoundingBoxMode && 
                                              window.DrawingTools.isInBoundingBoxMode();
                    
                    // Store in mouse data
                    mouseData.push({
                        type: 'up',
                        button: e.button,
                        x: x,
                        y: y,
                        timeOffset: elapsedTimeMs,
                        realTime: now,
                        isLaserPointer: !isInBoundingBoxMode, // Only mark as laser pointer if NOT in bounding box mode
                        isBoundingBox: isInBoundingBoxMode,   // Explicitly mark as bounding box if in that mode
                        source: 'document' // Mark that this came from document listener
                    });
                    
                    logMessage(`Added mouseup event via document listener - total data points: ${mouseData.length}`, 'DEBUG');
                }
            }
        });
        
        logMessage('Mouse data capture started', 'INFO');
        logMessage('Mouse events will be captured and stored in the JSON', 'INFO');
        logMessage('HOW TO USE LASER POINTER: Click and drag on the image while recording', 'INFO');
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
        
        // Check if we actually captured any data
        if (mouseData.length === 0) {
            logMessage('WARNING: No mouse data was captured during recording!', 'WARN');
            logMessage('Check the following:', 'WARN');
            logMessage('1. Did you move your mouse over the canvas while recording?', 'INFO');
            logMessage('2. Is the cursor trail enabled? (checkbox should be checked)', 'INFO');
            logMessage('3. Did you press the left mouse button to activate the laser pointer?', 'INFO');
            logMessage('4. Check browser console for errors in event handling', 'INFO');
        return;
    }
    
        // Count different types of mouse events
        const moveCount = mouseData.filter(d => d.type === 'move').length;
        const downCount = mouseData.filter(d => d.type === 'down').length;
        const upCount = mouseData.filter(d => d.type === 'up').length;
        const laserCount = mouseData.filter(d => d.isLaserPointer).length;
        const directCount = mouseData.filter(d => d.source === 'direct').length;
        const cursorTrailCount = mouseData.filter(d => d.source === 'cursorTrail').length;
        
        logMessage(`Captured ${mouseData.length} mouse data points total:`, 'INFO');
        logMessage(`- ${moveCount} move events`, 'INFO');
        logMessage(`- ${downCount} down events`, 'INFO');
        logMessage(`- ${upCount} up events`, 'INFO');
        logMessage(`- ${laserCount} laser pointer events`, 'INFO');
        logMessage(`- ${directCount} direct capture events`, 'INFO');
        logMessage(`- ${cursorTrailCount} cursor trail events`, 'INFO');
        
        // Log a few sample points if available
        if (mouseData.length > 0) {
            logMessage('First mouse data point:', 'DEBUG');
            logMessage(JSON.stringify(mouseData[0], null, 2), 'DEBUG');
            
            if (mouseData.length > 1) {
                logMessage('Last mouse data point:', 'DEBUG');
                logMessage(JSON.stringify(mouseData[mouseData.length - 1], null, 2), 'DEBUG');
            }
        } else {
            logMessage('WARNING: No mouse data was captured during recording!', 'WARN');
            logMessage('Check that the mouse event listeners are working properly', 'DEBUG');
        }
    }
}

/**
 * Helper function to determine the currently active drawing tool
 * @returns {Object} Object containing tool information (type and mode)
 */
function getActiveDrawingTool(e) {
    // Default to no tool active
    const toolInfo = {
        type: 'none',
        mode: null
    };
    
    // Check if DrawingTools module is available
    if (!window.DrawingTools) {
        return toolInfo;
    }
    
    // Check if in bounding box mode
    if (window.DrawingTools.isInBoundingBoxMode && window.DrawingTools.isInBoundingBoxMode()) {
        toolInfo.type = 'boundingBox';
        // Get bounding box mode if available (create/resize/move)
        if (window.DrawingTools.getBoundingBoxMode) {
            toolInfo.mode = window.DrawingTools.getBoundingBoxMode();
        }
        return toolInfo;
    }
    
    // Check if laser pointer is active - only if mouse button is pressed
    const isMouseButtonPressed = e && e.buttons === 1; // Left button pressed
    
    // Multiple ways to check if laser pointer is active
    const isLaserActive = 
        (window.showCursorTail === true || 
        window.cursorTrailActive === true ||
        document.body.classList.contains('laser-active') ||
        (window.drawingTools && window.drawingTools.currentTool === 'laser' && isMouseButtonPressed));
    
    if (isLaserActive) {
        toolInfo.type = 'laserPointer';
    }
    
    return toolInfo;
}

/**
 * Capture mouse move event with timing
 * @param {MouseEvent} e - Mouse event
 */
function captureMouseMove(e) {
    if (!isRecording || isPaused) {
        // If we're not recording or paused, don't process further
        if (Math.random() < 0.001) {
            logMessage('Mouse move ignored - not recording or paused', 'DEBUG');
        }
        return;
    }
    
    // Log receiving the event occasionally
    if (Math.random() < 0.001) {
        logMessage(`Mouse move event received - type: ${e.type}, buttons: ${e.buttons}`, 'DEBUG');
    }
    
    const now = Date.now();
    
    // Get active drawing tool
    const activeTool = getActiveDrawingTool(e);
    
    // Throttle mouse move events to avoid excessive data points
    // Only capture if it's been at least MOUSE_MOVE_CAPTURE_INTERVAL ms since last capture
    // Exception: always capture if a tool is active (for better quality)
    if (activeTool.type === 'none' && now - lastMouseMoveCapture < MOUSE_MOVE_CAPTURE_INTERVAL) {
        return;
    }
    
    // Update last capture time
    lastMouseMoveCapture = now;
    
    // Get canvas and position
    const canvas = window.canvas;
    
    if (!canvas) {
        logMessage('Canvas not available during mouse move capture', 'WARN');
        return;
    }
    
    // Get pointer coordinates
    let pointer;
    try {
        // Get from fabric canvas if possible
        pointer = canvas.getPointer(e);
    } catch (err) {
        // Fallback to using client coordinates
        const rect = canvas.lowerCanvasEl.getBoundingClientRect();
        pointer = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        logMessage(`Used fallback coordinates: (${Math.round(pointer.x)}, ${Math.round(pointer.y)})`, 'DEBUG');
    }
    
    // Get elapsed recording time
    const elapsedTimeMs = getCurrentRecordingTime();
    
    // Log what we're capturing (but not too often to avoid log spam)
    if (now % 500 < 50) { // Only log approximately every 500ms
        logMessage(`Capturing ${activeTool.type} move: X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}`, 'DEBUG');
    }
    
    // Create the base data point
    const dataPoint = {
        type: 'move',
        x: pointer.x,
        y: pointer.y,
        timeOffset: elapsedTimeMs, // Time in ms from recording start
        realTime: now,
        activeTool: activeTool.type,
        buttons: e.buttons   // Store the button state for debugging
    };
    
    // Add tool-specific properties
    if (activeTool.type === 'boundingBox') {
        dataPoint.boundingbox_mode = activeTool.mode;
        
        // If DrawingTools provides box coordinates, save them
        if (window.DrawingTools.getCurrentBoxCoords) {
            dataPoint.boxCoords = window.DrawingTools.getCurrentBoxCoords();
        }
        
        // For backward compatibility
        dataPoint.isBoundingBox = true;
        dataPoint.isLaserPointer = false;
    } else if (activeTool.type === 'laserPointer') {
        // For backward compatibility
        dataPoint.isLaserPointer = true;
        dataPoint.isBoundingBox = false;
    }
    
    // Store mouse data with timestamp
    mouseData.push(dataPoint);
}

/**
 * Capture mouse down event with timing
 * @param {MouseEvent} e - Mouse event
 */
function captureMouseDown(e) {
    if (!isRecording || isPaused) {
        logMessage('Mouse down ignored - not recording or paused', 'DEBUG');
        return;
    }
    
    // Log event details
    logMessage(`Mouse down event received - type: ${e.type}, button: ${e.button}`, 'INFO');
    
    // Get canvas and position
    const canvas = window.canvas;
    
    if (!canvas) {
        logMessage('Canvas not available during mouse down capture', 'WARN');
        return;
    }
    
    // Get pointer coordinates
    let pointer;
    try {
        // Get from fabric canvas if possible
        pointer = canvas.getPointer(e);
    } catch (err) {
        // Fallback to using client coordinates
        const rect = canvas.lowerCanvasEl.getBoundingClientRect();
        pointer = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        logMessage(`Used fallback coordinates for mouse down: (${Math.round(pointer.x)}, ${Math.round(pointer.y)})`, 'DEBUG');
    }
    
    // Get elapsed recording time
    const elapsedTimeMs = getCurrentRecordingTime();
    
    // Get active drawing tool - mousedown should update the active tool state
    const activeTool = getActiveDrawingTool(e);
    
    // Log what we're capturing
    logMessage(`Capturing ${activeTool.type} down: X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}, button: ${e.button}`, 'INFO');
    
    // Create the base data point
    const dataPoint = {
        type: 'down',
        button: e.button,
        x: pointer.x,
        y: pointer.y,
        timeOffset: elapsedTimeMs, // Time in ms from recording start
        realTime: Date.now(),
        activeTool: activeTool.type,
        source: 'normal' // Mark the source
    };
    
    // Add tool-specific properties
    if (activeTool.type === 'boundingBox') {
        dataPoint.boundingbox_mode = activeTool.mode;
        
        // Save initial box coordinates if available
        if (window.DrawingTools && window.DrawingTools.getInitialBoxCoords) {
            dataPoint.boxCoords = window.DrawingTools.getInitialBoxCoords();
        }
        
        // For backward compatibility
        dataPoint.isBoundingBox = true;
        dataPoint.isLaserPointer = false;
    } else if (activeTool.type === 'laserPointer') {
        // For backward compatibility
        dataPoint.isLaserPointer = true;
        dataPoint.isBoundingBox = false;
    }
    
    // Store mouse data with timestamp
    mouseData.push(dataPoint);
    
    logMessage(`Added mouse DOWN event at coordinates (${Math.round(pointer.x)}, ${Math.round(pointer.y)}) to mouse data array`, 'DEBUG');
    logMessage(`Total mouse data points now: ${mouseData.length}`, 'DEBUG');
}

/**
 * Capture mouse up event with timing
 * @param {MouseEvent} e - Mouse event
 */
function captureMouseUp(e) {
    if (!isRecording || isPaused) return;
    
    // Get canvas and position
    const canvas = window.canvas;
    
    if (!canvas) {
        logMessage('Canvas not available during mouse up capture', 'WARN');
        return;
    }
    
    // Get pointer coordinates
    let pointer;
    try {
        pointer = canvas.getPointer(e);
    } catch (err) {
        // Fallback to using client coordinates
        const rect = canvas.lowerCanvasEl.getBoundingClientRect();
        pointer = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        logMessage(`Used fallback coordinates for mouse up: (${Math.round(pointer.x)}, ${Math.round(pointer.y)})`, 'DEBUG');
    }
    
    // Get elapsed recording time
    const elapsedTimeMs = getCurrentRecordingTime();
    
    // Get active drawing tool - note this is tricky as the tool status
    // may be changing on mouseup, so we need to check what was active before
    // For this we check the last mouseDown event and preserve that tool type
    let activeTool = getActiveDrawingTool({...e, buttons: 1}); // Pretend button is still down
    
    // Look at previous recorded data point to ensure consistency
    const previousPoints = mouseData.filter(data => data.type === 'down' || data.type === 'move');
    if (previousPoints.length > 0) {
        const previousPoint = previousPoints[previousPoints.length - 1];
        
        // If previous point has a tool type, use it for consistency
        if (previousPoint.activeTool) {
            activeTool.type = previousPoint.activeTool;
        } else if (previousPoint.isBoundingBox) {
            // Legacy support
            activeTool.type = 'boundingBox';
        } else if (previousPoint.isLaserPointer) {
            // Legacy support
            activeTool.type = 'laserPointer';
        }
        
        // Get the mode from previous point if it exists
        if (previousPoint.boundingbox_mode) {
            activeTool.mode = previousPoint.boundingbox_mode;
        }
    }
    
    // Log what we're capturing
    logMessage(`Capturing ${activeTool.type} up: X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}, button: ${e.button}`, 'DEBUG');
    
    // Create the base data point
    const dataPoint = {
        type: 'up',
        button: e.button,
        x: pointer.x,
        y: pointer.y,
        timeOffset: elapsedTimeMs, // Time in ms from recording start
        realTime: Date.now(),
        activeTool: activeTool.type
    };
    
    // Add tool-specific properties
    if (activeTool.type === 'boundingBox') {
        dataPoint.boundingbox_mode = activeTool.mode;
        
        // Get final box coordinates if available
        if (window.DrawingTools && window.DrawingTools.getCurrentBoxCoords) {
            dataPoint.boxCoords = window.DrawingTools.getCurrentBoxCoords();
        }
        
        // For backward compatibility
        dataPoint.isBoundingBox = true;
        dataPoint.isLaserPointer = false;
    } else if (activeTool.type === 'laserPointer') {
        // For backward compatibility
        dataPoint.isLaserPointer = true;
        dataPoint.isBoundingBox = false;
    }
    
    // Store mouse data with timestamp
    mouseData.push(dataPoint);
    
    logMessage(`Added mouse UP event at coordinates (${Math.round(pointer.x)}, ${Math.round(pointer.y)}) to mouse data array`, 'DEBUG');
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
        
        // Log diagnostics about the mouse data being saved
        logMouseDataDiagnostics(mouseData, 'save');
        
        // Add specific verification for bounding box data
        const boundingBoxEvents = mouseData.filter(data => data.isBoundingBox === true);
        logMessage(`Found ${boundingBoxEvents.length} bounding box events in recording data`, 'INFO');
        if (boundingBoxEvents.length > 0) {
            // Log a sample bounding box event
            const sampleEvent = boundingBoxEvents[boundingBoxEvents.length - 1]; // Last event to get final state
            logMessage(`Sample bounding box data: mode=${sampleEvent.boundingbox_mode}, coords=${JSON.stringify(sampleEvent.boxCoords || {})}`, 'INFO');
        }
        
        // Check if we have a canvas with an image
        if (!window.canvas) {
            logMessage('No canvas found to save image data', 'WARN');
            return;
        }
        
        // Get current timestamp for filename
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const filename = `annotation-data-${timestamp}.json`;
        const audioFilename = `recording-${timestamp}.mp3`;
        
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
                duration: 0,
                filename: audioFilename // Reference to the separate audio file
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
                
                // Download the JSON file
                downloadFile(jsonBlob, filename);
                
                logMessage(`Annotation data saved to ${filename}`, 'INFO');
                
                // Now save the audio file separately if it exists
                if (audioBlob) {
                    // Save the audio blob as a separate MP3 file
                    downloadFile(audioBlob, audioFilename);
                    logMessage(`Audio recording saved to ${audioFilename}`, 'INFO');
                } else {
                    logMessage('No audio recording available to save', 'WARN');
                }
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
            
            // Log objects for debugging
            logMessage(`Found ${objects.length} total objects on canvas for potential annotation`, 'DEBUG');
            objects.forEach((obj, idx) => {
                if (obj.type !== 'image') {
                    logMessage(`Canvas object #${idx+1}: type=${obj.type}, left=${Math.round(obj.left)}, top=${Math.round(obj.top)}, width=${Math.round(obj.width)}, height=${Math.round(obj.height)}`, 'DEBUG');
                }
            });
            
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
                    } else if (obj.type === 'rect') {
                        logMessage(`Capturing bounding box for save: ${Math.round(obj.width)}x${Math.round(obj.height)}`, 'INFO');
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
 * Load annotation data from a saved file
 * Supports both direct JSON files and email text files with embedded annotations
 * @param {Event} event - The file input change event
 */
function loadAnnotationData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        // Read the file
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const fileContent = e.target.result;
                
                // Check file extension to determine processing method
                const fileExt = file.name.split('.').pop().toLowerCase();
                
                if (fileExt === 'json') {
                    // Direct JSON file processing
                    processJsonAnnotationData(fileContent);
                } else if (fileExt === 'txt') {
                    // Email text file processing
                    processEmailAnnotationData(fileContent);
                } else {
                    logMessage(`Unsupported file type: ${fileExt}. Please use .json or .txt files.`, 'ERROR');
                }
            } catch (parseError) {
                console.error('Error parsing file:', parseError);
                logMessage('Error parsing file: ' + parseError.message, 'ERROR');
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
 * Process JSON annotation data loaded directly from a JSON file
 * @param {string} jsonContent - The JSON file content as string
 */
function processJsonAnnotationData(jsonContent) {
    try {
        const data = JSON.parse(jsonContent);
        
        // Store the mouse data
        mouseData = data.mouseData || [];
        
        // Verify bounding box data is properly loaded
        const boundingBoxEvents = mouseData.filter(data => data.isBoundingBox === true);
        logMessage(`Loaded ${boundingBoxEvents.length} bounding box events from JSON file`, 'INFO');
        if (boundingBoxEvents.length > 0) {
            // Log a sample bounding box event
            const sampleEvent = boundingBoxEvents[boundingBoxEvents.length - 1]; // Last event to get final state
            logMessage(`Sample bounding box data: mode=${sampleEvent.boundingbox_mode}, coords=${JSON.stringify(sampleEvent.boxCoords || {})}`, 'INFO');
        }
        
        // If there's audio data, try to convert it back
        if (data.audio && data.audio.dataUrl) {
            try {
                // Convert data URL back to Blob
                const audioDataUrl = data.audio.dataUrl;
                const byteString = atob(audioDataUrl.split(',')[1]);
                const mimeString = audioDataUrl.split(',')[0].split(':')[1].split(';')[0];
                const arrayBuffer = new ArrayBuffer(byteString.length);
                const intArray = new Uint8Array(arrayBuffer);
                
                for (let i = 0; i < byteString.length; i++) {
                    intArray[i] = byteString.charCodeAt(i);
                }
                
                audioBlob = new Blob([arrayBuffer], { type: mimeString });
                logMessage('Audio data loaded successfully', 'INFO');
            } catch (audioError) {
                console.error('Error loading audio data:', audioError);
                logMessage('Error loading audio data: ' + audioError.message, 'WARN');
                // Continue without audio
                audioBlob = null;
            }
        }
        
        logMessage(`Annotation data loaded from JSON file (${mouseData.length} data points)`, 'INFO');
        
        // Store image data for replay
        window.loadedAnnotationData = data;
        
        // Update UI to reflect loaded data
        updateUIAfterDataLoad(data);
    } catch (error) {
        console.error('Error processing JSON data:', error);
        logMessage('Error processing JSON data: ' + error.message, 'ERROR');
    }
}

/**
 * Process annotation data embedded in an email text file
 * @param {string} emailContent - The email file content as string
 */
function processEmailAnnotationData(emailContent) {
    try {
        logMessage('Processing email file for embedded annotation data...', 'INFO');
        
        // Look for the annotation markers
        const startMarker = 'Annotations start here --->';
        const endMarker = '<--- Annotations end here';
        
        let startIndex = emailContent.indexOf(startMarker);
        if (startIndex === -1) {
            // Try alternative start marker formats
            const alternativeStartMarkers = [
                'Annotations start here ->',
                'Annotations start here:',
                'Annotations start here'
            ];
            
            for (const marker of alternativeStartMarkers) {
                startIndex = emailContent.indexOf(marker);
                if (startIndex !== -1) {
                    startIndex += marker.length;
                    break;
                }
            }
            
            if (startIndex === -1) {
                throw new Error('Could not find annotation start marker in the email file');
            }
        } else {
            startIndex += startMarker.length;
        }
        
        let endIndex = emailContent.indexOf(endMarker, startIndex);
        if (endIndex === -1) {
            // If no end marker, assume the rest of the file is annotations
            endIndex = emailContent.length;
            logMessage('No end marker found, processing to end of file', 'WARN');
        }
        
        // Extract the base64 encoded data
        const base64Data = emailContent.substring(startIndex, endIndex).trim();
        
        if (!base64Data) {
            throw new Error('No annotation data found between markers');
        }
        
        logMessage(`Found ${base64Data.length} characters of base64 data in email file`, 'INFO');
        
        // Decode the base64 data
        const decodedData = window.decodeAnnotationData(base64Data);
        
        // Store the mouse data
        mouseData = decodedData.mouseData || [];
        
        // If there's audio data, try to convert it back
        if (decodedData.audio && decodedData.audio.dataUrl) {
            try {
                // Convert data URL back to Blob
                const audioDataUrl = decodedData.audio.dataUrl;
                const byteString = atob(audioDataUrl.split(',')[1]);
                const mimeString = audioDataUrl.split(',')[0].split(':')[1].split(';')[0];
                const arrayBuffer = new ArrayBuffer(byteString.length);
                const intArray = new Uint8Array(arrayBuffer);
                
                for (let i = 0; i < byteString.length; i++) {
                    intArray[i] = byteString.charCodeAt(i);
                }
                
                audioBlob = new Blob([arrayBuffer], { type: mimeString });
                logMessage('Audio data loaded successfully from email file', 'INFO');
            } catch (audioError) {
                console.error('Error loading audio data from email:', audioError);
                logMessage('Error loading audio data from email: ' + audioError.message, 'WARN');
                // Continue without audio
                audioBlob = null;
            }
        }
        
        logMessage(`Annotation data loaded from email file (${mouseData.length} data points)`, 'INFO');
        
        // Store image data for replay
        window.loadedAnnotationData = decodedData;
        
        // Update UI to reflect loaded data
        updateUIAfterDataLoad(decodedData);
    } catch (error) {
        console.error('Error processing email data:', error);
        logMessage('Error processing email data: ' + error.message, 'ERROR');
    }
}

/**
 * Update UI elements after loading annotation data
 * @param {Object} data - The loaded annotation data
 */
function updateUIAfterDataLoad(data) {
    // Load the image if available
    if (data.image && data.image.dataUrl) {
        loadImageFromDataUrl(data.image.dataUrl);
    }
    
    // Update the total recording time if available
    if (data.audio && data.audio.duration) {
        const totalSeconds = Math.floor(data.audio.duration / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const totalRecordingTime = document.getElementById('total-recording-time');
        if (totalRecordingTime) {
            totalRecordingTime.textContent = formattedTime;
        }
    }
    
    // Enable replay button if we have data
    const replayBtn = document.getElementById('replay-btn');
    if (replayBtn && (mouseData.length > 0 || audioBlob)) {
        replayBtn.disabled = false;
    }
    
    // Show success notification
    const notification = document.createElement('div');
    notification.className = 'alert alert-success p-2';
    notification.innerHTML = `<strong>Success!</strong> Annotation data loaded with ${mouseData.length} data points.`;
    notification.style.position = 'fixed';
    notification.style.top = '10%';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.zIndex = '9999';
    notification.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

/**
 * Load image from data URL
 * @param {string} dataUrl - The data URL of the image to load
 */
function loadImageFromDataUrl(dataUrl) {
    logMessage(`Loading image from data URL: ${dataUrl.substring(0, 50)}...`, 'DEBUG');
    
    if (typeof fabric === 'undefined' || typeof fabric.Image === 'undefined') {
        logMessage('Error: Fabric.js library not loaded', 'ERROR');
        return;
    }
    
    if (typeof window.canvas === 'undefined') {
        logMessage('Error: Canvas not initialized', 'ERROR');
        return;
    }
    
    // Show loading indicator
    logMessage('Loading image from data URL, please wait...', 'INFO');
    
    fabric.Image.fromURL(dataUrl, function(img) {
        try {
            if (!img) {
                logMessage('Failed to load image from data URL', 'ERROR');
                return;
            }
            
            // Clear the canvas
            window.canvas.clear();
            
            // Add the image to the canvas without scaling - the resizeCanvas function will handle this
            img.set({
                left: 0,
                top: 0,
                originX: 'left',
                originY: 'top'
            });
            
            window.canvas.add(img);
            
            // Store the original image for potential reset
            window.canvas.setBackgroundImage(img, window.canvas.renderAll.bind(window.canvas));
            
            // Resize the canvas to match the image aspect ratio
            if (typeof window.resizeCanvas === 'function') {
                window.resizeCanvas();
            } else {
                logMessage('resizeCanvas function not available', 'ERROR');
                
                // Fallback resize if window.resizeCanvas is not available
                const containerWidth = document.getElementById('image-container').offsetWidth;
                const aspectRatio = img.height / img.width;
                const newHeight = containerWidth * aspectRatio;
                
                // Update canvas dimensions
                window.canvas.setWidth(containerWidth);
                window.canvas.setHeight(newHeight);
                
                // Scale image to fit canvas
                const scale = containerWidth / img.width;
                img.scale(scale);
                
                // Update container height
                document.getElementById('image-container').style.height = `${newHeight}px`;
            }
            
            // Reset image adjustments
            const brightnessSlider = document.getElementById('brightness');
            const contrastSlider = document.getElementById('contrast');
            if (brightnessSlider) brightnessSlider.value = 0;
            if (contrastSlider) contrastSlider.value = 0;
            
            logMessage(`Image loaded successfully from data URL: ${img.width}x${img.height} pixels`, 'INFO');
        } catch (error) {
            console.error('Error loading image from data URL:', error);
            logMessage('Error loading image from data URL: ' + error.message, 'ERROR');
        }
    }, { 
        crossOrigin: 'Anonymous',
        // Add error handling for image loading
        onerror: function() {
            logMessage(`Failed to load image from data URL`, 'ERROR');
        }
    });
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
        // Log detailed diagnostics about mouse data before replay
        logMouseDataDiagnostics(mouseData, 'replay');
        
        logMessage('Starting replay of annotation data', 'INFO');
        
        // Make sure we're displaying the correct image
        if (window.loadedAnnotationData && window.loadedAnnotationData.image && window.loadedAnnotationData.image.dataUrl) {
            // Check if the image is already loaded on the canvas or needs to be reloaded
            const canvasObjects = window.canvas.getObjects();
            const hasImage = canvasObjects.some(obj => obj.type === 'image');
            
            if (!hasImage) {
                logMessage('Loading image for replay...', 'INFO');
                loadImageFromDataUrl(window.loadedAnnotationData.image.dataUrl);
                
                // Give a small delay to ensure image is loaded before starting replay
                setTimeout(() => {
                    continueReplay();
                }, 500);
                return;
            }
        }
        
        // If no image needed or image already loaded, continue with replay
        continueReplay();
        
    } catch (error) {
        console.error('Error replaying annotation:', error);
        logMessage('Error replaying: ' + error.message, 'ERROR');
        
        // Make sure the button is reset even if an error occurs
        resetReplayButton();
    }
    
    /**
     * Continue with replay after image is loaded
     */
    function continueReplay() {
        // Create a replay cursor if it doesn't exist - use DrawingTools
        window.DrawingTools.createReplayCursor();
        
        // Debug bounding box replay if the debugging function exists
        if (window.DrawingTools.debugBoundingBoxReplay) {
            logMessage('Running bounding box replay diagnostic...', 'INFO');
            window.DrawingTools.debugBoundingBoxReplay();
        }
        
        // Variables to track replay state
        let isReplaying = true;
        let isPaused = false;
        let replayStartTime = Date.now();
        let pauseStartTime = 0;
        let totalPausedTime = 0;
        let audioElement = null;
        let animationFrameId = null;
        let audioStartedPlaying = false;
        
        // Show the inline pause and stop buttons
        showReplayControls();
        
        // Log the current cursor size being used for replay
        logMessage(`Replay starting with cursor size: ${window.cursorSize || 20}px`, 'INFO');
        
        // Sort mouse data by timeOffset for reliable playback
        const sortedMouseData = [...mouseData].sort((a, b) => a.timeOffset - b.timeOffset);
        
        if (sortedMouseData.length > 0) {
            // Analyze the tools used in the recording for diagnostics
            const toolCount = {
                laserPointer: sortedMouseData.filter(d => d.activeTool === 'laserPointer' || 
                                               (d.activeTool === undefined && d.isLaserPointer)).length,
                boundingBox: sortedMouseData.filter(d => d.activeTool === 'boundingBox' || 
                                            (d.activeTool === undefined && d.isBoundingBox)).length,
                none: sortedMouseData.filter(d => d.activeTool === 'none' || 
                                    (d.activeTool === undefined && !d.isLaserPointer && !d.isBoundingBox)).length
            };
            
            logMessage(`Replay has ${sortedMouseData.length} total mouse data points:`, 'INFO');
            logMessage(`- Laser pointer events: ${toolCount.laserPointer}`, 'INFO');
            logMessage(`- Bounding box events: ${toolCount.boundingBox}`, 'INFO');
            logMessage(`- Other events: ${toolCount.none}`, 'INFO');
            
            // Additional logging for bounding box events to help diagnose issues
            if (toolCount.boundingBox > 0) {
                const boundingBoxSample = sortedMouseData.find(d => d.activeTool === 'boundingBox' || d.isBoundingBox);
                if (boundingBoxSample) {
                    logMessage('Sample bounding box event:', 'INFO');
                    logMessage(JSON.stringify({
                        type: boundingBoxSample.type,
                        activeTool: boundingBoxSample.activeTool,
                        isBoundingBox: boundingBoxSample.isBoundingBox,
                        hasCoords: !!boundingBoxSample.boxCoords,
                        mode: boundingBoxSample.boundingbox_mode
                    }), 'INFO');
                }
            }
        }

        // IMPORTANT: Only clear non-bounding box annotations before replay
        // Don't remove all annotations as we might want to see some boxes during replay
        if (window.canvas) {
            logMessage('Selectively clearing annotations before replay...', 'INFO');
            
            // Get all objects except the main image and bounding boxes
            const objects = window.canvas.getObjects();
            const objectsToRemove = objects.filter(obj => 
                obj.type !== 'image' && 
                // Keep any rectangles that might be bounding boxes
                !(obj.type === 'rect' && obj.stroke === 'blue' && obj.fill && obj.fill.includes('rgba(0, 0, 255'))
            );
            
            // Remove only non-bounding box objects
            objectsToRemove.forEach(obj => {
                window.canvas.remove(obj);
            });
            
            window.canvas.renderAll();
            logMessage(`Cleared ${objectsToRemove.length} non-bounding box objects before replay`, 'DEBUG');
        }
        
        // Render the static annotations (bounding boxes) if they exist in the loaded data
        if (window.loadedAnnotationData && window.loadedAnnotationData.annotations) {
            logMessage(`Found ${window.loadedAnnotationData.annotations.length} total annotations to process`, 'DEBUG');
            
            // Log details about all annotations for debugging
            window.loadedAnnotationData.annotations.forEach((ann, idx) => {
                logMessage(`Annotation #${idx+1}: type=${ann.type}, left=${ann.left}, top=${ann.top}, width=${ann.width}, height=${ann.height}`, 'DEBUG');
            });
            
            const boundingBoxes = window.loadedAnnotationData.annotations.filter(ann => ann.type === 'rect');
            if (boundingBoxes.length > 0) {
                logMessage(`Found ${boundingBoxes.length} bounding box annotations to display during replay`, 'INFO');
                addBoundingBoxesToCanvas(boundingBoxes);
            } else {
                logMessage('No bounding box annotations found in the saved data', 'WARN');
            }
        } else {
            logMessage('No annotations data available for replay', 'WARN');
        }
        
        // If we have audio, play it
        if (audioBlob) {
            const audioURL = URL.createObjectURL(audioBlob);
            audioElement = new Audio(audioURL);
            
            // Add a timeupdate event to more precisely sync annotations with audio
            audioElement.addEventListener('timeupdate', function() {
                // If this is the first timeupdate event, sync the start time
                if (!audioStartedPlaying) {
                    audioStartedPlaying = true;
                    // Reset replay start time when audio actually starts playing
                    replayStartTime = Date.now() - (audioElement.currentTime * 1000);
                    logMessage(`Audio playback started, elapsed: ${audioElement.currentTime.toFixed(2)}s`, 'DEBUG');
                }
            });
            
            // Set up event listeners
            audioElement.onplay = function() {
                logMessage('Audio playback initiated', 'DEBUG');
            };
            
            audioElement.onended = function() {
                logMessage('Audio playback ended', 'INFO');
                isReplaying = false;
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
                window.DrawingTools.hideReplayCursor(true); // Specify full cleanup (true)
                URL.revokeObjectURL(audioURL);
                
                // Ensure replay button is reset
                resetReplayButton();
            };
            
            // Play the audio
            logMessage('Starting audio playback...', 'DEBUG');
            audioElement.play().catch(error => {
                logMessage('Error playing audio: ' + error.message, 'ERROR');
                // Continue with cursor replay even if audio fails
                logMessage('Continuing with visual replay only', 'WARN');
            });
        }
        
        // Function to pause the replay
        window.pauseReplay = function() {
            if (!isPaused && isReplaying) {
                isPaused = true;
                pauseStartTime = Date.now();
                
                // Pause audio if it exists
                if (audioElement) {
                    audioElement.pause();
                }
                
                // Pause animation by cancelling the frame
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
                
                logMessage('Replay paused', 'INFO');
                
                // Update pause button
                const pauseBtn = document.getElementById('replay-pause-btn');
                if (pauseBtn) {
                    pauseBtn.textContent = 'Resume';
                    pauseBtn.classList.remove('btn-warning');
                    pauseBtn.classList.add('btn-success');
                }
            }
        };
        
        // Function to resume the replay
        window.resumeReplay = function() {
            if (isPaused && isReplaying) {
                // Calculate how long we were paused
                const pauseDuration = Date.now() - pauseStartTime;
                totalPausedTime += pauseDuration;
                
                // Adjust start time to account for pause duration
                replayStartTime += pauseDuration;
                
                // Resume audio if it exists
                if (audioElement) {
                    audioElement.play().catch(error => {
                        logMessage('Error resuming audio: ' + error.message, 'ERROR');
                    });
                }
                
                // Resume animation
                if (!animationFrameId && currentDataIndex < sortedMouseData.length) {
                    animationFrameId = requestAnimationFrame(updateCursorPosition);
                }
        
                isPaused = false;
                pauseStartTime = 0;
                
                logMessage('Replay resumed', 'INFO');
                
                // Update pause button
                const pauseBtn = document.getElementById('replay-pause-btn');
                if (pauseBtn) {
                    pauseBtn.textContent = 'Pause';
                    pauseBtn.classList.remove('btn-success');
                    pauseBtn.classList.add('btn-warning');
                }
            }
        };
        
        // Function to toggle pause/resume
        window.toggleReplayPause = function() {
            if (isPaused) {
                window.resumeReplay();
            } else {
                window.pauseReplay();
            }
        };
        
        // Function to stop the replay
        window.stopReplay = function() {
            isReplaying = false;
            
            // Stop audio if it exists
            if (audioElement) {
                audioElement.pause();
                audioElement.currentTime = 0;
            }
            
            // Cancel animation
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            
            // Hide cursor and cleanup - specify this is a complete stop (true)
            window.DrawingTools.hideReplayCursor(true);
            
            logMessage('Replay stopped by user', 'INFO');
            
            // Reset replay button using the helper function
            resetReplayButton();
        };
        
        // If we have mouse data, animate it
        let currentDataIndex = 0;
        
        if (sortedMouseData.length > 0) {
            // Function to update cursor position based on elapsed time
            function updateCursorPosition() {
                if (!isReplaying || isPaused) return;
                
                // Calculate elapsed time since replay started, accounting for pauses
                const elapsedMs = Date.now() - replayStartTime;
                
                // Find all data points that should have happened by now
                while (currentDataIndex < sortedMouseData.length && 
                       sortedMouseData[currentDataIndex].timeOffset <= elapsedMs) {
                    
                    // Get the current data point
                    const dataPoint = sortedMouseData[currentDataIndex];
                    
                    // Normalize activeTool property (support both new and legacy formats)
                    if (!dataPoint.activeTool) {
                        // Handle legacy data format
                        if (dataPoint.isBoundingBox) {
                            dataPoint.activeTool = 'boundingBox';
                        } else if (dataPoint.isLaserPointer) {
                            dataPoint.activeTool = 'laserPointer';
                        } else {
                            dataPoint.activeTool = 'none';
                        }
                    }
                    
                    // Tool-specific logging
                    if (dataPoint.activeTool === 'boundingBox') {
                        if (dataPoint.type !== 'move' || Math.random() < 0.05) { // Log move events occasionally
                            logMessage(`Replaying bounding box ${dataPoint.type}: mode=${dataPoint.boundingbox_mode || 'unknown'}, at (${Math.round(dataPoint.x)}, ${Math.round(dataPoint.y)})`, 'DEBUG');
                            
                            // Add detailed box coordinates if they exist
                            if (dataPoint.boxCoords) {
                                const coords = dataPoint.boxCoords;
                                logMessage(`Box: left=${Math.round(coords.left)}, top=${Math.round(coords.top)}, width=${Math.round(coords.width)}, height=${Math.round(coords.height)}`, 'DEBUG');
                            }
                        }
                    } else if (dataPoint.activeTool === 'laserPointer') {
                        if (dataPoint.type !== 'move' || Math.random() < 0.01) {
                            logMessage(`Replaying laser ${dataPoint.type} at (${Math.round(dataPoint.x)}, ${Math.round(dataPoint.y)})`, 'DEBUG');
                        }
                    }
                    
                    // Update cursor position using DrawingTools
                    window.DrawingTools.updateReplayCursor(dataPoint);
                    
                    // Move to next data point
                    currentDataIndex++;
                }
                
                // If we've gone through all data points
                if (currentDataIndex >= sortedMouseData.length) {
                    // If we don't have audio or audio has ended, end the replay
                    if (!audioElement || (audioElement && audioElement.ended)) {
                        isReplaying = false;
                        window.DrawingTools.hideReplayCursor();
                        logMessage('Replay completed', 'INFO');
                        
                        // Reset replay button using the helper function
                        resetReplayButton();
                        
                        return;
                    }
                } 
                
                // Continue animation
                if (isReplaying && !isPaused) {
                    animationFrameId = requestAnimationFrame(updateCursorPosition);
                }
            }
            
            // Start the animation
            updateCursorPosition();
        } else if (audioElement) {
            // If we only have audio but no mouse data
            logMessage('Playing audio only (no mouse data to replay)', 'INFO');
        }
        
        // Hide main replay button
        const replayBtn = document.getElementById('replay-btn');
        if (replayBtn) {
            replayBtn.classList.add('d-none');
        }
    }
}

/**
 * Clear all annotation objects from the canvas before replay
 */
function clearAnnotationsFromCanvas() {
    if (!window.canvas) {
        logMessage('Canvas not available for clearing annotations', 'WARN');
        return;
    }
    
    // Get all objects except the main image
    const objects = window.canvas.getObjects();
    const nonImageObjects = objects.filter(obj => obj.type !== 'image');
    
    // Remove all non-image objects
    nonImageObjects.forEach(obj => {
        window.canvas.remove(obj);
    });
    
    window.canvas.renderAll();
    logMessage(`Cleared ${nonImageObjects.length} annotation objects from canvas`, 'DEBUG');
}

/**
 * Add bounding boxes to the canvas during replay
 * @param {Array} boundingBoxes - Array of rectangle annotation objects
 */
function addBoundingBoxesToCanvas(boundingBoxes) {
    if (!window.canvas) {
        logMessage('Canvas not available for adding bounding boxes', 'ERROR');
        return;
    }
    
    if (!boundingBoxes || boundingBoxes.length === 0) {
        logMessage('No bounding box annotations found to display', 'WARN');
        return;
    }
    
    logMessage(`Processing ${boundingBoxes.length} bounding box annotations...`, 'INFO');
    
    // Add each bounding box to the canvas
    boundingBoxes.forEach((box, index) => {
        try {
            // Verify we have all required properties
            if (!box.left || !box.top || !box.width || !box.height) {
                logMessage(`Bounding box #${index+1} has invalid coordinates: ${JSON.stringify(box)}`, 'WARN');
                return; // Skip this box
            }
            
            // Create a new fabric rectangle with the saved properties
            const rect = new fabric.Rect({
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
                angle: box.angle || 0,
                fill: box.properties && box.properties.fill ? box.properties.fill : 'rgba(0, 0, 255, 0.2)',
                stroke: box.properties && box.properties.stroke ? box.properties.stroke : 'blue',
                strokeWidth: box.properties && box.properties.strokeWidth ? box.properties.strokeWidth : 2,
                selectable: true,
                hasControls: true,
                hasBorders: true,
                transparentCorners: false,
                cornerColor: 'blue',
                cornerSize: 10,
                cornerStyle: 'circle'
            });
            
            // Add to canvas
            window.canvas.add(rect);
            logMessage(`Added bounding box #${index+1} to canvas: (${Math.round(box.left)}, ${Math.round(box.top)}) ${Math.round(box.width)}x${Math.round(box.height)}`, 'INFO');
        } catch (error) {
            logMessage(`Error adding bounding box to canvas: ${error.message}`, 'ERROR');
            console.error('Error details:', error);
        }
    });
    
    // Render all changes
    window.canvas.renderAll();
    logMessage(`Added ${boundingBoxes.length} bounding boxes to canvas for replay`, 'INFO');
}

/**
 * Helper function to reset the replay button state
 */
function resetReplayButton() {
    const replayBtn = document.getElementById('replay-btn');
    const pauseBtn = document.getElementById('replay-pause-btn');
    const stopBtn = document.getElementById('replay-stop-btn');
    
    // Show the main replay button
    if (replayBtn) {
        replayBtn.textContent = 'Replay Annotation';
        replayBtn.disabled = false;
        replayBtn.classList.remove('d-none');
        logMessage('Replay button reset to default state', 'DEBUG');
    }
    
    // Hide the pause and stop buttons
    if (pauseBtn) {
        pauseBtn.classList.add('d-none');
        pauseBtn.classList.remove('btn-success');
        pauseBtn.classList.add('btn-warning');
    pauseBtn.textContent = 'Pause';
    }
    
    if (stopBtn) {
        stopBtn.classList.add('d-none');
    }
}

/**
 * Show the inline replay controls
 */
function showReplayControls() {
    const replayBtn = document.getElementById('replay-btn');
    const pauseBtn = document.getElementById('replay-pause-btn');
    const stopBtn = document.getElementById('replay-stop-btn');
    
    // Hide the main replay button
    if (replayBtn) {
        replayBtn.classList.add('d-none');
    }
    
    // Show the pause button, make it wider
    if (pauseBtn) {
        pauseBtn.classList.remove('d-none');
        // Set up the pause button click handler
    pauseBtn.onclick = function() {
        if (typeof window.toggleReplayPause === 'function') {
            window.toggleReplayPause();
        }
    };
    }
    
    // Show the stop button
    if (stopBtn) {
        stopBtn.classList.remove('d-none');
        // Set up the stop button click handler
    stopBtn.onclick = function() {
        if (typeof window.stopReplay === 'function') {
            window.stopReplay();
        }
    };
    }
}

/**
 * Create controls for pause/resume/stop during replay
 * @deprecated Now using inline buttons instead of controls on canvas
 */
function createReplayControls() {
    // This function is no longer needed as we're using inline buttons
    logMessage('Using inline replay controls instead of canvas controls', 'DEBUG');
}

/**
 * Remove replay controls
 * @deprecated Now using inline buttons instead of controls on canvas
 */
function removeReplayControls() {
    // This function is no longer needed as we're using inline buttons
    logMessage('Using inline replay controls instead of canvas controls', 'DEBUG');
}

/**
 * Create or get the replay cursor element
 */
function createReplayCursor() {
    // Get the cursor size from global setting or use default
    const cursorSize = window.cursorSize || 20;
    
    // Check if cursor already exists
    let cursor = document.getElementById('replay-cursor');
    if (!cursor) {
        // Create a new cursor element
        cursor = document.createElement('div');
        cursor.id = 'replay-cursor';
        cursor.className = 'replay-cursor';
        cursor.style.position = 'absolute';
        cursor.style.width = `${cursorSize}px`;
        cursor.style.height = `${cursorSize}px`;
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
        } else {
        // Update existing cursor size
        cursor.style.width = `${cursorSize}px`;
        cursor.style.height = `${cursorSize}px`;
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
    if (!cursor) {
        logMessage('Replay cursor element not found!', 'ERROR');
        return;
    }
    
    // Get canvas position and scale
    const canvas = window.canvas;
    if (!canvas) {
        logMessage('Canvas not available for replay', 'ERROR');
        return;
    }
    
    // Get the cursor size from global setting or use default
    const cursorSize = window.cursorSize || 20;
    const largerSize = Math.round(cursorSize * 1.2); // 20% larger for mouse down
    
    // Calculate position
    const x = dataPoint.x;
    const y = dataPoint.y;
    
    // Update cursor position
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    
    // Determine the active tool (using the new activeTool property or legacy properties)
    const activeTool = dataPoint.activeTool || 
                      (dataPoint.isBoundingBox ? 'boundingBox' : 
                       (dataPoint.isLaserPointer ? 'laserPointer' : 'none'));
    
    // Enhanced debugging for events
    if (activeTool !== 'none' && dataPoint.type !== 'move') {
        logMessage(`${activeTool} ${dataPoint.type} event at (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
    }
    
    // Handle different tool behaviors
    if (dataPoint.type === 'down') {
        // Mouse down - make cursor larger and more opaque
        cursor.style.width = `${largerSize}px`;
        cursor.style.height = `${largerSize}px`;
        
        // Set cursor appearance based on tool
        if (activeTool === 'laserPointer') {
            cursor.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
            logMessage(`Starting laser trail at DOWN event: (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
            startLaserTrail();
        } else if (activeTool === 'boundingBox') {
            cursor.style.backgroundColor = 'rgba(0, 100, 255, 0.6)';
            logMessage(`Bounding box operation started: mode=${dataPoint.boundingbox_mode || 'unknown'}`, 'DEBUG');
            
            // Display starting box coordinates if available
            if (dataPoint.boxCoords) {
                logMessage(`Initial box: left=${Math.round(dataPoint.boxCoords.left)}, top=${Math.round(dataPoint.boxCoords.top)}`, 'DEBUG');
            }
        } else {
            cursor.style.backgroundColor = 'rgba(128, 128, 128, 0.5)'; // Default gray
        }
    } else if (dataPoint.type === 'up') {
        // Mouse up - return to normal size
        cursor.style.width = `${cursorSize}px`;
        cursor.style.height = `${cursorSize}px`;
        cursor.style.backgroundColor = 'rgba(255, 0, 0, 0.5)'; // Reset to default
        
        // Tool-specific actions
        if (activeTool === 'laserPointer') {
            logMessage(`Clearing laser trail at UP event: (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
            clearLaserTrail();
        } else if (activeTool === 'boundingBox') {
            logMessage(`Bounding box operation completed: mode=${dataPoint.boundingbox_mode || 'unknown'}`, 'DEBUG');
            
            // Display final box coordinates if available
            if (dataPoint.boxCoords) {
                const coords = dataPoint.boxCoords;
                logMessage(`Final box: left=${Math.round(coords.left)}, top=${Math.round(coords.top)}, width=${Math.round(coords.width)}, height=${Math.round(coords.height)}`, 'DEBUG');
            }
        }
    } else if (dataPoint.type === 'move') {
        // Handle move events differently based on tool
        if (activeTool === 'laserPointer') {
            // Log only occasionally to avoid flooding
            if (Math.random() < 0.05) {
                logMessage(`Adding to laser trail at MOVE event: (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
            }
            addToLaserTrail(x, y);
        } else if (activeTool === 'boundingBox' && dataPoint.boxCoords) {
            // For bounding box moves, could update a live preview if needed
            if (Math.random() < 0.05) {
                const coords = dataPoint.boxCoords;
                logMessage(`Box update: ${Math.round(coords.width)}x${Math.round(coords.height)}`, 'DEBUG');
            }
        }
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
    logMessage('Starting laser pointer trail', 'DEBUG');
    
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
            logMessage('Created new laser trail container', 'DEBUG');
        } else {
            logMessage('Error: Cannot find canvas container for laser trail', 'ERROR');
        }
    }
    
    // Make it visible
    trailContainer.style.display = 'block';
    
    // Initialize trail points array for this session
    window.currentLaserTrail = [];
    
    logMessage('Laser pointer trail initialized', 'DEBUG');
}

/**
 * Add a point to the laser trail during replay
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
function addToLaserTrail(x, y) {
    if (x === undefined || y === undefined) {
        logMessage('Error: Invalid coordinates for laser trail', 'ERROR');
        return;
    }
    
    // Initialize the trail array if it doesn't exist
    if (!window.currentLaserTrail) {
        window.currentLaserTrail = [];
        logMessage('Initializing laser trail array', 'DEBUG');
    }
    
    // Add point to the trail
    window.currentLaserTrail.push({ 
        x: x, 
        y: y,
        time: Date.now() // Add timestamp for aging effect
    });
    
    // Keep only the last 20 points to avoid performance issues
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
    if (!trailContainer) {
        logMessage('Error: Cannot find laser trail container', 'ERROR');
        return;
    }
    
    if (!window.currentLaserTrail || window.currentLaserTrail.length === 0) {
        // Nothing to draw
        return;
    }
    
    // Clear current trail
    trailContainer.innerHTML = '';
    
    // Get the cursor size from global setting or use a default
    const cursorSize = window.cursorSize || 10;
    
    // Get current time for aging calculation
    const now = Date.now();
    
    // Draw each point in the trail with opacity and size based on position and age
    window.currentLaserTrail.forEach((point, index, array) => {
        const pointElement = document.createElement('div');
        pointElement.className = 'laser-trail-point';
        
        // Calculate position in trail (0 to 1, where 1 is newest)
        const positionFactor = index / (array.length - 1);
        
        // Calculate age factor (1 is fresh, 0 is old)
        const AGE_DURATION = 1000; // 1 second until fully faded
        const age = point.time ? now - point.time : 0;
        const ageFactor = Math.max(0, 1 - (age / AGE_DURATION));
        
        // Combine position and age for final opacity
        const opacity = Math.min(0.9, 0.1 + (positionFactor * 0.7) * ageFactor);
        
        // Calculate size - newer points should be larger
        const baseSize = cursorSize * 0.5; // Smallest size
        const maxSize = cursorSize; // Largest size
        const size = baseSize + positionFactor * (maxSize - baseSize) * ageFactor;
        
        // Style the point - make it more visible with drop shadow and border
        pointElement.style.width = `${size}px`;
        pointElement.style.height = `${size}px`;
        pointElement.style.backgroundColor = `rgba(255, 30, 30, ${opacity})`; // Slightly brighter red
        pointElement.style.left = `${point.x}px`;
        pointElement.style.top = `${point.y}px`;
        pointElement.style.boxShadow = `0 0 ${Math.round(size/2)}px rgba(255, 0, 0, ${opacity * 0.8})`;
        pointElement.style.border = `1px solid rgba(255, 255, 255, ${opacity * 0.5})`;
        
        // Add to container
        trailContainer.appendChild(pointElement);
    });
}

/**
 * Clear the laser trail during replay
 */
function clearLaserTrail() {
    logMessage('Clearing laser trail', 'DEBUG');
    
    const trailContainer = document.getElementById('laser-trail-container');
    if (trailContainer) {
        trailContainer.innerHTML = '';
    } else {
        logMessage('Warning: Laser trail container not found for clearing', 'WARN');
    }
    
    window.currentLaserTrail = null;
}

/**
 * Generate diagnostic summary of mouse data 
 * @param {Array} data - Mouse data array to analyze
 * @returns {Object} Object containing diagnostic information
 */
function generateMouseDataDiagnostics(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return {
            total: 0,
            laserPointer: 0,
            move: 0,
            down: 0,
            up: 0,
            laserSessions: 0,
            samplePoint: null,
            duration: 0
        };
    }
    
    // Create diagnostics object
    const diagnostics = {
        total: data.length,
        laserPointer: data.filter(d => d.isLaserPointer === true).length,
        move: data.filter(d => d.type === 'move').length,
        down: data.filter(d => d.type === 'down').length,
        up: data.filter(d => d.type === 'up').length,
        laserMove: data.filter(d => d.type === 'move' && d.isLaserPointer === true).length,
        samplePoint: data.length > 0 ? data[0] : null,
        duration: 0
    };
    
    // Count laser pointer sessions (periods between down and up)
    let sessions = 0;
    let inSession = false;
    
    for (const point of data) {
        if (point.isLaserPointer) {
            if (point.type === 'down') {
                inSession = true;
                sessions++;
            } else if (point.type === 'up') {
                inSession = false;
            }
        }
    }
    
    diagnostics.laserSessions = sessions;
    
    // Calculate recording duration
    if (data.length > 1) {
        const sortedData = [...data].sort((a, b) => a.timeOffset - b.timeOffset);
        diagnostics.duration = sortedData[sortedData.length - 1].timeOffset - sortedData[0].timeOffset;
    }
    
    return diagnostics;
}

/**
 * Log diagnostics about mouse data
 * @param {Array} data - Mouse data array to analyze
 * @param {string} context - Context for the log (e.g., 'save', 'replay')
 */
function logMouseDataDiagnostics(data, context) {
    const diagnostics = generateMouseDataDiagnostics(data);
    
    logMessage(`MOUSE DATA DIAGNOSTICS (${context.toUpperCase()}):`, 'INFO');
    logMessage(`Total mouse data points: ${diagnostics.total}`, 'INFO');
    logMessage(`Laser pointer points: ${diagnostics.laserPointer}`, 'INFO');
    logMessage(`Move events: ${diagnostics.move} (${diagnostics.laserMove} laser moves)`, 'INFO');
    logMessage(`Down events: ${diagnostics.down}`, 'INFO');
    logMessage(`Up events: ${diagnostics.up}`, 'INFO');
    logMessage(`Laser pointer sessions: ${diagnostics.laserSessions}`, 'INFO');
    logMessage(`Recording duration: ${Math.round(diagnostics.duration / 1000)} seconds`, 'INFO');
    
    if (diagnostics.laserPointer === 0) {
        logMessage(`WARNING: No laser pointer data found!`, 'WARN');
    } else if (diagnostics.samplePoint) {
        // Log a sample point
        const sample = diagnostics.samplePoint;
        logMessage(`Sample data point: type=${sample.type}, x=${Math.round(sample.x)}, y=${Math.round(sample.y)}, isLaserPointer=${sample.isLaserPointer}`, 'DEBUG');
    }
}

/**
 * Save raw mouse data for debugging purposes
 * This creates a simplified JSON file with just the mouse movements
 */
function saveMouseDataForDebug() {
    try {
        if (mouseData.length === 0) {
            logMessage('No mouse data to save for debugging', 'WARN');
            return;
        }
        
        // Get current timestamp for filename
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const filename = `mouse-data-debug-${timestamp}.json`;
        
        // Create diagnostics report
        const diagnostics = generateMouseDataDiagnostics(mouseData);
        
        // Create debug object with diagnostics and raw data
        const debugData = {
            metadata: {
                timestamp: timestamp,
                diagnostics: diagnostics
            },
            mouseData: mouseData
        };
        
        // Convert to JSON and save
        const jsonString = JSON.stringify(debugData, null, 2);
        const jsonBlob = new Blob([jsonString], { type: 'application/json' });
        
        // Download the file
        downloadFile(jsonBlob, filename);
        
        logMessage(`Mouse data saved for debugging to ${filename}`, 'INFO');
        logMessage(`File contains ${mouseData.length} mouse data points`, 'INFO');
        
        return true;
    } catch (error) {
        console.error('Error saving debug mouse data:', error);
        logMessage('Error saving debug data: ' + error.message, 'ERROR');
        return false;
    }
} 

// Export functions for use in other modules - No longer exporting drawing tool functions
window.startCaptureMouseData = startCaptureMouseData;
window.stopCaptureMouseData = stopCaptureMouseData;
window.saveMouseDataForDebug = saveMouseDataForDebug; 