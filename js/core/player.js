/**
 * Player module for replaying recorded annotations
 * Handles synchronized playback of actions and audio
 */

export class Player {
    /**
     * Creates a new Player
     * @param {Object} imageHandler - The image handler instance
     * @param {Object} tools - Object containing tool instances
     */
    constructor(imageHandler, tools) {
        this.imageHandler = imageHandler;
        this.tools = tools;
        this.recording = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.startTime = 0;
        this.audioElement = new Audio();
        this.onStatusChangeCallback = null;
        this.actionIndex = 0;
        this.pendingActions = [];
        
        // Set up audio element event handling
        this.audioElement.addEventListener('ended', () => {
            this.stop();
        });
        
        this.audioElement.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            this.stop();
        });
    }
    
    /**
     * Sets a callback function to be called when playback status changes
     * @param {Function} callback - Function to call with status updates
     */
    setStatusChangeCallback(callback) {
        this.onStatusChangeCallback = callback;
    }
    
    /**
     * Loads a recording to be played
     * @param {Object} recording - Recording object with actions and audio
     */
    loadRecording(recording) {
        this.recording = recording;
        this.pendingActions = [...recording.actions].sort((a, b) => a.time - b.time);
        this.actionIndex = 0;
        
        if (recording.audio) {
            const audioUrl = URL.createObjectURL(recording.audio);
            this.audioElement.src = audioUrl;
        } else {
            this.audioElement.src = '';
        }
        
        // Dispatch status update
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback({
                status: 'loaded',
                duration: recording.duration
            });
        }
    }
    
    /**
     * Starts or resumes playback
     */
    play() {
        if (!this.recording) return;
        
        if (this.isPaused) {
            // Resume from pause
            this.isPaused = false;
            this.startTime = Date.now() - this.currentTime;
            
            if (this.recording.audio && this.audioElement.src) {
                this.audioElement.play();
            }
        } else {
            // Start from beginning
            this.currentTime = 0;
            this.startTime = Date.now();
            this.actionIndex = 0;
            this.pendingActions = [...this.recording.actions].sort((a, b) => a.time - b.time);
            
            if (this.recording.audio && this.audioElement.src) {
                this.audioElement.currentTime = 0;
                this.audioElement.play();
            }
            
            // Clear any tool state
            this.resetTools();
        }
        
        this.isPlaying = true;
        
        // Start playback loop
        this.playbackLoop();
        
        // Dispatch status update
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback({
                status: 'playing',
                time: this.currentTime
            });
        }
    }
    
    /**
     * Pauses playback
     */
    pause() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        this.isPaused = true;
        
        if (this.recording.audio && this.audioElement.src) {
            this.audioElement.pause();
        }
        
        // Dispatch status update
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback({
                status: 'paused',
                time: this.currentTime
            });
        }
    }
    
    /**
     * Stops playback and resets to the beginning
     */
    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        
        if (this.recording && this.recording.audio && this.audioElement.src) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
        
        // Reset tools state
        this.resetTools();
        
        // Dispatch status update
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback({
                status: 'stopped',
                time: 0
            });
        }
    }
    
    /**
     * Main playback loop
     */
    playbackLoop() {
        if (!this.isPlaying) return;
        
        // Update current time
        this.currentTime = Date.now() - this.startTime;
        
        // Process actions that should be executed at current time
        this.processActions();
        
        // Check if we've reached the end
        if (this.currentTime >= this.recording.duration) {
            this.stop();
            return;
        }
        
        // Dispatch progress update
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback({
                status: 'progress',
                time: this.currentTime,
                duration: this.recording.duration
            });
        }
        
        // Continue the loop
        requestAnimationFrame(() => this.playbackLoop());
    }
    
    /**
     * Processes actions that should be executed at the current time
     */
    processActions() {
        // Look for actions that should be executed now
        while (this.pendingActions.length > 0 && this.pendingActions[0].time <= this.currentTime) {
            const action = this.pendingActions.shift();
            this.executeAction(action);
        }
    }
    
    /**
     * Executes a single action
     * @param {Object} action - The action to execute
     */
    executeAction(action) {
        // Create a synthetic event object if needed
        const syntheticEvent = action.data && action.data.coords ? {
            clientX: action.data.coords.x * this.imageHandler.getZoomFactor(),
            clientY: action.data.coords.y * this.imageHandler.getZoomFactor()
        } : null;
        
        switch (action.type) {
            case 'laser-pointer':
                if (this.tools.laserPointer && action.data) {
                    // Activate the tool if not already active
                    if (!this.tools.laserPointer.active) {
                        this.activateTool('laser-pointer');
                    }
                    
                    // Create the pointer at this location
                    if (syntheticEvent) {
                        this.tools.laserPointer.addTrailPoint(syntheticEvent);
                    }
                }
                break;
                
            case 'bounding-box-start':
                if (this.tools.boundingBoxTool && action.data) {
                    // Activate the tool if not already active
                    if (!this.tools.boundingBoxTool.active) {
                        this.tools.boundingBoxTool.activate(action.data.mode || 'corners');
                        this.activateTool('bounding-box');
                    }
                    
                    // Start the box
                    if (syntheticEvent) {
                        this.tools.boundingBoxTool.startBox(syntheticEvent);
                    }
                }
                break;
                
            case 'bounding-box-update':
                if (this.tools.boundingBoxTool && action.data && syntheticEvent) {
                    this.tools.boundingBoxTool.updateBox(syntheticEvent);
                }
                break;
                
            case 'bounding-box-end':
                if (this.tools.boundingBoxTool && action.data && syntheticEvent) {
                    this.tools.boundingBoxTool.finishBox(syntheticEvent);
                }
                break;
                
            case 'tool-activated':
                if (action.data && action.data.tool) {
                    this.activateTool(action.data.tool, action.data.options);
                }
                break;
                
            case 'tool-deactivated':
                if (action.data && action.data.tool) {
                    this.deactivateTool(action.data.tool);
                }
                break;
                
            default:
                console.log(`Unhandled action type: ${action.type}`, action);
        }
    }
    
    /**
     * Activates a tool for playback
     * @param {string} toolName - Name of the tool to activate
     * @param {Object} options - Optional tool options
     */
    activateTool(toolName, options = {}) {
        // Deactivate all tools first
        this.deactivateAllTools();
        
        switch(toolName) {
            case 'laser-pointer':
                if (this.tools.laserPointer) {
                    this.tools.laserPointer.activate();
                }
                break;
                
            case 'bounding-box':
                if (this.tools.boundingBoxTool) {
                    const mode = options.mode || 'corners';
                    this.tools.boundingBoxTool.activate(mode);
                }
                break;
        }
        
        // Dispatch tool activation
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback({
                status: 'tool-activated',
                tool: toolName,
                options: options
            });
        }
    }
    
    /**
     * Deactivates a specific tool
     * @param {string} toolName - Name of the tool to deactivate
     */
    deactivateTool(toolName) {
        switch(toolName) {
            case 'laser-pointer':
                if (this.tools.laserPointer) {
                    this.tools.laserPointer.deactivate();
                }
                break;
                
            case 'bounding-box':
                if (this.tools.boundingBoxTool) {
                    this.tools.boundingBoxTool.deactivate();
                }
                break;
        }
    }
    
    /**
     * Deactivates all tools
     */
    deactivateAllTools() {
        if (this.tools.laserPointer) {
            this.tools.laserPointer.deactivate();
        }
        
        if (this.tools.boundingBoxTool) {
            this.tools.boundingBoxTool.deactivate();
        }
    }
    
    /**
     * Resets all tools to initial state
     */
    resetTools() {
        this.deactivateAllTools();
        
        if (this.tools.boundingBoxTool) {
            this.tools.boundingBoxTool.clearBoxes();
        }
    }
    
    /**
     * Returns whether playback is currently active
     * @returns {boolean} True if playing, false otherwise
     */
    isCurrentlyPlaying() {
        return this.isPlaying;
    }
    
    /**
     * Returns whether playback is currently paused
     * @returns {boolean} True if paused, false otherwise
     */
    isCurrentlyPaused() {
        return this.isPaused;
    }
    
    /**
     * Cleans up resources when the player is no longer needed
     */
    dispose() {
        this.stop();
        
        // Release audio URL
        if (this.audioElement && this.audioElement.src) {
            URL.revokeObjectURL(this.audioElement.src);
            this.audioElement.src = '';
        }
    }
} 