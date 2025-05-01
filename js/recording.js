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
// let mouseData = []; // Old flat list
let recordedEvents = { // New structured events object
    initial_state: [],
    audio_recording: [],
    tool_change: [],
    image_adjustments: [],
    laser_pointer: [],
    bounding_box: [],
    // Add other categories as needed
};
window.recordedEvents = recordedEvents; // Expose to window if needed by other modules
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
// window.mouseData = mouseData; // Deprecated
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
    
    // <<< NEW: Disable Export Button >>>
    const exportBtn = document.getElementById('export-analysis-btn');
    if (exportBtn) {
        exportBtn.disabled = true;
        logMessage('Export analysis button disabled on recording start.', 'DEBUG');
    }
    // <<< END NEW >>>

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
                    window.audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Assign to window
                    logMessage(`Recording stopped: Final audio blob created (size: ${window.audioBlob.size}, type: ${window.audioBlob.type})`, 'INFO');
                    
                    // Update UI
                    updateRecordingUI(false, false);
                    
                    // <<< MOVED: Update button states AFTER blob is created >>>
                    if (typeof window.updateButtonStates === 'function') {
                        window.updateButtonStates();
                        logMessage('mediaRecorder.onstop: Called window.updateButtonStates.', 'DEBUG');
                    } else {
                        logMessage('mediaRecorder.onstop: window.updateButtonStates function not found.', 'WARN');
                    }
                    // <<< END MOVE >>>
                };
                
                // Clear existing data
                audioChunks = [];
                // Reset the recorded events structure
                window.recordedEvents = {
                    initial_state: [],
                    audio_recording: [],
                    tool_change: [],
                    image_adjustments: [],
                    laser_pointer: [],
                    bounding_box: [],
                };
                // *** NEW: Record Initial State ***
                recordInitialState(); // Call the new function here
                
                // Reset total recording time display
                const totalRecordingTime = document.getElementById('total-recording-time');
                if (totalRecordingTime) {
                    totalRecordingTime.textContent = '00:00';
                }
                
                // Start capturing mouse data (needs refactoring later to generate events)
                startCaptureMouseData(); // Keep this for now, will refactor later
                
                // Start recording
                mediaRecorder.start();
                isRecording = true;
                isPaused = false;
                
                // Record the start time and reset paused time
                recordingStartTime = Date.now();
                pausedTime = 0;
                
                // Record the audio recording start event
                recordAudioEvent('start');
                
                // Start timer updates
                recordingTimerInterval = setInterval(updateRecordingTimer, 1000);
                eventViewerInterval = setInterval(updateEventViewer, 10000); // <<< CHANGED: Update event viewer every 10 seconds
                
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
                window.audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Assign to window
                logMessage(`Recording stopped: Final audio blob created (size: ${window.audioBlob.size}, type: ${window.audioBlob.type})`, 'INFO');
                
                // Update UI
                updateRecordingUI(false, false);
                
                // <<< MOVED: Update button states AFTER blob is created >>>
                if (typeof window.updateButtonStates === 'function') {
                    window.updateButtonStates();
                    logMessage('mediaRecorder.onstop: Called window.updateButtonStates.', 'DEBUG');
                } else {
                    logMessage('mediaRecorder.onstop: window.updateButtonStates function not found.', 'WARN');
                }
                // <<< END MOVE >>>
            };
            
            // Clear existing data
            audioChunks = [];
            // Reset the recorded events structure
            window.recordedEvents = {
                initial_state: [],
                audio_recording: [],
                tool_change: [],
                image_adjustments: [],
                laser_pointer: [],
                bounding_box: [],
            };
            // *** NEW: Record Initial State ***
            recordInitialState(); // Call the new function here
            
            // Reset total recording time display
            const totalRecordingTime = document.getElementById('total-recording-time');
            if (totalRecordingTime) {
                totalRecordingTime.textContent = '00:00';
            }
            
            // Start capturing mouse data (needs refactoring later to generate events)
            
            // Start recording
            mediaRecorder.start();
            isRecording = true;
            isPaused = false;
            
            // Record the start time and reset paused time
            recordingStartTime = Date.now();
            pausedTime = 0;
            
            // Record the audio recording start event
            recordAudioEvent('start');
            
            // Start timer updates
            recordingTimerInterval = setInterval(updateRecordingTimer, 1000);
            eventViewerInterval = setInterval(updateEventViewer, 10000); // <<< CHANGED: Update event viewer every 10 seconds
            
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
    mediaRecorder.stop(); // Note: onstop handler will process audioBlob and update UI
    
    // Stop all tracks in the stream to release the microphone
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null; // Clear the stream reference
    }
    
    // Clear the timer interval
    if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = null;
    }
    // <<< NEW: Clear event viewer interval >>>
    if (eventViewerInterval) {
        clearInterval(eventViewerInterval);
        eventViewerInterval = null;
    }
    // <<< END NEW SECTION >>>
    
    // Stop capturing mouse data
    
    
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

    // Record the audio recording end event
    recordAudioEvent('stop');

    // <<< NEW: Final update to event viewer after stopping >>>
    updateEventViewer();
    
    // <<< MOVED: Call to updateButtonStates moved into mediaRecorder.onstop >>>
    logMessage('stopAudioRecording: MediaRecorder stopped, onstop handler will update buttons.', 'DEBUG');
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
 * Save annotation data (audio + events) to a file
 */
async function saveAnnotationData() {
    if (!audioBlob && Object.values(window.recordedEvents).every(arr => arr.length === 0)) {
        logMessage('No annotation data to save (no audio or recorded events)', 'WARN');
        alert('There is no annotation data to save.');
            return;
        }
        
    // Prepare JSON data with structured events
    const totalDuration = getCurrentRecordingTime(); // Get final duration
    const recordingTimestamp = new Date(recordingStartTime).toISOString();

    // Get image info (if available)
    const imageInfo = {
        url: document.getElementById('url-image')?.value || null,
        width: window.canvas?.width || null, // Current canvas width
        height: window.canvas?.height || null // Current canvas height
        // TODO: Store original image dimensions if needed for replay scaling
    };

    // --- Convert audio blob to Base64 ---
    let audioBlobBase64 = null;
                if (audioBlob) {
        try {
            audioBlobBase64 = await blobToBase64(audioBlob);
            logMessage('Audio blob successfully converted to Base64', 'DEBUG');
    } catch (error) {
            console.error('Error converting audio blob to Base64:', error);
            logMessage('Error converting audio blob to Base64. Saving without audio.', 'ERROR');
        }
    } else {
        logMessage('No audio blob found to save.', 'INFO');
    }

    // --- Structure the JSON data ---
    const annotationData = {
        // Ensure "Events" is the first key for readability
        Events: window.recordedEvents,

        // Metadata
        version: "2.0", // New schema version
        recordingStartTime: recordingTimestamp,
        totalDuration: totalDuration,
        imageInfo: imageInfo, // contains the url: document.getElementById('url-image')?.value || null
        audioBlobBase64: audioBlobBase64 // Include Base64 audio string or null
    };

    // Stringify the data with pretty printing
    const jsonData = JSON.stringify(annotationData, null, 2);

    // Create a blob from the JSON data
    const jsonBlob = new Blob([jsonData], { type: 'application/json' });

    // Generate filename based on stored image base name
    const baseFilename = window.currentImageBaseName || 'annotation'; // Use stored name
    const suggestedFilename = `${baseFilename}_annotation.json`; // Construct the suggested name

    // --- Attempt to use Save File Picker API first, fallback to FileSaver.js ---
    if (window.showSaveFilePicker) {
        logMessage('Attempting to save using the File System Access API (Save Dialog)...', 'INFO');
        // Use await here as saveFileWithDialog is async
        const saved = await saveFileWithDialog(suggestedFilename, jsonBlob);
        if (!saved) {
            // Optional: Could add a message indicating fallback won't happen if user cancelled.
            // If saveFileWithDialog failed for reasons other than cancellation, 
            // we might still want to avoid the fallback, or try it cautiously.
            logMessage('Save with dialog did not complete (cancelled or error).', 'INFO');
            // Decide if fallback is desired after cancellation/error.
            // For now, we just stop if the dialog method fails/cancels.
        }
        // No explicit fallback here after cancellation/error from dialog
    } else {
        // Fallback to FileSaver.js if the API is not supported
        logMessage('File System Access API not supported, falling back to FileSaver.js direct download.', 'INFO');
        try {
            saveAs(jsonBlob, suggestedFilename);
            logMessage(`Annotation data saved as ${suggestedFilename} using FileSaver.js`, 'INFO');
        } catch (error) {
            console.error('Error using FileSaver:', error);
            logMessage(`Error saving file with FileSaver.js: ${error.message}`, 'ERROR');
            alert('Failed to save the annotation file automatically. See console for details.');
        }
    }
    // --- End Save Logic ---
}

/**
 * Helper function to convert Blob to Base64
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} Promise resolving with Base64 string
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
            const reader = new FileReader();
        reader.onloadend = () => {
            // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Load annotation data from a saved file
 * Supports both direct JSON files and email text files with embedded annotations
 * @param {Event} event - The file input change event
 */
function loadAnnotationData(event) {
    const file = event.target.files[0];
    if (!file) return;
    logMessage(`Loading file: ${file.name}`, 'INFO');
    
    try {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const fileContent = e.target.result;
                const fileExt = file.name.split('.').pop().toLowerCase();
                
                if (fileExt === 'json') {
                    logMessage('Processing JSON file...', 'DEBUG');
                    processJsonAnnotationData(fileContent); // Calls V2 processor
                } else if (fileExt === 'txt') {
                    logMessage('Processing TXT (email format) file...', 'DEBUG');
                    processEmailAnnotationData(fileContent); // Needs update for V2
                } else {
                    logMessage(`Unsupported file type: ${fileExt}. Please use .json or .txt files.`, 'ERROR');
                    alert('Unsupported file type. Please select a .json or .txt file.');
                }
            } catch (parseError) {
                console.error('Error parsing file content:', parseError);
                logMessage('Error parsing file content: ' + parseError.message, 'ERROR');
                alert('Failed to parse the annotation file. Check console for details.');
            }
             // Reset file input to allow loading the same file again
             event.target.value = null;
        };
        
        reader.onerror = function() {
            logMessage('Error reading file', 'ERROR');
            alert('Error reading the selected file.');
        };
        
        reader.readAsText(file);
            } catch (error) {
        console.error('Error loading annotation data:', error);
        logMessage('Error loading annotation data: ' + error.message, 'ERROR');
        alert('An error occurred while loading the file.');
    }
}

/**
 * Process JSON annotation data loaded directly from a JSON file (V2 Format)
 * @param {string} jsonContent - The JSON file content as string
 */
