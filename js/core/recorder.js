/**
 * Recorder module for capturing annotation actions and audio
 * Handles both action recording and audio recording synchronization
 */

export class Recorder {
    /**
     * Creates a new Recorder
     */
    constructor() {
        this.recording = false;
        this.startTime = 0;
        this.actions = [];
        this.audioRecorder = null;
        this.audioBlob = null;
        this.audioChunks = [];
        this.onStatusChangeCallback = null;
        this.mediaStream = null;
    }
    
    /**
     * Sets a callback function to be called when recording status changes
     * @param {Function} callback - Function to call with status updates
     */
    setStatusChangeCallback(callback) {
        this.onStatusChangeCallback = callback;
    }
    
    /**
     * Starts recording actions and audio
     * @returns {Promise} A promise that resolves when recording has started
     */
    async startRecording() {
        if (this.recording) return;
        
        this.recording = true;
        this.startTime = Date.now();
        this.actions = [];
        
        try {
            await this.startAudioRecording();
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback({
                    status: 'recording',
                    time: 0
                });
            }
        } catch (err) {
            console.error('Error starting audio recording:', err);
            // Continue with action recording even if audio fails
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback({
                    status: 'recording-no-audio',
                    time: 0,
                    error: err.message
                });
            }
        }
        
        // Start the timer update interval
        this.timerInterval = setInterval(() => {
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback({
                    status: 'recording',
                    time: Date.now() - this.startTime
                });
            }
        }, 100);
    }
    
    /**
     * Stops recording and returns the recording data
     * @returns {Promise<Object>} A promise that resolves to the recording data
     */
    async stopRecording() {
        if (!this.recording) return null;
        
        this.recording = false;
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        
        // Clear the timer interval
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Stop audio recording if it was started
        try {
            await this.stopAudioRecording();
        } catch (err) {
            console.error('Error stopping audio recording:', err);
        }
        
        // Final status update
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback({
                status: 'stopped',
                time: duration
            });
        }
        
        // Return the recording data
        return {
            duration: duration,
            actions: this.actions,
            audio: this.audioBlob
        };
    }
    
    /**
     * Records a single action
     * @param {string} type - Type of action
     * @param {Object} data - Action data
     */
    recordAction(type, data) {
        if (!this.recording) return;
        
        this.actions.push({
            time: Date.now() - this.startTime,
            type: type,
            data: data
        });
    }
    
    /**
     * Starts audio recording using the Web Audio API
     * @returns {Promise} A promise that resolves when audio recording has started
     */
    async startAudioRecording() {
        // Request microphone access
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create a MediaRecorder instance
            this.audioRecorder = new MediaRecorder(this.mediaStream);
            this.audioChunks = [];
            
            // Set up event handlers
            this.audioRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            // Start recording
            this.audioRecorder.start();
            
            // Create audio visualizer for volume level
            this.setupAudioVisualizer(this.mediaStream);
            
            return Promise.resolve();
        } catch (err) {
            console.error('Error accessing microphone:', err);
            return Promise.reject(err);
        }
    }
    
    /**
     * Sets up audio visualization for volume meter
     * @param {MediaStream} stream - The audio media stream
     */
    setupAudioVisualizer(stream) {
        if (!stream) return;
        
        // Create audio context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        this.audioContext = new AudioContext();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.audioAnalyser = this.audioContext.createAnalyser();
        this.audioAnalyser.fftSize = 256;
        source.connect(this.audioAnalyser);
        
        // Set up volume meter update
        this.visualizerInterval = setInterval(() => {
            if (!this.audioAnalyser) return;
            
            const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
            this.audioAnalyser.getByteFrequencyData(dataArray);
            
            // Calculate volume level (average of frequency data)
            const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
            const volume = Math.min(100, average); // Scale to 0-100
            
            // Dispatch volume update
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback({
                    status: 'volume-update',
                    volume: volume
                });
            }
        }, 50);
    }
    
    /**
     * Stops audio recording
     * @returns {Promise} A promise that resolves when audio recording has stopped
     */
    async stopAudioRecording() {
        if (!this.audioRecorder || this.audioRecorder.state === 'inactive') {
            return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
            // Stop the visualizer interval
            if (this.visualizerInterval) {
                clearInterval(this.visualizerInterval);
                this.visualizerInterval = null;
            }
            
            // Close audio context if it exists
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close();
            }
            
            // Set up onstop handler
            this.audioRecorder.onstop = () => {
                // Create a blob from the recorded chunks
                this.audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                
                // Stop all tracks in the media stream
                if (this.mediaStream) {
                    this.mediaStream.getTracks().forEach(track => track.stop());
                    this.mediaStream = null;
                }
                
                resolve();
            };
            
            // Set up error handler
            this.audioRecorder.onerror = (event) => {
                reject(new Error(`Audio recording error: ${event.error}`));
            };
            
            // Stop the recorder
            try {
                this.audioRecorder.stop();
            } catch (err) {
                reject(err);
            }
        });
    }
    
    /**
     * Returns whether recording is currently active
     * @returns {boolean} True if recording, false otherwise
     */
    isRecording() {
        return this.recording;
    }
    
    /**
     * Gets the current recording duration in milliseconds
     * @returns {number} Current recording duration
     */
    getCurrentDuration() {
        if (!this.recording) return 0;
        return Date.now() - this.startTime;
    }
    
    /**
     * Formats a time in milliseconds to MM:SS format
     * @param {number} timeMs - Time in milliseconds
     * @returns {string} Formatted time string
     */
    static formatTime(timeMs) {
        const totalSeconds = Math.floor(timeMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
} 