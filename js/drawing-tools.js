/**
 * Drawing tools functionality for the image annotation application
 */

console.log('=== drawing-tools.js: LOADING STARTED ===');

// Check that dependencies are available
if (typeof window.fabric === 'undefined') {
    console.error('Fabric.js library not available - drawing tools may not work correctly');
}

if (typeof window.canvas === 'undefined') {
    console.warn('Canvas not available yet when drawing-tools.js loaded - initialization will be deferred');
}

// State variables
let isDrawing = false;
let drawingObject = null;
let startPoint = {};
let resizeHandles = [];
let selectedBoundingBox = null;
const HANDLE_SIZE = 8;
const HANDLE_POSITIONS = ['tl', 'tr', 'bl', 'br', 'ml', 'mt', 'mr', 'mb'];

// Create a tools module to handle all tool-related state and functionality
const drawingTools = {
    // Current active tool
    currentTool: 'laser',
    isInitialized: false,
    
    // Initialize tools module
    init: function() {
        console.log('Initializing drawing tools...');
        
        // Add event listeners for tool buttons
        const toolButtons = document.querySelectorAll('[id^="tool-"]');
        toolButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const toolName = e.target.id.replace('tool-', '');
                this.setTool(toolName);
            });
        });
        
        // Add event listener for delete button
        const deleteButton = document.getElementById('delete-selected');
        if (deleteButton) {
            deleteButton.addEventListener('click', this.deleteSelected.bind(this));
        }
        
        // Setup canvas event handlers
        if (window.canvas) {
            window.canvas.on('mouse:down', this.handleMouseDown.bind(this));
            window.canvas.on('mouse:move', this.handleMouseMove.bind(this));
            window.canvas.on('mouse:up', this.handleMouseUp.bind(this));
            window.canvas.on('selection:created', this.handleSelectionCreated.bind(this));
            window.canvas.on('selection:cleared', this.handleSelectionCleared.bind(this));
            window.canvas.on('object:moving', this.handleObjectMoving.bind(this));
            window.canvas.on('object:modified', this.handleObjectModified.bind(this));
        }
        
        this.isInitialized = true;
        logMessage('Drawing tools initialized', 'DEBUG');
        
        // Set the default tool
        this.setTool('laser');
    },
    
    /**
     * Set the active drawing tool
     * @param {string} tool - The tool name to set active
     */
    setTool: function(tool) {
        this.currentTool = tool;
        
        // Update UI
        const toolButtons = document.querySelectorAll('[id^="tool-"]');
        toolButtons.forEach(button => {
            button.classList.remove('tool-selected');
            
            // Show/hide CSS cursor based on the current tool
            if (window.canvas) {
                window.canvas.defaultCursor = 'default';
            }
        });
        
        const selectedButton = document.getElementById(`tool-${tool}`);
        if (selectedButton) {
            selectedButton.classList.add('tool-selected');
        }
        
        // Enable selection only for the select tool
        if (window.canvas) {
            window.canvas.selection = (tool === 'select');
            window.canvas.skipTargetFind = (tool !== 'select');
            
            // Update cursor based on tool
            if (tool === 'boundingbox') {
                window.canvas.defaultCursor = 'crosshair';
            }
        }
        
        // Clear any existing handles
        this.clearResizeHandles();
        
        logMessage(`Tool switched to: ${tool}`, 'INFO');
    },
    
    /**
     * Handle mouse down events for all drawing tools
     */
    handleMouseDown: function(options) {
        if (!window.isRecording || window.isPaused) return;
        
        const pointer = options.pointer;
        const tool = this.currentTool;
        
        switch (tool) {
            case 'laser':
                this.handleLaserDown(options);
                break;
                
            case 'boundingbox':
                this.startDrawing(options, 'boundingBox');
                break;
                
            case 'select':
                // Selection is handled by fabric.js
                break;
        }
    },
    
    /**
     * Handle mouse move events for all drawing tools
     */
    handleMouseMove: function(options) {
        if (!window.isRecording || window.isPaused) return;
        
        const pointer = options.pointer;
        const tool = this.currentTool;
        
        if (isDrawing) {
            switch (tool) {
                case 'boundingbox':
                    this.drawing(options);
                    break;
            }
        }
    },
    
    /**
     * Handle mouse up events for all drawing tools
     */
    handleMouseUp: function(options) {
        if (!window.isRecording || window.isPaused) return;
        
        const pointer = options.pointer;
        const tool = this.currentTool;
        
        if (isDrawing) {
            this.endDrawing(options);
        }
        
        if (tool === 'laser') {
            this.handleLaserUp();
        }
    },
    
    /**
     * Handle selection created event
     */
    handleSelectionCreated: function(options) {
        const selectedObject = options.selected[0];
        if (selectedObject && selectedObject.type === 'rect' && selectedObject.isBoundingBox) {
            selectedBoundingBox = selectedObject;
            this.createResizeHandles(selectedObject);
        }
    },
    
    /**
     * Handle selection cleared event
     */
    handleSelectionCleared: function() {
        selectedBoundingBox = null;
        this.clearResizeHandles();
    },

    /**
     * Handle object moving event
     */
    handleObjectMoving: function(options) {
        const object = options.target;
        if (object && object.type === 'rect' && object.isBoundingBox) {
            this.updateResizeHandles(object);
        }
    },

    /**
     * Handle object modified event
     */
    handleObjectModified: function(options) {
        const object = options.target;
        if (object && object.type === 'rect' && object.isBoundingBox) {
            // If this is a resize handle, resize the bounding box
            if (object.isResizeHandle) {
                this.resizeBoundingBox(object);
            } else {
                // Update resize handles position after bounding box modification
                this.updateResizeHandles(object);
            }
        }
    },
    
    /**
     * Resize bounding box based on handle movement
     */
    resizeBoundingBox: function(handle) {
        if (!selectedBoundingBox || !handle.position) return;
        
        const canvas = window.canvas;
        const position = handle.position;
        const left = selectedBoundingBox.left;
        const top = selectedBoundingBox.top;
        const width = selectedBoundingBox.width * selectedBoundingBox.scaleX;
        const height = selectedBoundingBox.height * selectedBoundingBox.scaleY;
        
        let newLeft = left;
        let newTop = top;
        let newWidth = width;
        let newHeight = height;
        
        // Calculate new position and dimensions based on handle position
        switch (position) {
            case 'tl': // Top-left
                newLeft = handle.left;
                newTop = handle.top;
                newWidth = width + (left - newLeft);
                newHeight = height + (top - newTop);
                break;
            case 'tr': // Top-right
                newTop = handle.top;
                newWidth = handle.left - left;
                newHeight = height + (top - newTop);
                break;
            case 'bl': // Bottom-left
                newLeft = handle.left;
                newWidth = width + (left - newLeft);
                newHeight = handle.top - top;
                break;
            case 'br': // Bottom-right
                newWidth = handle.left - left;
                newHeight = handle.top - top;
                break;
            case 'ml': // Middle-left
                newLeft = handle.left;
                newWidth = width + (left - newLeft);
                break;
            case 'mt': // Middle-top
                newTop = handle.top;
                newHeight = height + (top - newTop);
                break;
            case 'mr': // Middle-right
                newWidth = handle.left - left;
                break;
            case 'mb': // Middle-bottom
                newHeight = handle.top - top;
                break;
        }
        
        // Update bounding box
        selectedBoundingBox.set({
            left: newLeft,
            top: newTop,
            width: newWidth,
            height: newHeight,
            scaleX: 1,
            scaleY: 1
        });
        
        // Update resize handles
        this.updateResizeHandles(selectedBoundingBox);
        
        canvas.renderAll();
    },
    
    /**
     * Update resize handles positions based on the bounding box
     */
    updateResizeHandles: function(boundingBox) {
        // Clear existing handles and create new ones
        this.clearResizeHandles();
        this.createResizeHandles(boundingBox);
    },
    
    /**
     * Create resize handles for the bounding box
     */
    createResizeHandles: function(boundingBox) {
        this.clearResizeHandles();
        
        // Only create handles if the current tool is select
        if (this.currentTool !== 'select') return;
        
        const canvas = window.canvas;
        if (!canvas) return;
        
        // Get coordinates
        const left = boundingBox.left;
        const top = boundingBox.top;
        const width = boundingBox.width * boundingBox.scaleX;
        const height = boundingBox.height * boundingBox.scaleY;
        
        // Define handle positions
        const handlePositions = {
            'tl': { left: left, top: top },
            'tr': { left: left + width, top: top },
            'bl': { left: left, top: top + height },
            'br': { left: left + width, top: top + height },
            'ml': { left: left, top: top + height/2 },
            'mt': { left: left + width/2, top: top },
            'mr': { left: left + width, top: top + height/2 },
            'mb': { left: left + width/2, top: top + height }
        };
        
        // Create and add handles
        HANDLE_POSITIONS.forEach(position => {
            const handle = new fabric.Rect({
                left: handlePositions[position].left,
                top: handlePositions[position].top,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                fill: 'white',
                stroke: 'black',
                strokeWidth: 1,
                originX: 'center',
                originY: 'center',
                hasControls: false,
                hasBorders: false,
                lockRotation: true,
                position: position,
                isResizeHandle: true,
                selectable: true
            });
            
            resizeHandles.push(handle);
            canvas.add(handle);
        });
        
        // Bring handles to front
        resizeHandles.forEach(handle => {
            canvas.bringToFront(handle);
        });
        
        canvas.renderAll();
    },
    
    /**
     * Clear resize handles
     */
    clearResizeHandles: function() {
        if (!window.canvas) return;
        
        // Remove all handles
        resizeHandles.forEach(handle => {
            window.canvas.remove(handle);
        });
        
        resizeHandles = [];
        window.canvas.renderAll();
    },
    
    /**
     * Handle mouse down for laser pointer
     */
    handleLaserDown: function(options) {
        if (typeof window.startLaserTrail === 'function') {
            window.startLaserTrail();
        }
    },
    
    /**
     * Handle mouse up for laser pointer
     */
    handleLaserUp: function() {
        if (typeof window.clearLaserTrail === 'function') {
            window.clearLaserTrail();
        }
    },
    
    /**
     * Start drawing a shape
     */
    startDrawing: function(options, shapeType) {
        isDrawing = true;
        const pointer = options.pointer;
        startPoint = { x: pointer.x, y: pointer.y };
        
        // Create a bounding box
        const shape = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: 'rgba(0, 150, 255, 0.2)',
            stroke: 'blue',
            strokeWidth: 2,
            selectable: true,
            isBoundingBox: true
        });
        
        window.canvas.add(shape);
        drawingObject = shape;
        
        logMessage(`Started drawing bounding box at X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}`, 'INFO');
    },
    
    /**
     * Continue drawing a shape as the mouse moves
     */
    drawing: function(options) {
        if (!isDrawing || !drawingObject) return;
        
        const pointer = options.pointer;
        
        // Calculate dimensions
        const width = Math.abs(pointer.x - startPoint.x);
        const height = Math.abs(pointer.y - startPoint.y);
        
        // Calculate top-left position (handle drawing from any direction)
        const left = Math.min(startPoint.x, pointer.x);
        const top = Math.min(startPoint.y, pointer.y);
        
        // Update rectangle
        drawingObject.set({
            left: left,
            top: top,
            width: width,
            height: height
        });
        
        window.canvas.renderAll();
    },
    
    /**
     * Finish drawing a shape when mouse is released
     */
    endDrawing: function(options) {
        if (!isDrawing || !drawingObject) return;
        
        const pointer = options.pointer;
        
        // Get final dimensions
        const width = Math.abs(drawingObject.width * drawingObject.scaleX);
        const height = Math.abs(drawingObject.height * drawingObject.scaleY);
        
        // Log bounding box completion
        logMessage(`Bounding box created: X: ${Math.round(drawingObject.left)}, Y: ${Math.round(drawingObject.top)}, Width: ${Math.round(width)}, Height: ${Math.round(height)}`, 'INFO');
        
        // Create a JSON representation of the bounding box for the recording data
        const boundingBoxData = {
            type: 'boundingBox',
            x: drawingObject.left,
            y: drawingObject.top,
            width: width,
            height: height,
            timeOffset: window.getCurrentRecordingTime ? window.getCurrentRecordingTime() : 0,
            realTime: Date.now()
        };
        
        // Add to mouse data for recording
        if (window.mouseData) {
            window.mouseData.push(boundingBoxData);
        }
        
        isDrawing = false;
        drawingObject = null;
        window.canvas.renderAll();
    },
    
    /**
     * Delete currently selected objects
     */
    deleteSelected: function() {
        const canvas = window.canvas;
        if (!canvas) return;
        
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
            canvas.remove(activeObject);
            
            // Clear any resize handles
            if (activeObject === selectedBoundingBox) {
                selectedBoundingBox = null;
                this.clearResizeHandles();
            }
            
            canvas.renderAll();
            logMessage('Deleted selected object', 'INFO');
        } else {
            logMessage('No object selected for deletion', 'INFO');
        }
    }
};

// Export the drawing tools object to the global scope
window.drawingTools = drawingTools;

// Initialize drawing tools when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Initialize only when canvas is available - look in the window object
        if (typeof window.canvas !== 'undefined') {
            drawingTools.init();
            logMessage('Drawing tools initialized successfully', 'DEBUG');
        } else {
            console.warn('Canvas not available yet, drawing tools initialization will be deferred');
            
            // Attempt to initialize later if canvas wasn't ready
            setTimeout(function() {
                if (typeof window.canvas !== 'undefined') {
                    drawingTools.init();
                    logMessage('Drawing tools initialized successfully after delay', 'DEBUG');
                } else {
                    console.error('Canvas still not available after delay, drawing tools not initialized');
                    if (typeof logMessage === 'function') {
                        logMessage('Could not initialize drawing tools: canvas not available', 'ERROR');
                    }
                }
            }, 1000);
        }
    } catch (error) {
        console.error('Error initializing drawing tools:', error);
        if (typeof logMessage === 'function') {
            logMessage('Error initializing drawing tools: ' + error.message, 'ERROR');
        }
    }
});

console.log('=== drawing-tools.js: LOADING COMPLETED ==='); 