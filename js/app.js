/**
 * Main application file
 * Initializes and coordinates all components
 */

import { ImageHandler } from './core/image-handler.js';
import { LaserPointer } from './tools/laser-pointer.js';
import { BoundingBoxTool } from './tools/bounding-box.js';
import { Recorder } from './core/recorder.js';
import { Player } from './core/player.js';

class App {
    /**
     * Initializes the application
     */
    constructor() {
        this.activeTool = null;
        this.boundingBoxMode = 'corners';
        
        this.initializeElements();
        this.setupImageHandler();
        this.setupAnnotationTools();
        this.setupRecordingSystem();
        this.setupEventListeners();
        
        // Process URL parameters for auto-loading images
        this.processUrlParameters();
        
        // Log initialization
        console.log('Image annotation application initialized');
    }
    
    /**
     * Initializes references to DOM elements
     */
    initializeElements() {
        // Main containers
        this.imageContainer = document.getElementById('image-container');
        this.coordinatesDisplay = document.getElementById('coordinates');
        
        // Image loading controls
        this.localImageInput = document.getElementById('local-image');
        this.urlInput = document.getElementById('url-image');
        this.loadUrlBtn = document.getElementById('load-url-btn');
        this.shareBtn = document.getElementById('share-btn');
        
        // Image adjustment controls
        this.brightnessSlider = document.getElementById('brightness');
        this.contrastSlider = document.getElementById('contrast');
        this.cursorSizeSlider = document.getElementById('cursor-size');
        this.cursorTrailToggle = document.getElementById('cursor-tail-toggle');
        this.cursorTrailStatus = document.getElementById('cursor-trail-status');
        
        // Tool selection buttons
        this.laserPointerBtn = document.getElementById('tool-laser');
        this.boundingBoxBtn = document.getElementById('tool-bounding-box');
        this.modePointerBtn = document.getElementById('mode-pointer');
        this.modeCornersBtn = document.getElementById('mode-corners');
        
        // Recording controls
        this.recordBtn = document.getElementById('record-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.recordingIndicator = document.getElementById('recording-indicator');
        this.recordingTimer = document.getElementById('recording-timer');
        this.volumeMeter = document.getElementById('volume-level');
        this.totalRecordingTime = document.getElementById('total-recording-time');
        
        // File operation controls
        this.saveBtn = document.getElementById('save-btn');
        this.emailBtn = document.getElementById('email-btn');
        this.loadBtn = document.getElementById('load-btn');
        this.loadFileInput = document.getElementById('load-file');
        this.replayBtn = document.getElementById('replay-btn');
        this.replayPauseBtn = document.getElementById('replay-pause-btn');
        this.replayStopBtn = document.getElementById('replay-stop-btn');
    }
    
    /**
     * Sets up the image handler
     */
    setupImageHandler() {
        this.imageHandler = new ImageHandler(
            this.imageContainer,
            this.coordinatesDisplay
        );
        
        // Handle image load events
        this.imageContainer.addEventListener('image-loaded', (e) => {
            console.log('Image loaded:', e.detail);
            
            // Enable cursor size control once image is loaded
            this.cursorSizeSlider.disabled = false;
        });
        
        // Handle zoom change events
        this.imageContainer.addEventListener('zoom-changed', (e) => {
            const zoomFactor = e.detail.zoomFactor;
            console.log('Zoom changed:', zoomFactor);
            
            // Update tools with new zoom factor
            if (this.laserPointer) {
                this.laserPointer.updateZoomFactor(zoomFactor);
            }
            
            if (this.boundingBoxTool) {
                this.boundingBoxTool.updateZoomFactor(zoomFactor);
            }
        });
    }
    
    /**
     * Sets up the annotation tools
     */
    setupAnnotationTools() {
        // Initialize LaserPointer
        this.laserPointer = new LaserPointer(
            this.imageContainer,
            this.imageHandler.image,
            { 
                zoomFactor: this.imageHandler.getZoomFactor(),
                pointSize: parseInt(this.cursorSizeSlider.value) || 10
            }
        );
        
        // Initialize BoundingBoxTool
        this.boundingBoxTool = new BoundingBoxTool(
            this.imageContainer,
            this.imageHandler.image,
            { 
                zoomFactor: this.imageHandler.getZoomFactor(),
                mode: this.boundingBoxMode
            }
        );
    }
    
    /**
     * Sets up the recording system
     */
    setupRecordingSystem() {
        // Initialize recorder
        this.recorder = new Recorder();
        
        // Set up recorder status callback
        this.recorder.setStatusChangeCallback((status) => {
            this.handleRecordingStatusChange(status);
        });
        
        // Initialize player
        this.player = new Player(
            this.imageHandler,
            {
                laserPointer: this.laserPointer,
                boundingBoxTool: this.boundingBoxTool
            }
        );
        
        // Set up player status callback
        this.player.setStatusChangeCallback((status) => {
            this.handlePlayerStatusChange(status);
        });
    }
    
    /**
     * Sets up event listeners
     */
    setupEventListeners() {
        // Image loading
        this.localImageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.imageHandler.loadFromFile(e.target.files[0]);
            }
        });
        
        this.loadUrlBtn.addEventListener('click', () => {
            const url = this.urlInput.value.trim();
            if (url) {
                this.imageHandler.loadFromURL(url);
            }
        });
        
        this.shareBtn.addEventListener('click', () => {
            this.createShareLink();
        });
        
        // Image adjustments
        this.brightnessSlider.addEventListener('input', (e) => {
            this.imageHandler.setBrightness(parseInt(e.target.value));
        });
        
        this.contrastSlider.addEventListener('input', (e) => {
            this.imageHandler.setContrast(parseInt(e.target.value));
        });
        
        this.cursorSizeSlider.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            if (this.laserPointer) {
                this.laserPointer.setPointSize(size);
            }
        });
        
        // Tool selection
        this.laserPointerBtn.addEventListener('click', () => {
            this.activateTool('laser-pointer');
        });
        
        this.boundingBoxBtn.addEventListener('click', () => {
            this.activateTool('bounding-box');
        });
        
        this.modePointerBtn.addEventListener('click', () => {
            this.setBoundingBoxMode('pointer');
        });
        
        this.modeCornersBtn.addEventListener('click', () => {
            this.setBoundingBoxMode('corners');
        });
        
        // Recording controls
        this.recordBtn.addEventListener('click', () => {
            this.startRecording();
        });
        
        this.stopBtn.addEventListener('click', () => {
            this.stopRecording();
        });
        
        // File operations
        this.saveBtn.addEventListener('click', () => {
            this.saveRecording();
        });
        
        this.emailBtn.addEventListener('click', () => {
            this.emailRecording();
        });
        
        this.loadBtn.addEventListener('click', () => {
            this.loadFileInput.click();
        });
        
        this.loadFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.loadRecordingFile(e.target.files[0]);
            }
        });
        
        // Playback controls
        this.replayBtn.addEventListener('click', () => {
            this.playRecording();
        });
        
        this.replayPauseBtn.addEventListener('click', () => {
            this.pausePlayback();
        });
        
        this.replayStopBtn.addEventListener('click', () => {
            this.stopPlayback();
        });
        
        // Mouse events for tools
        this.imageContainer.addEventListener('mousedown', (e) => {
            if (this.activeTool === 'bounding-box') {
                const coords = this.boundingBoxTool.startBox(e);
                if (coords && this.recorder.isRecording()) {
                    this.recorder.recordAction('bounding-box-start', {
                        coords: coords,
                        mode: this.boundingBoxMode
                    });
                }
            }
        });
        
        this.imageContainer.addEventListener('mousemove', (e) => {
            if (this.activeTool === 'laser-pointer') {
                const coords = this.laserPointer.addTrailPoint(e);
                if (coords && this.recorder.isRecording()) {
                    this.recorder.recordAction('laser-pointer', { coords: coords });
                }
            } else if (this.activeTool === 'bounding-box' && this.boundingBoxTool.isDrawing) {
                const coords = this.boundingBoxTool.updateBox(e);
                if (coords && this.recorder.isRecording()) {
                    this.recorder.recordAction('bounding-box-update', { coords: coords });
                }
            }
        });
        
        this.imageContainer.addEventListener('mouseup', (e) => {
            if (this.activeTool === 'bounding-box' && this.boundingBoxTool.isDrawing) {
                const coords = this.boundingBoxTool.finishBox(e);
                if (coords && this.recorder.isRecording()) {
                    this.recorder.recordAction('bounding-box-end', { coords: coords });
                }
            }
        });
    }
    
    /**
     * Process URL parameters to auto-load images
     */
    processUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const imageUrl = urlParams.get('image');
        
        if (imageUrl) {
            // Set the URL input value
            this.urlInput.value = imageUrl;
            
            // Load the image
            this.imageHandler.loadFromURL(imageUrl);
        }
    }

    /**
     * Creates a sharable link with the current image URL
     */
    createShareLink() {
        const imageUrl = this.urlInput.value.trim();
        if (!imageUrl) return;
        
        // Create a URL with the image parameter
        const url = new URL(window.location.href);
        url.searchParams.set('image', imageUrl);
        
        // Copy to clipboard
        navigator.clipboard.writeText(url.toString())
            .then(() => {
                alert('Link copied to clipboard!');
            })
            .catch(err => {
                console.error('Could not copy link: ', err);
                alert('Error copying link. Link:\n' + url.toString());
            });
    }
    
    /**
     * Activates a specific tool
     * @param {string} toolName - Name of the tool to activate
     */
    activateTool(toolName) {
        // Deactivate current tool
        this.deactivateCurrentTool();
        
        // Activate new tool
        this.activeTool = toolName;
        
        // Update UI
        this.updateToolButtonsUI();
        
        // Disable panning when a tool is active
        this.imageHandler.setPanningEnabled(false);
        
        // Activate the tool
        switch (toolName) {
            case 'laser-pointer':
                this.laserPointer.activate();
                break;
                
            case 'bounding-box':
                this.boundingBoxTool.activate(this.boundingBoxMode);
                break;
        }
        
        // Record tool activation if recording
        if (this.recorder.isRecording()) {
            this.recorder.recordAction('tool-activated', { 
                tool: toolName,
                options: toolName === 'bounding-box' ? { mode: this.boundingBoxMode } : {}
            });
        }
    }
    
    /**
     * Deactivates the current tool
     */
    deactivateCurrentTool() {
        if (!this.activeTool) return;
        
        switch (this.activeTool) {
            case 'laser-pointer':
                this.laserPointer.deactivate();
                break;
                
            case 'bounding-box':
                this.boundingBoxTool.deactivate();
                break;
        }
        
        // Re-enable panning after deactivating the tool
        this.imageHandler.setPanningEnabled(true);
        
        // Record tool deactivation if recording
        if (this.recorder.isRecording()) {
            this.recorder.recordAction('tool-deactivated', { tool: this.activeTool });
        }
        
        this.activeTool = null;
    }
    
    /**
     * Updates the UI for tool buttons
     */
    updateToolButtonsUI() {
        // Reset all tool buttons
        this.laserPointerBtn.classList.remove('btn-primary');
        this.laserPointerBtn.classList.add('btn-outline-primary');
        
        this.boundingBoxBtn.classList.remove('btn-primary');
        this.boundingBoxBtn.classList.add('btn-outline-primary');
        
        // Highlight active tool
        switch (this.activeTool) {
            case 'laser-pointer':
                this.laserPointerBtn.classList.remove('btn-outline-primary');
                this.laserPointerBtn.classList.add('btn-primary');
                break;
                
            case 'bounding-box':
                this.boundingBoxBtn.classList.remove('btn-outline-primary');
                this.boundingBoxBtn.classList.add('btn-primary');
                break;
        }
    }
    
    /**
     * Sets the bounding box mode
     * @param {string} mode - The mode ('corners' or 'pointer')
     */
    setBoundingBoxMode(mode) {
        this.boundingBoxMode = mode;
        
        // Update UI
        if (mode === 'pointer') {
            this.modePointerBtn.classList.remove('btn-outline-primary');
            this.modePointerBtn.classList.add('btn-primary');
            
            this.modeCornersBtn.classList.remove('btn-primary');
            this.modeCornersBtn.classList.add('btn-outline-primary');
        } else {
            this.modeCornersBtn.classList.remove('btn-outline-primary');
            this.modeCornersBtn.classList.add('btn-primary');
            
            this.modePointerBtn.classList.remove('btn-primary');
            this.modePointerBtn.classList.add('btn-outline-primary');
        }
        
        // Update the tool if active
        if (this.activeTool === 'bounding-box') {
            this.boundingBoxTool.setMode(mode);
            
            // Record mode change if recording
            if (this.recorder.isRecording()) {
                this.recorder.recordAction('bounding-box-mode-changed', { mode: mode });
            }
        }
    }
    
    /**
     * Starts recording
     */
    async startRecording() {
        try {
            await this.recorder.startRecording();
            
            // Update UI
            this.recordBtn.classList.add('d-none');
            this.stopBtn.classList.remove('d-none');
            this.recordingIndicator.classList.add('recording');
            
            // If no tool is active, activate laser pointer by default
            if (!this.activeTool) {
                this.activateTool('laser-pointer');
            }
        } catch (err) {
            console.error('Error starting recording:', err);
            alert('Error starting recording: ' + err.message);
        }
    }
    
    /**
     * Stops recording
     */
    async stopRecording() {
        try {
            const recording = await this.recorder.stopRecording();
            
            // Update UI
            this.recordBtn.classList.remove('d-none');
            this.stopBtn.classList.add('d-none');
            this.recordingIndicator.classList.remove('recording');
            
            // Deactivate current tool
            this.deactivateCurrentTool();
            
            // Store the recording for playback
            this.currentRecording = recording;
            
            // Enable playback controls
            this.replayBtn.disabled = false;
            
            // Log recording info
            console.log('Recording completed:', {
                duration: recording.duration,
                actionCount: recording.actions.length,
                hasAudio: !!recording.audio
            });
        } catch (err) {
            console.error('Error stopping recording:', err);
            alert('Error stopping recording: ' + err.message);
        }
    }
    
    /**
     * Handles recording status changes
     * @param {Object} status - The status object
     */
    handleRecordingStatusChange(status) {
        switch (status.status) {
            case 'recording':
            case 'recording-no-audio':
                // Update timer
                this.recordingTimer.textContent = Recorder.formatTime(status.time);
                this.totalRecordingTime.textContent = Recorder.formatTime(status.time);
                break;
                
            case 'volume-update':
                // Update volume meter
                this.volumeMeter.style.width = `${status.volume}%`;
                break;
                
            case 'stopped':
                // Reset displays
                this.volumeMeter.style.width = '0%';
                break;
        }
    }
    
    /**
     * Handles player status changes
     * @param {Object} status - The status object
     */
    handlePlayerStatusChange(status) {
        switch (status.status) {
            case 'playing':
                // Update UI for playback
                this.replayBtn.classList.add('d-none');
                this.replayPauseBtn.classList.remove('d-none');
                this.replayStopBtn.classList.remove('d-none');
                break;
                
            case 'paused':
                // Update UI for pause
                this.replayBtn.classList.remove('d-none');
                this.replayPauseBtn.classList.add('d-none');
                this.replayStopBtn.classList.remove('d-none');
                break;
                
            case 'stopped':
                // Update UI for stop
                this.replayBtn.classList.remove('d-none');
                this.replayPauseBtn.classList.add('d-none');
                this.replayStopBtn.classList.add('d-none');
                break;
                
            case 'progress':
                // Update timer display during playback
                this.totalRecordingTime.textContent = Recorder.formatTime(status.time);
                break;
                
            case 'tool-activated':
                // Update UI to reflect active tool during playback
                this.activeTool = status.tool;
                this.updateToolButtonsUI();
            break;
        }
    }

    /**
     * Starts playback of the current recording
     */
    playRecording() {
        if (!this.currentRecording) {
            alert('No recording available. Record something first.');
            return;
        }
        
        this.player.loadRecording(this.currentRecording);
        this.player.play();
    }
    
    /**
     * Pauses playback
     */
    pausePlayback() {
        this.player.pause();
    }
    
    /**
     * Stops playback
     */
    stopPlayback() {
        this.player.stop();
    }
    
    /**
     * Saves the current recording to a file
     */
    saveRecording() {
        if (!this.currentRecording) {
            alert('No recording available. Record something first.');
            return;
        }
        
        // Create a copy of the recording data
        const recordingData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            duration: this.currentRecording.duration,
            actions: this.currentRecording.actions
        };
        
        // Convert to JSON
        const json = JSON.stringify(recordingData, null, 2);
        
        // Create a blob and download link
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create timestamp for filename
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        
        // Create an anchor and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `annotation-data-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Release the URL
        URL.revokeObjectURL(url);
    }
    
    /**
     * Emails the current recording
     */
    emailRecording() {
        if (!this.currentRecording) {
            alert('No recording available. Record something first.');
            return;
        }
        
        // Create a copy of the recording data
        const recordingData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            duration: this.currentRecording.duration,
            actions: this.currentRecording.actions
        };
        
        // Convert to JSON
        const json = JSON.stringify(recordingData, null, 2);
        
        // Create timestamp for subject
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        
        // Create mailto link
        const subject = encodeURIComponent(`Image Annotation Data - ${timestamp}`);
        const body = encodeURIComponent('Attached is the annotation data.\n\n');
        
        // Check if the data is small enough for mailto
        if (json.length < 1500) {
            // Can include in the body
            const dataBody = encodeURIComponent(json);
            const mailtoUrl = `mailto:?subject=${subject}&body=${body}${dataBody}`;
            window.location.href = mailtoUrl;
        } else {
            // Data too large, need to use a different approach
            alert('The annotation data is too large to send via mailto. Please use the Save button instead, and then attach the file to an email manually.');
        }
    }

    /**
     * Loads a recording file
     * @param {File} file - The recording file to load
     */
    loadRecordingFile(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                // Parse the JSON data
                const data = JSON.parse(e.target.result);
                
                // Validate required fields
                if (!data.actions || !data.duration) {
                    throw new Error('Invalid recording file format');
                }
                
                // Create a recording object
                this.currentRecording = {
                    duration: data.duration,
                    actions: data.actions,
                    audio: null // No audio when loading from JSON
                };
                
                // Enable playback
                this.replayBtn.disabled = false;
                
                alert('Recording loaded successfully!');
            } catch (err) {
                console.error('Error loading recording:', err);
                alert('Error loading recording: ' + err.message);
            }
        };
        
        reader.onerror = () => {
            alert('Error reading file');
        };
        
        reader.readAsText(file);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
}); 