async function processJsonAnnotationData(jsonContent) {
    logMessage('Processing V2 JSON data...', 'DEBUG');
    try {
        const data = JSON.parse(jsonContent);
        
        // --- Data Validation --- //
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid JSON structure: Root is not an object.');
        }
        // Allow loading older versions for now, but log a warning
        if (data.version !== "2.0") {
            logMessage(`Warning: Loaded data version is ${data.version || 'unknown'}, expected 2.0. Replay might be incomplete or inaccurate.`, 'WARN');
        }
        if (!data.Events || typeof data.Events !== 'object') {
             // Attempt to handle potential V1 format
             if (data.mouseData && Array.isArray(data.mouseData)) {
                 logMessage('Detected V1 data format (mouseData). Attempting limited load.', 'WARN');
                 // Create a minimal V2 structure
                 window.recordedEvents = { initial_state: [], audio_recording: [], laser_pointer: data.mouseData, bounding_box: [] };
                 // Try to extract image/audio from V1 structure if possible
                 window.loadedAnnotationData = { Events: window.recordedEvents, imageInfo: data.image, audioBlobBase64: data.audio?.dataUrl?.split(',')[1], version: '1.0' };
             } else {
                 throw new Error('Invalid JSON structure: Missing or invalid "Events" object (and not V1 format).');
             }
        } else {
            // Store V2 data directly
            window.recordedEvents = data.Events || {};
            window.loadedAnnotationData = data; // Store the full data for metadata access
        }

        logMessage(`Processing annotation data V${data.version || '1.0'}...`, 'INFO');
        audioBlob = null; // Reset audio blob
        window.selectedEventId = null; // <<< NEW: Reset selection
        window.decodedFullAudioBuffer = null; // <<< NEW: Reset decoded audio buffer

        // --- Load Audio (from V2 format) --- //
        if (data.audioBlobBase64) {
            logMessage('Found Base64 audio data, attempting to decode...', 'DEBUG');
            try {
                const byteString = atob(data.audioBlobBase64);
                const arrayBuffer = new ArrayBuffer(byteString.length);
                const intArray = new Uint8Array(arrayBuffer);
                for (let i = 0; i < byteString.length; i++) {
                    intArray[i] = byteString.charCodeAt(i);
                }
                window.audioBlob = new Blob([arrayBuffer], { type: 'audio/webm' }); // Assign to window.audioBlob
                logMessage(`Audio data successfully loaded (${(window.audioBlob.size / 1024).toFixed(1)} KB)`, 'INFO');
            } catch (audioError) {
                console.error('Error decoding/loading Base64 audio:', audioError);
                logMessage('Error loading audio data: ' + audioError.message, 'WARN');
                window.audioBlob = null;
            }
        } else if (window.loadedAnnotationData?.audio?.dataUrl) { // Check V1 audio dataUrl
            logMessage('Found V1 audio dataUrl, attempting to decode...', 'DEBUG');
             try {
                const audioDataUrl = window.loadedAnnotationData.audio.dataUrl;
                const byteString = atob(audioDataUrl.split(',')[1]);
                const mimeString = audioDataUrl.split(',')[0].split(':')[1].split(';')[0];
                const arrayBuffer = new ArrayBuffer(byteString.length);
                const intArray = new Uint8Array(arrayBuffer);
                for (let i = 0; i < byteString.length; i++) { intArray[i] = byteString.charCodeAt(i); }
                window.audioBlob = new Blob([arrayBuffer], { type: mimeString }); // Assign to window.audioBlob
                logMessage(`V1 Audio data successfully loaded (${(window.audioBlob.size / 1024).toFixed(1)} KB)`, 'INFO');
            } catch (audioError) {
                 console.error('Error decoding/loading V1 audio dataUrl:', audioError);
                logMessage('Error loading V1 audio data: ' + audioError.message, 'WARN');
                window.audioBlob = null;
            }
        } else {
             logMessage('No audio data found in the file.', 'INFO');
        }

        // --- Log Summary --- //
        // Use loaded events, not just audio category
        const eventCount = Object.values(window.recordedEvents).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
        logMessage(`Annotation data loaded: ${eventCount} events. Audio found: ${!!window.audioBlob}`, 'INFO');

        // --- Update UI (including button states) --- //
        updateUIAfterDataLoad(window.loadedAnnotationData); // Handles image load, duration display etc.
        logMessage('processJsonAnnotationData: updateUIAfterDataLoad called (recording.js). Awaiting image load potentially...', 'TRACE');

        // Button states need to be updated AFTER image loading (if any) finishes in updateUIAfterDataLoad
        // The call to updateButtonStates is now inside updateUIAfterDataLoad

    } catch (error) {
        console.error('Error processing annotation JSON:', error);
        logMessage('Error processing annotation JSON: ' + error.message, 'ERROR');
        alert('Failed to process the annotation JSON file. It might be corrupted or in an unsupported format. Check console for details.');
        window.recordedEvents = {};
        window.audioBlob = null;
        window.selectedEventId = null;
        window.decodedFullAudioBuffer = null;
        window.loadedAnnotationData = null;
        resetReplayButton();
        // Ensure UI buttons reflect the error state
        if (typeof window.updateButtonStates === 'function') window.updateButtonStates();
    }
}

/**
 * Process annotation data embedded in an email text file
 * NOTE: Assumes email contains V1 format data. Needs update or separate handling for V2.
 * @param {string} emailContent - The email file content as string
 */
function processEmailAnnotationData(emailContent) {
     // TODO: Update this function if emails are expected to contain V2 JSON.
     logMessage('Processing TXT file (Base64 encoded JSON)...', 'INFO'); // Updated log message
    try {
         // Basic marker finding
         const startMarker = "Annotation data starts here ----->"; // Use double quotes for consistency
         const endMarker = "<----- Annotation data ends here"; // Use double quotes
        let startIndex = emailContent.indexOf(startMarker);
        if (startIndex === -1) throw new Error('Could not find annotation start marker.');
            startIndex += startMarker.length;
        let endIndex = emailContent.indexOf(endMarker, startIndex);
        if (endIndex === -1) endIndex = emailContent.length; // If end marker is missing, read to end

        const base64Data = emailContent.substring(startIndex, endIndex).trim();
        if (!base64Data) throw new Error('No annotation data found between markers');

        // Decode the Base64 data to get the original JSON string
        let decodedJsonString;
        try {
            decodedJsonString = atob(base64Data);
            logMessage('Base64 data successfully decoded.', 'DEBUG');
        } catch (decodeError) {
            console.error('Error decoding Base64 data:', decodeError);
            throw new Error(`Failed to decode Base64 data: ${decodeError.message}`);
        }

        // Process the decoded JSON string using the standard JSON processor
        // The processJsonAnnotationData function handles both V1 and V2 structure internally
        processJsonAnnotationData(decodedJsonString);
        logMessage('processEmailAnnotationData: processJsonAnnotationData called, which will call updateUIAfterDataLoad.', 'TRACE'); // Confirmation log

    } catch (error) {
        console.error('Error processing encoded TXT data:', error);
        logMessage('Error processing encoded TXT data: ' + error.message, 'ERROR');
         alert('Failed to process annotation data from TXT file. It might be corrupted or missing markers. Check console for details.'); // Updated alert message
         // Reset state on error
         window.recordedEvents = {};
        window.audioBlob = null;
        window.selectedEventId = null;
        window.decodedFullAudioBuffer = null;
        window.loadedAnnotationData = null;
        resetReplayButton();
        // Ensure UI buttons reflect the error state
        if (typeof window.updateButtonStates === 'function') window.updateButtonStates();
    }
}

/**
 * Update UI elements after loading annotation data (Handles V1/V2)
 * @param {Object} data - The loaded annotation data (full V1 or V2 object)
 */
function updateUIAfterDataLoad(data) {
    logMessage('Updating UI after data load...', 'DEBUG');
    // Load the image if available (check both V1 and V2 locations)
    const imageUrl = data?.imageInfo?.url || data?.image?.dataUrl;
    if (imageUrl) {
        // If it's a data URL from V1, use loadImageFromDataUrl
        if (data?.image?.dataUrl) {
        loadImageFromDataUrl(data.image.dataUrl);
            logMessage('Loaded image from V1 dataUrl', 'DEBUG');
        } else {
            loadImageFromUrl(imageUrl); // Assumes V2 URL
            logMessage('Loaded image from V2 imageInfo url', 'DEBUG');
        }
        // Update URL input field if applicable
        const urlInput = document.getElementById('url-image');
        if (urlInput && data?.imageInfo?.url) urlInput.value = data.imageInfo.url;
    } else {
        logMessage('No image URL found in loaded data.', 'WARN');
    }

    // Update the total recording time display (check both V1 and V2 locations)
    const totalDurationMs = data?.totalDuration ?? (data?.audio?.duration ? data.audio.duration * 1000 : undefined);
    if (totalDurationMs !== undefined) {
        const totalSeconds = Math.floor(totalDurationMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const totalRecordingTime = document.getElementById('total-recording-time');
        if (totalRecordingTime) {
            totalRecordingTime.textContent = formattedTime;
        }
        logMessage(`Set total duration display to ${formattedTime}`, 'DEBUG');
    } else {
         logMessage('Total duration not found in loaded data.', 'WARN');
    }
    
    // Enable replay button if we have events or audio
    const hasEvents = Object.values(window.recordedEvents || {}).some(arr => Array.isArray(arr) && arr.length > 0);
    const replayBtn = document.getElementById('replay-btn');
    if (replayBtn) {
         replayBtn.disabled = !(hasEvents || window.audioBlob);
         if (!replayBtn.disabled) {
            logMessage('Replay button enabled.', 'DEBUG');
         } else {
             logMessage('Replay button remains disabled (no events or audio).', 'DEBUG');
         }
    }
    
    // Show success notification
    const eventCount = Object.values(window.recordedEvents || {}).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    const notification = document.createElement('div');
    notification.className = 'alert alert-success p-2 m-3 position-fixed top-0 start-50 translate-middle-x'; // Centered top
    notification.style.zIndex = '1060'; // Ensure it's above most elements
    notification.innerHTML = `<strong>Success!</strong> Annotation data (V${data.version || '1.0'}) loaded (${eventCount} events${window.audioBlob ? ', audio included' : ''}).`;
    document.body.appendChild(notification);
    setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 4000); // Slightly longer visibility

    // <<< NEW: Update viewer after loading data >>>
    updateEventViewer();
    // <<< REMOVED previous NOTE about button state >>>
    logMessage('updateUIAfterDataLoad: (in recording.js) Non-button UI elements updated.', 'TRACE');
   
    // <<< NEW: Update Button States AFTER UI is loaded/updated >>>
    if (typeof window.updateButtonStates === 'function') {
        window.updateButtonStates();
        logMessage('updateUIAfterDataLoad: Called window.updateButtonStates (app.js). Recording.js', 'DEBUG');
    } else {
        logMessage('updateUIAfterDataLoad: window.updateButtonStates function not found. Recording.js', 'WARN');
    }
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
 * Play back the recorded annotation data - REFAC TORED FOR V2 EVENTS
 */
async function replayAnnotation() {
    logMessage('Replay V2: Initializing...', 'INFO');

    // --- Data Validation --- //
    const recordedEvents = window.recordedEvents || {};
    const allEventCategories = Object.values(recordedEvents);
    const hasEvents = allEventCategories.some(arr => Array.isArray(arr) && arr.length > 0);

    if (!window.audioBlob && !hasEvents) {
        logMessage('Replay V2: No recording or annotation data to replay', 'WARN');
        alert('No data available to replay.');
        return;
    }
    
    try {
        // --- Prepare Replay Environment --- //
        logMessage('Replay V2: Preparing environment...', 'DEBUG');

        // 1. Ensure Correct Image is Loaded & Apply Initial State
        const initial_state = recordedEvents.initial_state?.[0];
        if (initial_state?.image_url) {
            logMessage(`Replay V2: Loading recorded image: ${initial_state.image_url}`, 'INFO');
            // TODO: Properly wait for image load before continuing
            loadImageFromUrl(initial_state.image_url); 
            await new Promise(resolve => setTimeout(resolve, 1000)); // Temporary delay
            logMessage('Replay V2: Image loaded.', 'INFO');

            // --- NEW: Apply Initial Zoom State ---
            const zoomState = initial_state.zoom_state || 'natural';
            logMessage(`Replay V2: Applying initial zoom state: ${zoomState}`, 'INFO');
            try {
                if (zoomState === 'max_dim') {
                    if (typeof window.resizeCanvasToFit === 'function') {
                        // Assuming MAX_ZOOM_WIDTH and MAX_ZOOM_HEIGHT are available globally from app.js
                        window.resizeCanvasToFit(MAX_ZOOM_WIDTH, MAX_ZOOM_HEIGHT);
                        logMessage(`Replay V2: Called resizeCanvasToFit(${MAX_ZOOM_WIDTH}, ${MAX_ZOOM_HEIGHT})`, 'DEBUG');
                    } else {
                        logMessage('Replay V2: resizeCanvasToFit function not found! Cannot apply max_dim zoom.', 'ERROR');
                    }
                } else { // Default to natural zoom
                    if (typeof window.resizeCanvas === 'function') {
                        window.resizeCanvas();
                        logMessage('Replay V2: Called resizeCanvas() for natural zoom.', 'DEBUG');
                    } else {
                        logMessage('Replay V2: resizeCanvas function not found! Cannot apply natural zoom.', 'ERROR');
                    }
                }
                // Add a small delay after resize call to allow rendering if needed
                await new Promise(resolve => setTimeout(resolve, 100)); 
            } catch (zoomError) {
                logMessage(`Replay V2: Error applying initial zoom: ${zoomError.message}`, 'ERROR');
            }
            // --- End Apply Initial Zoom State ---

            logMessage('Replay V2: Applying initial state (filters/cursor)... ', 'DEBUG');
            // Apply brightness, contrast, cursor size from initial_state
            const brightnessSlider = document.getElementById('brightness');
            const contrastSlider = document.getElementById('contrast');
            const cursorSizeSlider = document.getElementById('cursor-size');
            if(brightnessSlider) brightnessSlider.value = initial_state.brightness ?? 0;
            if(contrastSlider) contrastSlider.value = initial_state.contrast ?? 0;
            if(window.updateImageFilters) window.updateImageFilters();
            if(cursorSizeSlider && initial_state.cursor_size !== undefined) {
                cursorSizeSlider.value = initial_state.cursor_size;
                if(window.updateCursorSize) window.updateCursorSize();
            }
             logMessage('Replay V2: Initial state applied.', 'DEBUG');
        } else {
            logMessage('Replay V2: No initial state event found or no image URL.', 'WARN');
        }

        // 2. Prepare Sorted Event List
        let allEvents = [];
        for (const category in recordedEvents) {
            if (Array.isArray(recordedEvents[category])) {
                recordedEvents[category].forEach(event => {
                    if (event && (event.time_offset !== undefined || event.start_time_offset !== undefined)) {
                        event.category = category; // Add category info
                        event.replay_time = event.start_time_offset ?? event.time_offset;
                        allEvents.push(event);
                    } else {
                         logMessage(`Replay V2: Skipping invalid event in category ${category}: ${JSON.stringify(event)}`, 'WARN');
                    }
                });
            }
        }
        allEvents.sort((a, b) => a.replay_time - b.replay_time);

        if (allEvents.length === 0 && !window.audioBlob) {
             logMessage('Replay V2: No valid events found to replay.', 'WARN');
        resetReplayButton();
             return;
        }
        logMessage(`Replay V2: Prepared ${allEvents.length} events for replay.`, 'INFO');

        // 3. Setup Replay UI / Cursor
        // console.log('DEBUG: Checking window.DrawingTools right before createReplayCursor call:', window.DrawingTools); // <<< ADDED LOG
        console.log('DEBUG: Keys on window.DrawingTools before createReplayCursor:', Object.keys(window.DrawingTools || {})); // <<< MODIFIED LOG
        const replayCursor = window.DrawingTools.createReplayCursor();
        if (!replayCursor) {
            logMessage('Replay V2: Failed to create replay cursor, aborting.', 'ERROR');
            resetReplayButton();
            return;
        }
        window.DrawingTools.clearLaserTrail();
        window.DrawingTools.removeReplayBoundingBox();
        showReplayControls(); // Show Pause/Stop buttons

        // --- Replay Loop Setup --- //
        let isReplaying = true;
        let isPaused = false;
        let replayStartTime = 0; // Will be set precisely when audio starts or loop begins
        let pauseStartTime = 0;
        let totalPausedTime = 0;
        let audioElement = null;
        let animationFrameId = null;
        let currentEventIndex = 0;
        let lastCursorPos = { x: initial_state?.image_width / 2 || 0, y: initial_state?.image_height / 2 || 0 }; // Initial cursor position

        // State for tracking active multi-frame events within replayLoop
        let activeLaserEventDetails = null;
        let currentLaserPointIndex = 0;
        let activeLaserPoints = null;
        let activeBBoxEventDetails = null;
        let currentBBoxPointIndex = 0;
        let activeBBoxPoints = null;
        let cursorNeedsUpdate = true; // Start true to set initial position

         // Handlers for replay controls (Pause/Resume/Stop)
        window.pauseReplay = () => {
            if (!isPaused && isReplaying) {
                isPaused = true;
                pauseStartTime = Date.now();
                if (audioElement) audioElement.pause();
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                logMessage('Replay V2: Paused', 'INFO');
                 // Update button UI
                const pauseBtn = document.getElementById('replay-pause-btn');
                if (pauseBtn) { pauseBtn.textContent = 'Resume'; pauseBtn.classList.replace('btn-warning', 'btn-success'); }
            }
        };
        window.resumeReplay = () => {
            if (isPaused && isReplaying) {
                const pauseDuration = Date.now() - pauseStartTime;
                totalPausedTime += pauseDuration;
                isPaused = false;
                if (audioElement) audioElement.play().catch(e => logMessage('Audio resume error: '+e.message, 'ERROR'));
                animationFrameId = requestAnimationFrame(replayLoop);
                logMessage('Replay V2: Resumed', 'INFO');
                // Update button UI
                const pauseBtn = document.getElementById('replay-pause-btn');
                if (pauseBtn) { pauseBtn.textContent = 'Pause'; pauseBtn.classList.replace('btn-success', 'btn-warning'); }
            }
        };
        window.toggleReplayPause = () => { isPaused ? window.resumeReplay() : window.pauseReplay(); };
        window.stopReplay = () => {
            logMessage('Replay V2: Stopped by user', 'INFO');
            isReplaying = false;
            if (audioElement) { audioElement.pause(); audioElement.currentTime = 0; URL.revokeObjectURL(audioElement.src); }
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            window.DrawingTools.hideReplayCursor(true); // Full cleanup
            resetReplayButton();
            removeReplayControls();
        };

        // Setup listeners for inline controls
         const pauseBtn = document.getElementById('replay-pause-btn');
         const stopBtn = document.getElementById('replay-stop-btn');
         if(pauseBtn) pauseBtn.onclick = window.toggleReplayPause;
         if(stopBtn) stopBtn.onclick = window.stopReplay;


        // --- Audio Setup --- //
        let audioStarted = false;
        const startReplayProcess = () => {
            replayStartTime = Date.now(); // Set precise start time
            logMessage(`Replay V2: Starting main loop at ${replayStartTime}`, 'DEBUG');
            replayLoop(); // Start the animation loop
        };

        if (window.audioBlob) {
            const audioURL = URL.createObjectURL(window.audioBlob);
            audioElement = new Audio(audioURL);
            audioElement.onended = () => { logMessage('Replay V2: Audio ended', 'INFO'); };
            audioElement.oncanplaythrough = () => {
                 logMessage('Replay V2: Audio ready.', 'DEBUG');
                 if (!audioStarted) {
                     audioStarted = true;
                     audioElement.play().catch(e => logMessage('Audio play error: '+e.message, 'ERROR'));
                     startReplayProcess(); // Start loop synced with audio
                 }
            };
            audioElement.onerror = (e) => {
                logMessage('Replay V2: Audio error: ' + (e.target.error?.message || 'Unknown error'), 'ERROR');
                 if (!audioStarted) { // If audio fails, start visuals anyway
                     audioStarted = true;
                     startReplayProcess();
                 }
            };
             // Load audio. If it fails to load/play, startReplayProcess will be called by onerror.
            audioElement.load();
            logMessage('Replay V2: Audio loading initiated...', 'DEBUG');
            // Safety timeout: If audio doesn't report ready in 2s, start visuals anyway
            setTimeout(() => {
                 if (!audioStarted) {
                     logMessage('Replay V2: Audio readiness timeout, starting visuals.', 'WARN');
                     audioStarted = true;
                     startReplayProcess();
                 }
            }, 2000);

        } else {
            logMessage('Replay V2: No audio found.', 'INFO');
            startReplayProcess(); // Start visuals immediately if no audio
        }


        // --- Main Replay Loop --- //
        function replayLoop() {
            if (!isReplaying || isPaused) {
                if (isReplaying) animationFrameId = requestAnimationFrame(replayLoop);
                return;
            }

            cursorNeedsUpdate = false; // <<< RESET FLAG AT START OF FRAME >>>

            const elapsedMs = Date.now() - replayStartTime;
            let eventsToProcess = [];

            // Gather events that should have occurred by now
            while (currentEventIndex < allEvents.length && allEvents[currentEventIndex].replay_time <= elapsedMs) {
                eventsToProcess.push(allEvents[currentEventIndex]);
                currentEventIndex++;
            }

            // Process gathered events
            if (eventsToProcess.length > 0) {
                eventsToProcess.forEach(event => {
                    try {
                        let cursorNeedsUpdateFromEvent = false; // Track if this specific event type should update cursor pos
                        switch (event.category) {
                            case 'initial_state': break; // Already handled
                            case 'tool_change':
                                logMessage(`Replay V2: Tool changed to ${event.tool_name} at ${event.replay_time.toFixed(0)}ms`, 'DEBUG');
                                // TODO: Update UI button highlights if desired
                                break;
                            case 'image_adjustments':
                                logMessage(`Replay V2: Applying ${event.adjustment_type}=${event.value} at ${event.replay_time.toFixed(0)}ms`, 'DEBUG');
                                const slider = document.getElementById(event.adjustment_type);
                                if (slider) slider.value = event.value;
                                if (window.updateImageFilters) window.updateImageFilters();
                                break;
                            case 'laser_pointer':
                                logMessage(`Replay V2: Laser Pointer event started (ID: ${event.event_id}) at ${event.replay_time.toFixed(0)}ms`, 'DEBUG');
                                console.log('  Laser Event Data:', JSON.stringify(event)); // <<< ADDED LOG
                                activeLaserPoints = event.points || [];
                                currentLaserPointIndex = 0;
                                activeLaserEventDetails = event; // Store the main event details

                                // <<< NEW: Set initial cursor position from the first point >>>
                                if (activeLaserPoints.length > 0 && typeof activeLaserPoints[0].x === 'number' && typeof activeLaserPoints[0].y === 'number') {
                                    lastCursorPos = { x: activeLaserPoints[0].x, y: activeLaserPoints[0].y };
                                    cursorNeedsUpdate = true; // Ensure it gets updated visually in this frame
                                    logMessage(`   Set initial cursor for laser event to (${lastCursorPos.x.toFixed(0)}, ${lastCursorPos.y.toFixed(0)})`, 'DEBUG');
                                } else {
                                     logMessage('   Warning: Could not set initial cursor position from first laser point (missing or invalid).', 'WARN');
                                }
                                // <<< END NEW SECTION >>>

                                if (window.DrawingTools?.startLaserTrail) {
                                    window.DrawingTools.startLaserTrail();
                                } else { logMessage('startLaserTrail not found', 'ERROR'); }
                                break;
                            case 'bounding_box':
                                logMessage(`Replay V2: Bounding Box event started (ID: ${event.event_id}, Mode: ${event.mode}) at ${event.replay_time.toFixed(0)}ms`, 'DEBUG');
                                activeBBoxPoints = event.intermediate_coords || [];
                                currentBBoxPointIndex = 0;
                                activeBBoxEventDetails = event;
                                if (activeBBoxPoints.length > 0) {
                                    const firstCoord = activeBBoxPoints[0];
                                    if (window.DrawingTools?.startReplayBoundingBox) {
                                        window.DrawingTools.startReplayBoundingBox(firstCoord.left, firstCoord.top, event.mode);
                                        // Set initial cursor position based on the start
                                        lastCursorPos = { x: firstCoord.left, y: firstCoord.top };
                                        cursorNeedsUpdateFromEvent = true;
                                    } else { logMessage('startReplayBoundingBox not found', 'ERROR'); }
                                } else if (event.final_coords) {
                                    // Handle case where only final coords exist
                                     if (window.DrawingTools?.startReplayBoundingBox && window.DrawingTools?.updateReplayBoundingBox) {
                                         window.DrawingTools.startReplayBoundingBox(event.final_coords.left, event.final_coords.top, event.mode);
                                         window.DrawingTools.updateReplayBoundingBox(event.final_coords, event.mode);
                                         lastCursorPos = { x: event.final_coords.left, y: event.final_coords.top };
                                         cursorNeedsUpdateFromEvent = true;
                                     } else { logMessage('Bounding box replay functions not found!', 'ERROR'); }
                                }
                                // <<< ADD: Hide cursor during BBox manipulation >>>
                                if (window.DrawingTools?.hideReplayCursor) {
                                    logMessage('   Hiding replay cursor during bounding box event.', 'DEBUG');
                                    window.DrawingTools.hideReplayCursor(false);
                                }
                                // <<< END ADDITION >>>
                                break;
                            // <<< ADDED CASE for audio_recording >>>
                            case 'audio_recording':
                                // This event type marks audio start/stop points in the timeline.
                                // Audio playback itself is handled by the <audio> element.
                                // We just acknowledge the event here to avoid the 'Unknown category' warning.
                                const action = (event.end_time_offset === null) ? 'start' : 'stop';
                                logMessage(`Replay V2: Acknowledging audio_recording ${action} event at ${event.replay_time.toFixed(0)}ms`, 'TRACE');
                                break;
                            // <<< END ADDED CASE >>>
                            default:
                                logMessage(`Replay V2: Unknown event category: ${event.category}`, 'WARN');
                        }
                         // Update main cursor pos tracker if this event specifically sets it
                         if (cursorNeedsUpdateFromEvent) {
                             cursorNeedsUpdate = true;
                         }
                    } catch (handlerError) {
                         logMessage(`Replay V2: Error handling event ${event.event_id} (${event.category}): ${handlerError.message}`, 'ERROR');
                         console.error(handlerError);
                    }
                });
            }

            // --- Handle ongoing Laser Pointer Points --- //
            let processedLaserPointThisFrame = false;
            // Refactored Loop: Process all points ready in this frame
            while (activeLaserEventDetails && currentLaserPointIndex < activeLaserPoints.length && activeLaserPoints[currentLaserPointIndex].timeOffset <= elapsedMs) {
                const point = activeLaserPoints[currentLaserPointIndex];

                // Ensure point data is valid before checking time
                if (!point || typeof point.timeOffset !== 'number') {
                    logMessage(`Skipping invalid point data structure at index ${currentLaserPointIndex}`, 'WARN');
                    currentLaserPointIndex++; // Move past the invalid point
                    continue; // Go to the next iteration of the while loop
                }

                // Check if this point's time is ready
                if (point.timeOffset <= elapsedMs) {
                    // Process the point
                    // console.log(`  Processing point ${currentLaserPointIndex}: TimeOffset=${point?.timeOffset?.toFixed(0)}ms, Pos=(${point?.x?.toFixed(0)}, ${point?.y?.toFixed(0)})`);
                    if (typeof point.x === 'number' && typeof point.y === 'number') {
                        if (window.DrawingTools?.addToLaserTrail) {
                            // *** CONVERT PIXEL TO CANVAS for drawing ***
                            const canvasCoords = getCanvasCoordinatesFromPixelPoint({x: point.x, y: point.y});
                            if (canvasCoords) {
                                console.log(`    Calling addToLaserTrail (Point ${currentLaserPointIndex}) Pixel(${point.x.toFixed(0)}, ${point.y.toFixed(0)}) -> Canvas(${canvasCoords.x.toFixed(0)}, ${canvasCoords.y.toFixed(0)}) at elapsed ${elapsedMs.toFixed(0)}ms`);
                                window.DrawingTools.addToLaserTrail(canvasCoords.x, canvasCoords.y);
                                lastCursorPos = { x: canvasCoords.x, y: canvasCoords.y }; // Update cursor position with CANVAS coords

                            } else {
                                 logMessage(`Failed to convert laser point ${currentLaserPointIndex} to canvas coordinates. Skipping.`, 'WARN');
                            }

                            cursorNeedsUpdate = true;
                            processedLaserPointThisFrame = true;
                        } else {
                            logMessage('addToLaserTrail function not found', 'ERROR');
                            activeLaserEventDetails = null; // Stop trying if function is missing
                            break; // Exit while loop
                        }
                    } else {
                        logMessage(`Skipping invalid point coordinates at index ${currentLaserPointIndex}`, 'WARN');
                    }
                    currentLaserPointIndex++; // Move to the next point for the next iteration
            } else {
                    // This point is in the future, break out of the loop for this frame
                    // console.log(`DEBUG: Point ${currentLaserPointIndex} (${point.timeOffset.toFixed(0)}ms) is in the future (Elapsed: ${elapsedMs.toFixed(0)}ms). Breaking inner loop.`);
                    break;
                }
            }

            // Check if the main laser event itself has ended (outside the point processing loop)
            if (activeLaserEventDetails && elapsedMs >= (activeLaserEventDetails.end_time_offset ?? Infinity)) {
                logMessage(`Replay V2: Laser Pointer event (ID: ${activeLaserEventDetails.event_id}) finished at ${elapsedMs.toFixed(0)}ms`, 'DEBUG');
                if (window.DrawingTools?.clearLaserTrail) {
                    window.DrawingTools.clearLaserTrail(); // Clear visual trail now
                } else { logMessage('clearLaserTrail not found', 'ERROR'); }

                // <<< ADD: Hide the cursor element itself when laser ends >>>
                if (window.DrawingTools?.hideReplayCursor) {
                    logMessage('   Hiding replay cursor element as laser event ended.', 'DEBUG');
                    // Pass false to just hide, not full cleanup (might be needed later by stopReplay)
                    window.DrawingTools.hideReplayCursor(false);
                } else {
                    logMessage('   hideReplayCursor function not found.', 'ERROR');
                }
                // <<< END ADDITION >>>

                activeLaserEventDetails = null; // Mark as inactive
                activeLaserPoints = null;
                currentLaserPointIndex = 0;
            }

            // --- Handle ongoing Bounding Box Intermediate Points --- //
            let processedBBoxPointThisFrame = false;
            while (activeBBoxEventDetails && currentBBoxPointIndex < activeBBoxPoints.length && activeBBoxPoints[currentBBoxPointIndex].timeOffset <= elapsedMs) {
                const coord = activeBBoxPoints[currentBBoxPointIndex];
                if (coord && typeof coord.left === 'number' && typeof coord.top === 'number' && typeof coord.width === 'number' && typeof coord.height === 'number') {
                    if (window.DrawingTools?.updateReplayBoundingBox) {
                        // *** CONVERT PIXEL TO CANVAS for drawing ***
                        const pixelCoord = coord; // Already pixel coords
                        const startCanvas = getCanvasCoordinatesFromPixelPoint({x: pixelCoord.left, y: pixelCoord.top});
                        const endCanvas = getCanvasCoordinatesFromPixelPoint({x: pixelCoord.left + pixelCoord.width, y: pixelCoord.top + pixelCoord.height});

                        if (startCanvas && endCanvas) {
                            const canvasCoord = {
                                left: startCanvas.x,
                                top: startCanvas.y,
                                width: endCanvas.x - startCanvas.x,
                                height: endCanvas.y - startCanvas.y
                            };
                            window.DrawingTools.updateReplayBoundingBox(canvasCoord, activeBBoxEventDetails.mode);
                            processedBBoxPointThisFrame = true;
                            // Maybe update cursor to corner being dragged? For now, no cursor update based on box.
                        } else {
                             logMessage(`Skipping BBox update at index ${currentBBoxPointIndex} due to coord conversion failure.`, 'WARN');
                        }

                          processedBBoxPointThisFrame = true;
                          // Maybe update cursor to corner being dragged? For now, no cursor update based on box.
                         } else {
                        logMessage(`Skipping invalid BBox coord at index ${currentBBoxPointIndex}`, 'WARN');
                    }
                } else {
                    logMessage(`Skipping invalid BBox coord at index ${currentBBoxPointIndex}`, 'WARN');
                }
                currentBBoxPointIndex++;
            }

            // Check if the main bounding box event itself has ended
            if (activeBBoxEventDetails && elapsedMs >= (activeBBoxEventDetails.end_time_offset ?? Infinity)) {
                logMessage(`Replay V2: Bounding Box event (ID: ${activeBBoxEventDetails.event_id}) finished at ${elapsedMs.toFixed(0)}ms`, 'DEBUG');
                const finalPixelCoords = activeBBoxEventDetails.final_coords;
                if (finalPixelCoords && window.DrawingTools?.updateReplayBoundingBox) {
                    // *** CONVERT PIXEL TO CANVAS for drawing ***
                    const startCanvas = getCanvasCoordinatesFromPixelPoint({x: finalPixelCoords.left, y: finalPixelCoords.top});
                    const endCanvas = getCanvasCoordinatesFromPixelPoint({x: finalPixelCoords.left + finalPixelCoords.width, y: finalPixelCoords.top + finalPixelCoords.height});
                    if (startCanvas && endCanvas) {
                        const finalCanvasCoords = {
                            left: startCanvas.x,
                            top: startCanvas.y,
                            width: endCanvas.x - startCanvas.x,
                            height: endCanvas.y - startCanvas.y
                        };
                        window.DrawingTools.updateReplayBoundingBox(finalCanvasCoords, activeBBoxEventDetails.mode);
                        logMessage(`Applied final bounding box coords (Canvas): ${JSON.stringify(finalCanvasCoords)}`, 'TRACE');
                    } else {
                         logMessage('Failed to convert final BBox coords to canvas space for final update.', 'ERROR');
                    }

                      logMessage(`Applied final bounding box coords: ${JSON.stringify(finalPixelCoords)}`, 'TRACE');
                } else if (!finalPixelCoords && window.DrawingTools?.removeReplayBoundingBox) {
                      window.DrawingTools.removeReplayBoundingBox();
                      logMessage(`Removed invalid final bounding box (ID: ${activeBBoxEventDetails.event_id})`, 'DEBUG');
                } else if (finalPixelCoords && !window.DrawingTools?.updateReplayBoundingBox) {
                      logMessage('updateReplayBoundingBox not found for final coords!', 'ERROR');
                } else if (!finalPixelCoords && !window.DrawingTools?.removeReplayBoundingBox) {
                      logMessage('removeReplayBoundingBox not found for invalid final box!', 'ERROR');
                  }

                // <<< ADD: Show cursor again after BBox manipulation ends >>>
                const cursor = document.getElementById('replay-cursor');
                 if (cursor) {
                     // Ensure cursor position is updated to the final box position
                     if (finalPixelCoords) {
                         // Convert start corner to CANVAS coords for cursor positioning
                         const startCanvas = getCanvasCoordinatesFromPixelPoint({x: finalPixelCoords.left, y: finalPixelCoords.top});
                         if (startCanvas) {
                          // Update state first
                          lastCursorPos = { x: startCanvas.x, y: startCanvas.y }; // Use CANVAS coords
                          logMessage(`   About to apply styles: X=${lastCursorPos.x.toFixed(0)}, Y=${lastCursorPos.y.toFixed(0)}`, 'TRACE');
                          // Apply position styles *before* making it visible
                          cursor.style.left = `${lastCursorPos.x}px`;
                          cursor.style.top = `${lastCursorPos.y}px`;
                          cursor.style.display = 'block'; // Make visible at the correct position
                          logMessage(`   Styles applied: left=${cursor.style.left}, top=${cursor.style.top}, display=${cursor.style.display}`, 'TRACE');
                          logMessage(`   Showing replay cursor at final BBox pos (${lastCursorPos.x.toFixed(0)}, ${lastCursorPos.y.toFixed(0)})`, 'DEBUG');
                         } else {
                             logMessage('Failed to convert final BBox coords to canvas space for final update.', 'ERROR');
                         }
                     } else {
                         // Keep cursor hidden if the event ended badly
                         logMessage('   Keeping replay cursor hidden as BBox event ended with invalid finalCoords.', 'WARN');
                         cursor.style.display = 'none';
                     }
                 } else {
                     logMessage('   Could not find replay cursor element to show/hide after BBox event.', 'WARN');
                 }
                 // <<< END ADDITION >>>

                activeBBoxEventDetails = null; // Mark as inactive
                activeBBoxPoints = null;
                currentBBoxPointIndex = 0;
            }

            // --- Update Cursor Position --- //
            if (cursorNeedsUpdate) {
                replayCursor.style.left = `${lastCursorPos.x}px`;
                replayCursor.style.top = `${lastCursorPos.y}px`;
                updateCoordinatesDisplay(Math.round(lastCursorPos.x), Math.round(lastCursorPos.y));
            }

            // --- Check for Replay End --- //
            if (currentEventIndex >= allEvents.length && !activeLaserEventDetails && !activeBBoxEventDetails /* Add other active event checks here */) {
                if (!audioElement || audioElement.ended) {
                        isReplaying = false;
                    logMessage('Replay V2: Completed (all events processed)', 'INFO');
                    window.stopReplay(); // Use stop function for proper cleanup
                    return; // End the loop
                }
            }

            // Request next frame
            animationFrameId = requestAnimationFrame(replayLoop);
        }

    } catch (error) {
        console.error('Replay V2: Error during replay setup or execution:', error);
        logMessage('Replay V2: Error - ' + error.message, 'ERROR');
        resetReplayButton();
        removeReplayControls();
        if (window.DrawingTools) window.DrawingTools.hideReplayCursor(true);
        console.log('DEBUG: Checking window.DrawingTools right before stopReplay cleanup:', window.DrawingTools); // <<< ADDED LOG
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        console.log('DEBUG: Keys on window.DrawingTools before stopReplay error handler cleanup:', Object.keys(window.DrawingTools || {})); // <<< ADDED LOG
        window.DrawingTools.hideReplayCursor(true);
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
async function prepareEmailData(emailAddress, senderName, notification) {
    // Add visual feedback to the email button
    const emailBtn = document.getElementById('email-btn');
    if (emailBtn) {
        emailBtn.classList.add('btn-processing');
        emailBtn.disabled = true;
    }
    
    logMessage('Email button clicked - preparing V2 JSON data...', 'INFO');
    
    // --- V2 Data Preparation --- //
    try {
        if (!window.audioBlob && Object.values(window.recordedEvents || {}).every(arr => !Array.isArray(arr) || arr.length === 0)) {
            logMessage('No annotation data available to prepare for email.', 'WARN');
            alert('No annotation data recorded yet.');
            resetEmailButton();
            if (notification && notification.parentNode) notification.parentNode.removeChild(notification);
            return;
        }

        // Get necessary metadata (similar to saveAnnotationData)
        const totalDuration = getCurrentRecordingTime();
        const recordingTimestamp = recordingStartTime ? new Date(recordingStartTime).toISOString() : new Date().toISOString();
        const imageInfo = {
            url: document.getElementById('url-image')?.value || null,
            width: window.canvas?.width || null,
            height: window.canvas?.height || null
        };

        // Convert audio blob to Base64
        let audioBlobBase64 = null;
        if (window.audioBlob) {
            try {
                audioBlobBase64 = await blobToBase64(window.audioBlob);
                logMessage('Audio blob successfully converted to Base64 for email data', 'DEBUG');
            } catch (error) {
                console.error('Error converting audio blob to Base64 for email:', error);
                logMessage('Error converting audio blob for email. Proceeding without audio.', 'WARN');
            }
        } else {
            logMessage('No audio blob found for email data.', 'INFO');
        }

        // Structure the V2 JSON data
        const annotationDataV2 = {
            Events: window.recordedEvents || {},
            version: "2.0",
            recordingStartTime: recordingTimestamp,
            totalDuration: totalDuration,
            imageInfo: imageInfo,
            audioBlobBase64: audioBlobBase64
        };

        // Stringify the V2 data
        const jsonData = JSON.stringify(annotationDataV2, null, 2);

        logMessage(`V2 JSON data prepared (${jsonData.length} characters)`, 'INFO');

        // Remove the initial notification
                if (notification && notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                
        // Show the dialog with the V2 JSON data
        showEmailDataDialog(jsonData); // Pass only the JSON data string
                
        // Reset UI elements (dialog handles its own closing)
                resetEmailButton();
                
    } catch (error) {
        console.error('Error preparing V2 JSON data:', error);
        logMessage('Error preparing V2 JSON data: ' + error.message, 'ERROR');
        alert('An error occurred while preparing the annotation data. See console for details.');
                resetEmailButton();
                if (notification && notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }
}

/**
 * Display a dialog with email data and copy options
 * @param {string} jsonData - The V2 annotation data as a JSON string
 */
function showEmailDataDialog(jsonData) {
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal fade';
    modalContainer.id = 'emailDataModal'; // Keep same ID for bootstrap
    modalContainer.tabIndex = -1;
    modalContainer.setAttribute('role', 'dialog');
    modalContainer.setAttribute('aria-labelledby', 'emailDataModalLabel');
    modalContainer.setAttribute('aria-hidden', 'true');
    
    // Create modal structure (updated for JSON)
    modalContainer.innerHTML = `
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="emailDataModalLabel">Annotation JSON Data Ready</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="alert alert-info mb-3">
                    <h6>Your annotation JSON data is ready!</h6>
                    <p>Choose an option to save or copy the data:</p>
                </div>
                
                <div class="row gy-3"> <!-- Use gy-3 for vertical spacing -->
                    <div class="col-12"> <!-- Full width column -->
                        <div class="card">
                            <div class="card-header bg-primary text-white">
                                <h6 class="mb-0">Option 1: Save as JSON File</h6>
                            </div>
                            <div class="card-body">
                                <p>Save the complete annotation data as a standard <code>.json</code> file. (Recommended)</p>
                                <button id="saveJsonDataBtn" class="btn btn-primary">Save JSON File</button>
                            </div>
                        </div>
                    </div>
                    <div class="col-12"> <!-- Full width column -->
                        <div class="card">
                            <div class="card-header bg-success text-white">
                                <h6 class="mb-0">Option 2: Copy JSON to Clipboard</h6>
                            </div>
                            <div class="card-body">
                                <p>Copy the complete JSON data string to your clipboard.</p>
                                <button id="copyJsonBtn" class="btn btn-success">Copy JSON Data</button>
                            </div>
                        </div>
                    </div>
                    <div class="col-12"> <!-- Full width column for Option 3 -->
                        <div class="card">
                            <div class="card-header bg-secondary text-white">
                                <h6 class="mb-0">Option 3: Save as Encoded Text File</h6>
                            </div>
                            <div class="card-body">
                                <p>Save the data encoded in Base64 within a <code>.txt</code> file, including header/footer markers.</p>
                                <button id="saveEncodedTxtBtn" class="btn btn-secondary">Save Encoded TXT File</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mb-3">
                    <label for="jsonPreview" class="form-label">JSON Data Preview (first 500 characters):</label>
                    <textarea id="jsonPreview" class="form-control font-monospace" rows="8" readonly></textarea>
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
    const previewLength = 500; // Show more for JSON
    const jsonPreviewText = jsonData.length > previewLength ? 
        jsonData.substring(0, previewLength) + '...\n(Full data too long for preview)' : jsonData;
    
    // Wait for the modal to be fully added to DOM
        setTimeout(() => {
        // Get references to elements
        const previewTextarea = document.getElementById('jsonPreview');
        const saveButton = document.getElementById('saveJsonDataBtn');
        const copyButton = document.getElementById('copyJsonBtn');
        const saveEncodedButton = document.getElementById('saveEncodedTxtBtn'); // Get new button
        const modalElement = document.getElementById('emailDataModal');
        let modalInstance = null;
        if (modalElement && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
             modalInstance = bootstrap.Modal.getInstance(modalElement); // Get instance later
             if (!modalInstance) {
                  // Create instance if it doesn't exist when needed
             }
        }
        
        // Set preview text
        if (previewTextarea) {
            previewTextarea.value = jsonPreviewText;
        }
        
        // Add save button handler (save as JSON)
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                const blob = new Blob([jsonData], { type: 'application/json' });
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const filename = `annotation-data-${timestamp}.json`;
                try {
                    saveAs(blob, filename);
                    logMessage(`Annotation JSON data saved as ${filename}`, 'INFO');
                    // Auto-close on success
                    if (!modalInstance) modalInstance = bootstrap.Modal.getInstance(modalElement);
                    if(modalInstance) modalInstance.hide(); 
                } catch (error) {
                     console.error('Error using saveAs for JSON:', error);
                     logMessage('Error saving JSON file. Ensure FileSaver.js is included.', 'ERROR');
                     alert('Could not save JSON file automatically. Ensure FileSaver.js is loaded.');
                }
            });
        }
        
        // Add copy button handler (copy JSON string)
        if (copyButton) {
            copyButton.addEventListener('click', async () => { // Make async for await
                 try {
                     await copyToClipboard(jsonData); // Assume copyToClipboard is adapted to return promise
                    // Auto-close on success
                     if (!modalInstance) modalInstance = bootstrap.Modal.getInstance(modalElement);
                     if(modalInstance) modalInstance.hide();
                 } catch (err) {
                     // Error already handled in copyToClipboard (alert)
                 }
            });
        }

        // Add save encoded text button handler
        if (saveEncodedButton) {
            saveEncodedButton.addEventListener('click', () => {
                try {
                    const base64Data = btoa(jsonData); // Encode JSON to Base64
                    const header = "Annotation data starts here ----->\n";
                    const footer = "\n<----- Annotation data ends here";
                    const fullTextContent = header + base64Data + footer;

                    const blob = new Blob([fullTextContent], { type: 'text/plain' });
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    const filename = `annotation-encoded-${timestamp}.txt`;

                    saveAs(blob, filename);
                    logMessage(`Annotation data saved as encoded TXT: ${filename}`, 'INFO');
                    // Auto-close on success
                     if (!modalInstance) modalInstance = bootstrap.Modal.getInstance(modalElement);
                     if(modalInstance) modalInstance.hide();
                } catch (error) {
                    console.error('Error encoding/saving Base64 TXT:', error);
                    logMessage('Error encoding/saving Base64 TXT: ' + error.message, 'ERROR');
                    alert('Could not save encoded TXT file. See console for details.');
                }
            });
        }
        
        // Show the modal
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            if (modalElement && !modalInstance) { // Create instance only if needed
                 modalInstance = new bootstrap.Modal(modalElement);
                 modalInstance.show();
                 logMessage('JSON data ready - showing options dialog', 'INFO');
            } else if (modalInstance) {
                 modalInstance.show(); // Show if already exists
                 logMessage('JSON data ready - showing options dialog', 'INFO');
            } else {
                logMessage('Modal element #emailDataModal not found', 'ERROR');
            }
        } else {
             logMessage('Bootstrap Modal component not found.', 'ERROR');
             alert('Could not display the data dialog. Bootstrap might not be loaded correctly.');
        }
        
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
        logMessage('Laser trail container cleared.', 'TRACE'); // More specific log
    } else {
        // It's okay if the container doesn't exist (e.g., before first use or after cleanup)
        logMessage('Laser trail container not found for clearing (this is often expected).', 'DEBUG'); // Downgraded from WARN
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
        if (window.recordedEvents.audio_recording.length === 0) {
            logMessage('No mouse data to save for debugging', 'WARN');
            return;
        }
        
        // Get current timestamp for filename
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const filename = `mouse-data-debug-${timestamp}.json`;
        
        // Create diagnostics report
        const diagnostics = generateMouseDataDiagnostics(window.recordedEvents.audio_recording);
        
        // Create debug object with diagnostics and raw data
        const debugData = {
            metadata: {
                timestamp: timestamp,
                diagnostics: diagnostics
            },
            mouseData: window.recordedEvents.audio_recording
        };
        
        // Convert to JSON and save
        const jsonString = JSON.stringify(debugData, null, 2);
        const jsonBlob = new Blob([jsonString], { type: 'application/json' });
        
        // Download the file
        downloadFile(jsonBlob, filename);
        
        logMessage(`Mouse data saved for debugging to ${filename}`, 'INFO');
        logMessage(`File contains ${window.recordedEvents.audio_recording.length} mouse data points`, 'INFO');
        
        return true;
    } catch (error) {
        console.error('Error saving debug mouse data:', error);
        logMessage('Error saving debug data: ' + error.message, 'ERROR');
        return false;
    }
} 

// Export functions for use in other modules - No longer exporting drawing tool functions
// window.startCaptureMouseData = startCaptureMouseData; // REMOVED
// window.stopCaptureMouseData = stopCaptureMouseData; // REMOVED
window.saveMouseDataForDebug = saveMouseDataForDebug; 

// *** NEW FUNCTION: Record Initial State ***
/**
 * Records the initial state of the application when recording starts.
 */
function recordInitialState() {
    if (!isRecording) { // Should ideally be called right before isRecording is set true
        const initialStateEvent = {
            event_id: `init_${Date.now()}`,
            time_offset: 0, // Occurs exactly at the start
            // Image Info (assuming canvas is loaded)
            image_url: document.getElementById('url-image')?.value || null,
            // TODO: Get actual image dimensions from canvas/image object if available
            image_width: window.canvas?.width || null, 
            image_height: window.canvas?.height || null,
            // Adjustments
            brightness: parseInt(document.getElementById('brightness')?.value || '0'),
            contrast: parseInt(document.getElementById('contrast')?.value || '0'),
            cursor_size: parseInt(document.getElementById('cursor-size')?.value || DEFAULT_CURSOR_SIZE.toString()),
            // --- NEW: Record Zoom State ---
            zoom_state: window.currentZoomState || 'natural' // Get state from app.js
        };
        window.recordedEvents.initial_state.push(initialStateEvent);
        logMessage(`Initial state recorded: ${JSON.stringify(initialStateEvent)}`, 'DEBUG');
    } else {
        logMessage('Warning: Attempted to record initial state while already recording.', 'WARN');
    }
}

// *** NEW FUNCTION: Record Audio Event ***
/**
 * Records the start or stop of the audio recording itself.
 */
function recordAudioEvent(type) {
    const now = Date.now();
    const timeOffset = getCurrentRecordingTime();

    if (type === 'start') {
        const audioStartEvent = {
            event_id: `audio_rec_${now}`,
            start_time_offset: timeOffset, // Should be very close to 0
            end_time_offset: null,
            duration_ms: null
        };
        window.recordedEvents.audio_recording.push(audioStartEvent);
        logMessage(`Audio recording start event recorded at offset ${timeOffset}ms`, 'DEBUG');
    } else if (type === 'stop') {
        // Find the latest audio recording event without an end time
        const lastAudioEvent = window.recordedEvents.audio_recording
            .filter(event => event.end_time_offset === null)
            .pop();

        if (lastAudioEvent) {
            lastAudioEvent.end_time_offset = timeOffset;
            lastAudioEvent.duration_ms = lastAudioEvent.end_time_offset - lastAudioEvent.start_time_offset;
            logMessage(`Audio recording stop event recorded at offset ${timeOffset}ms. Duration: ${lastAudioEvent.duration_ms}ms`, 'DEBUG');
        } else {
            logMessage('Warning: Could not find active audio recording event to stop.', 'WARN');
        }
    }
}

// --- NEW: Helper for Save File Picker API ---
/**
 * Saves a file using the File System Access API (showSaveFilePicker).
 * Provides a native "Save As" dialog.
 * @param {string} suggestedName - The default filename to suggest to the user.
 * @param {Blob} blob - The data blob to save.
 * @returns {Promise<boolean>} True if saved successfully, false otherwise (including cancellation).
 */
async function saveFileWithDialog(suggestedName, blob) {
    try {
        const options = {
            suggestedName: suggestedName,
            types: [{
                description: 'JSON Annotation Data',
                accept: { 'application/json': ['.json'] },
            }],
        };
        // Request a file handle.
        const handle = await window.showSaveFilePicker(options);
        // Create a FileSystemWritableFileStream to write to.
        const writable = await handle.createWritable();
        // Write the blob data to the stream.
        await writable.write(blob);
        // Close the file and write the contents to disk.
        await writable.close();
        logMessage(`File saved successfully via Save Dialog: ${handle.name}`, 'INFO');
        return true;
    } catch (err) {
        if (err.name === 'AbortError') {
            // User cancelled the save dialog
            logMessage('File save dialog cancelled by user.', 'INFO');
        } else {
            // Other errors (browser support, permissions, etc.)
            console.error('Error using showSaveFilePicker:', err);
            logMessage(`Error saving file via dialog: ${err.message}`, 'ERROR');
            // Optionally, alert the user about the error if it's not cancellation
            alert(`Failed to save file: ${err.message}. Ensure your browser supports the File System Access API and permissions are granted.`);
        }
        return false;
    }
}
// --- END NEW HELPER ---

// *** NEW FUNCTION: Format Relative Time ***
/**
 * Formats the time difference between an event and the current recording time.
 * @param {number} eventTimeMs - The time offset of the event in milliseconds.
 * @param {number} currentTimeMs - The current recording time in milliseconds.
 * @returns {string} - A human-readable relative time string (e.g., "Now", "5s ago", "2m ago").
 */
function formatRelativeTime(eventTimeMs, currentTimeMs) {
    const diffSeconds = Math.round((currentTimeMs - eventTimeMs) / 1000);

    if (diffSeconds < 2) {
        return "Now";
    } else if (diffSeconds < 60) {
        // <<< CHANGED: Add "about" >>>
        return `about ${diffSeconds}s ago`; 
    } else { // >= 60 seconds
        const diffMinutes = Math.floor(diffSeconds / 60);
        return `${diffMinutes}m ago`;
    }
}

// *** NEW FUNCTION: Update Event Viewer ***
/**
 * Updates the event viewer UL list with the latest drawing events.
 */
function updateEventViewer() {
   const listElement = document.getElementById('event-viewer-list');
   if (!listElement) {
       logMessage('Event viewer list element (#event-viewer-list) not found.', 'ERROR');
       return;
   }

   const recordedEvents = window.recordedEvents || {};
   const drawingCategories = ['laser_pointer', 'bounding_box']; // Add other drawing event keys here
   let allDrawingEvents = [];

   // 1. Gather events
   drawingCategories.forEach(category => {
       if (Array.isArray(recordedEvents[category])) {
           recordedEvents[category].forEach(event => {
               if (event && event.event_id && (event.start_time_offset !== undefined || event.time_offset !== undefined)) {
                   event.category = category;
                   event.sort_time = event.start_time_offset ?? event.time_offset;
                   allDrawingEvents.push(event);
               } else {
                   logMessage(`Event viewer skipped invalid event in ${category}: Missing ID or time.`, 'WARN');
               }
           });
       }
   });

   // 2. Sort OLD->NEW for numbering
   allDrawingEvents.sort((a, b) => a.sort_time - b.sort_time);

   // 3. Assign tool numbers
   const toolCounters = {};
   allDrawingEvents.forEach(event => {
       const category = event.category;
       if (drawingCategories.includes(category)) {
           if (!toolCounters[category]) toolCounters[category] = 0;
           toolCounters[category]++;
           event.tool_number = toolCounters[category];
       }
   });

   // 4. Sort NEW->OLD for display
   allDrawingEvents.sort((a, b) => b.sort_time - a.sort_time);

   // 5. Build List Items
   listElement.innerHTML = ''; // Clear previous items
   const currentRecTime = isRecording ? getCurrentRecordingTime() : (allDrawingEvents[0]?.sort_time ?? 0);

   if (allDrawingEvents.length === 0) {
       const placeholder = document.createElement('li');
       placeholder.className = 'list-group-item disabled text-muted small py-1 px-2';
       placeholder.textContent = 'No drawing events recorded yet...';
       listElement.appendChild(placeholder);
   } else {
       allDrawingEvents.forEach(event => {
           const listItem = document.createElement('li');
           listItem.className = 'list-group-item list-group-item-action py-1 px-2 small';
           listItem.dataset.eventId = event.event_id;

           // Formatting (same as before)
           let eventType = event.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()); // Basic title case
           const relativeTime = formatRelativeTime(event.sort_time, currentRecTime);
           const toolNumber = event.tool_number || '';
           const typePadding = 18;
           const formattedType = eventType.padEnd(typePadding - String(toolNumber).length - 1);
           const formattedTime = relativeTime.padStart(10);
           listItem.textContent = `${formattedType} ${toolNumber}${' '.repeat(5)}${formattedTime}`;

           // Add click listener for selection
           listItem.addEventListener('click', (e) => {
               e.preventDefault();
               const clickedId = listItem.dataset.eventId;

               // If already selected, deselect (optional behavior)
               // if (window.selectedEventId === clickedId) {
               //     window.selectedEventId = null;
               //     listItem.classList.remove('active');
               // } else {

               // Remove active class from all items
               Array.from(listElement.children).forEach(child => child.classList.remove('active'));
               // Add active class to clicked item
               listItem.classList.add('active');
               // Store selected ID
               window.selectedEventId = clickedId;
               logMessage(`Event selected: ${clickedId}`, 'DEBUG');
               // }

               // Update button states based on selection
               if (typeof window.updateButtonStates === 'function') {
                   window.updateButtonStates();
               } else {
                   logMessage('window.updateButtonStates not found when updating selection', 'ERROR');
               }
           });

           // Re-apply active class if this event was previously selected
           if (event.event_id === window.selectedEventId) {
               listItem.classList.add('active');
           }

           listElement.appendChild(listItem);
       });
   }

   // Scroll to bottom (optional, might be annoying)
   // listElement.scrollTop = listElement.scrollHeight;
}

// *** NEW FUNCTION: Delete Last Drawing Event ***
/**
 * Deletes the most recent drawing event from the recordedEvents structure.
 */
function deleteLastDrawingEvent() {
    if (!window.recordedEvents) {
        logMessage('No recorded events to delete from.', 'WARN');
        return;
    }

    const drawingCategories = ['laser_pointer', 'bounding_box']; // Must match categories checked in updateEventViewer
    let lastEvent = null;
    let lastEventCategory = null;
    let lastEventTimestamp = -1;

    // Find the chronologically latest event across relevant categories
    drawingCategories.forEach(category => {
        const events = window.recordedEvents[category];
        if (Array.isArray(events) && events.length > 0) {
            const categoryLastEvent = events[events.length - 1];
            const eventTimestamp = categoryLastEvent.start_time_offset ?? categoryLastEvent.time_offset;
            if (eventTimestamp !== undefined && eventTimestamp > lastEventTimestamp) {
                lastEventTimestamp = eventTimestamp;
                lastEvent = categoryLastEvent;
                lastEventCategory = category;
            }
        }
    });

    // If we found an event to delete
    if (lastEvent && lastEventCategory) {
        const eventArray = window.recordedEvents[lastEventCategory];
        const indexToRemove = eventArray.findIndex(event => event === lastEvent); // Find by object reference

        if (indexToRemove !== -1) {
            eventArray.splice(indexToRemove, 1);
            logMessage(`Deleted last event (Type: ${lastEventCategory}, Timestamp: ${lastEventTimestamp})`, 'INFO');
            updateEventViewer(); // Refresh the viewer
        } else {
            logMessage('Could not find the identified last event in its array for deletion.', 'ERROR');
        }
    } else {
        logMessage('No drawing events found to delete.', 'INFO');
    }
}

// --- Expose functions needed by UI listeners --- 
window.updateEventViewer = updateEventViewer; 
window.deleteLastDrawingEvent = deleteLastDrawingEvent;

// *** NEW FUNCTION: Replay Selected Event Segment ***
/**
 * Replays the audio and visual drawing for the currently selected event.
 */
async function replaySelectedEventSegment() {
   logMessage('SegmentReplay: Starting replay for selected event...', 'INFO');
   const replayButton = document.getElementById('play-selected-audio-btn');
   const originalButtonText = replayButton ? replayButton.innerHTML : 'Replay Event';

   // Disable button during setup/playback
   if (replayButton) {
       replayButton.disabled = true;
       replayButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Preparing...';
   }

   let animationFrameId = null;
   let audioPrepResult = null;

   // --- Helper function for cleanup ---
   const cleanupReplay = (errorOccurred = false) => {
       logMessage('SegmentReplay: Cleaning up replay resources...', 'DEBUG');
       if (animationFrameId) {
           cancelAnimationFrame(animationFrameId);
           animationFrameId = null;
       }
       // Specific visual cleanup based on the event category needs to be handled here or after loop
       if (window.DrawingTools) {
           window.DrawingTools.removeReplayBoundingBox(); // Attempt cleanup regardless
           window.DrawingTools.clearLaserTrail();        // Attempt cleanup regardless
       }
       if (audioPrepResult?.audioContext && audioPrepResult.audioContext.state !== 'closed') {
           audioPrepResult.audioContext.close().catch(e => console.warn('Audio context close error on cleanup:', e));
       }
       if (replayButton) {
           replayButton.innerHTML = originalButtonText; // Reset button text
           // Re-enable button by checking current state
           if (typeof window.updateButtonStates === 'function') {
               window.updateButtonStates(); 
           } else {
               replayButton.disabled = false; // Fallback if update func missing
           }
       }
       if (errorOccurred) {
           alert('An error occurred during segment replay. Check console for details.');
       }
   };

   try {
       // 1. Prepare Audio (using refactored function from app.js)
       if (typeof window.playSelectedEventAudio !== 'function') {
           throw new Error('playSelectedEventAudio function is not available.');
       }
       audioPrepResult = await window.playSelectedEventAudio();

       if (!audioPrepResult) {
           logMessage('SegmentReplay: Audio preparation failed. Aborting replay.', 'WARN');
           cleanupReplay(false); // Cleanup UI but don't show generic error alert
           // Specific error/reason should have been logged by playSelectedEventAudio
           // An alert might already be shown by playSelectedEventAudio if appropriate
           if (!window.selectedEventId) alert('Please select an event first.');
           else if (!window.audioBlob) alert('No recorded audio available.');
           // Add other specific alerts if needed based on why audioPrepResult is null
           return;
       }

       const { sourceNode, audioContext, segmentDuration } = audioPrepResult;
       const durationMs = segmentDuration * 1000;

       // 2. Find Event Data (again, needed for visual part)
       let selectedEvent = null;
       const categoriesToSearch = Object.keys(window.recordedEvents || {});
       for (const category of categoriesToSearch) {
           if (Array.isArray(window.recordedEvents[category])) {
               selectedEvent = window.recordedEvents[category].find(e => e.event_id === window.selectedEventId);
               if (selectedEvent) break;
           }
       }
       if (!selectedEvent) throw new Error('Could not find selected event data for visual replay.'); // Should not happen if audio prep succeeded
       const startTimeMs = selectedEvent.start_time_offset;

       // 3. Setup Audio Playback End Handler (for cleanup)
       sourceNode.onended = () => {
           logMessage('SegmentReplay: Audio playback finished.', 'INFO');
           cleanupReplay(); // Perform cleanup when audio naturally ends
       };

       // 4. Start Visual Replay Loop (conditionally)
       logMessage(`SegmentReplay: Starting visual replay for category: ${selectedEvent.category}`, 'DEBUG');
       const visualStartTime = Date.now(); // Timestamp when visuals *actually* start

       const animateVisuals = () => {
           const elapsedSegmentMs = Date.now() - visualStartTime;

           // Stop condition
           if (elapsedSegmentMs >= durationMs) {
               logMessage('SegmentReplay: Visual animation loop finished based on duration.', 'DEBUG');
               // Don't call full cleanup here, let audio onended handle it
               // But DO clear the specific visual elements immediately
               if (window.DrawingTools) {
                   if (selectedEvent.category === 'bounding_box') window.DrawingTools.removeReplayBoundingBox();
                   if (selectedEvent.category === 'laser_pointer') window.DrawingTools.clearLaserTrail();
               }
               animationFrameId = null;
               return;
           }

           // Category-specific drawing updates
           try {
               if (selectedEvent.category === 'bounding_box') {
                   const intermediateCoords = selectedEvent.intermediate_coords || [];
                   let lastCoordToDraw = null;
                   for (const coord of intermediateCoords) {
                       if (coord.timeOffset === undefined) continue; // Skip invalid
                       if ((coord.timeOffset - startTimeMs) <= elapsedSegmentMs) {
                           lastCoordToDraw = coord;
                       } else {
                           break; // Points are sorted by time
                       }
                   }
                   if (lastCoordToDraw && window.DrawingTools?.updateReplayBoundingBox) {
                        // Convert pixel coords if necessary - Assuming updateReplayBoundingBox takes canvas coords
                        const canvasCoord = getCanvasCoordinatesFromPixelRect(lastCoordToDraw); 
                        if (canvasCoord) {
                           window.DrawingTools.updateReplayBoundingBox(canvasCoord, selectedEvent.mode);
                        } else {
                           logMessage('SegmentReplay: Failed to convert BBox coord to canvas space.', 'WARN');
                        }
                   } else if (!window.DrawingTools?.updateReplayBoundingBox) {
                       logMessage('SegmentReplay: updateReplayBoundingBox function missing.', 'ERROR');
                       throw new Error('Visual update function missing.'); // Stop loop
                   }
               } else if (selectedEvent.category === 'laser_pointer') {
                   const points = selectedEvent.points || [];
                   // Inefficient to re-iterate all points, but simpler for now
                   // Optimization: Track last drawn point index
                   let pointsDrawnThisFrame = 0;
                   for (const point of points) {
                        if (point.timeOffset === undefined) continue;
                       if ((point.timeOffset - startTimeMs) <= elapsedSegmentMs) {
                           // Check if this point was already drawn in a *previous* frame (needs state tracking)
                           // For now, redraw relevant points each frame - less efficient but works
                            if (window.DrawingTools?.addToLaserTrail) {
                                const canvasPoint = getCanvasCoordinatesFromPixelPoint(point);
                                if (canvasPoint) {
                                   window.DrawingTools.addToLaserTrail(canvasPoint.x, canvasPoint.y);
                                   pointsDrawnThisFrame++;
                                } else {
                                    logMessage('SegmentReplay: Failed to convert laser point to canvas space.', 'WARN');
                                }
                            } else {
                                logMessage('SegmentReplay: addToLaserTrail function missing.', 'ERROR');
                                throw new Error('Visual update function missing.'); // Stop loop
                            }
                       } else {
                           break; // Points are sorted
                       }
                   }
                   if (pointsDrawnThisFrame > 0 && window.DrawingTools?.drawLaserTrail) {
                        // Call draw explicitly if addToLaserTrail doesn't auto-draw
                        // window.DrawingTools.drawLaserTrail(); 
                   }
               }
           } catch (visualError) {
               logMessage(`SegmentReplay: Error during visual update: ${visualError.message}`, 'ERROR');
               console.error("Visual Replay Error:", visualError);
               cleanupReplay(true); // Stop everything on visual error
               return; 
           }

           // Request next frame
           animationFrameId = requestAnimationFrame(animateVisuals);
       };

       // Initialize visuals based on category
       if (selectedEvent.category === 'bounding_box' && window.DrawingTools?.startReplayBoundingBox) {
           const startCoords = selectedEvent.start_coords;
           if (startCoords) {
                const canvasCoord = getCanvasCoordinatesFromPixelRect(startCoords);
                if (canvasCoord) {
                   window.DrawingTools.startReplayBoundingBox(canvasCoord.left, canvasCoord.top, selectedEvent.mode);
                } else {
                     logMessage('SegmentReplay: Failed to convert BBox start coord to canvas space.', 'WARN');
                }
           } else {
               logMessage('SegmentReplay: BBox event missing start_coords.', 'WARN');
           }
       } else if (selectedEvent.category === 'laser_pointer' && window.DrawingTools?.startLaserTrail) {
           window.DrawingTools.startLaserTrail();
           // Initial point might be drawn in first frame of animateVisuals
       }

       // 5. Start Audio Playback
       logMessage('SegmentReplay: Starting audio playback...', 'DEBUG');
       sourceNode.start(0);

       // 6. Start Visual Animation Loop
       logMessage('SegmentReplay: Starting visual animation loop...', 'DEBUG');
       animationFrameId = requestAnimationFrame(animateVisuals);

       // Update button text to indicate playing
       if (replayButton) {
           replayButton.innerHTML = '<i class="bi bi-play-fill"></i> Replaying...';
       }

   } catch (error) {
       logMessage(`SegmentReplay: Error setting up segment replay: ${error.message}`, 'ERROR');
       console.error('Segment Replay Setup Error:', error);
       cleanupReplay(true); // Cleanup and show generic alert
   }
}
window.replaySelectedEventSegment = replaySelectedEventSegment;

// --- Helper for Coordinate Conversion (Example - Needs Actual Implementation based on canvas.js) ---
// These need to correctly access canvas scale/offset information from canvas.js or global scope
function getCanvasCoordinatesFromPixelPoint(pixelPoint) {
    // --- Detailed Logging Start ---
    logMessage(`CoordConvert(Point) INPUT: Pixel(${pixelPoint?.x?.toFixed(1)}, ${pixelPoint?.y?.toFixed(1)})`, 'TRACE');
    const canvas = window.canvas;
    const bgImage = canvas?.backgroundImage;
    const vt = canvas?.viewportTransform; // [scaleX, skewY, skewX, scaleY, offsetX, offsetY]

    if (!canvas || !bgImage || !vt || !pixelPoint || typeof pixelPoint.x !== 'number' || typeof pixelPoint.y !== 'number') {
       logMessage('CoordConvert(Point): Missing data for conversion.', 'WARN');
       logMessage(`  Details: canvas=${!!canvas}, bgImage=${!!bgImage}, vt=${vt}, pixelPoint=${JSON.stringify(pixelPoint)}`, 'TRACE');
       return null;
   }

    logMessage(`  Canvas VT: [${vt.map(n => n.toFixed(2)).join(', ')}]`, 'TRACE');
    logMessage(`  BG Image: scaleX=${bgImage.scaleX?.toFixed(2)}, scaleY=${bgImage.scaleY?.toFixed(2)}, left=${bgImage.left?.toFixed(1)}, top=${bgImage.top?.toFixed(1)}`, 'TRACE');

    // This is a simplified example. Actual conversion might depend on zoom/pan.
    // Assumes viewportTransform is [scaleX, 0, 0, scaleY, offsetX, offsetY]
    const scaleX = vt[0];
    const scaleY = vt[3];
    const offsetX = vt[4];
    const offsetY = vt[5];

    const imageCanvasLeft = bgImage.left * scaleX + offsetX;
    const imageCanvasTop = bgImage.top * scaleY + offsetY;
    const imageCanvasScaleX = bgImage.scaleX * scaleX;
    const imageCanvasScaleY = bgImage.scaleY * scaleY;

    const canvasX = imageCanvasLeft + pixelPoint.x * imageCanvasScaleX;
    const canvasY = imageCanvasTop + pixelPoint.y * imageCanvasScaleY;

    logMessage(`  Intermediate: imgCanvasScale=(${imageCanvasScaleX.toFixed(2)}, ${imageCanvasScaleY.toFixed(2)}), imgCanvasLeftTop=(${imageCanvasLeft.toFixed(1)}, ${imageCanvasTop.toFixed(1)})`, 'TRACE');
    logMessage(`CoordConvert(Point) OUTPUT: Canvas(${canvasX?.toFixed(1)}, ${canvasY?.toFixed(1)})`, 'DEBUG'); // Changed level to DEBUG
    // --- Detailed Logging End ---

    return { x: canvasX, y: canvasY };
}

function getCanvasCoordinatesFromPixelRect(pixelRect) {
    if (!pixelRect || typeof pixelRect.left !== 'number' || typeof pixelRect.top !== 'number' || typeof pixelRect.width !== 'number' || typeof pixelRect.height !== 'number') {
        logMessage('CoordConvert(Rect): Invalid pixelRect input.', 'WARN');
       return null;
   }

   // Convert top-left and bottom-right corners
   const topLeftCanvas = getCanvasCoordinatesFromPixelPoint({ x: pixelRect.left, y: pixelRect.top });
   const bottomRightCanvas = getCanvasCoordinatesFromPixelPoint({ x: pixelRect.left + pixelRect.width, y: pixelRect.top + pixelRect.height });

   if (!topLeftCanvas || !bottomRightCanvas) {
        logMessage('CoordConvert(Rect): Failed to convert corner points.', 'WARN');
       return null;
   }

   // Calculate canvas dimensions
   const canvasRect = {
       left: topLeftCanvas.x,
       top: topLeftCanvas.y,
       width: bottomRightCanvas.x - topLeftCanvas.x,
       height: bottomRightCanvas.y - topLeftCanvas.y
   };

    logMessage(`CoordConvert(Rect): Pixel(l:${pixelRect.left?.toFixed(1)}, t:${pixelRect.top?.toFixed(1)}, w:${pixelRect.width?.toFixed(1)}, h:${pixelRect.height?.toFixed(1)}) -> Canvas(l:${canvasRect.left?.toFixed(1)}, t:${canvasRect.top?.toFixed(1)}, w:${canvasRect.width?.toFixed(1)}, h:${canvasRect.height?.toFixed(1)})`, 'TRACE');

   return canvasRect;
}

