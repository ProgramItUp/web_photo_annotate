/**
 * Canvas-related functionality for the image annotation application
 */

console.log('=== canvas.js: LOADING STARTED ===');

// Ensure fabric is available globally
if (typeof fabric === 'undefined') {
    console.error('ERROR: Fabric.js library not loaded. Canvas initialization will fail!');
}

// Make sure fabric is available in window object
window.fabric = fabric;

// Define the functions in the global scope right away to ensure they're available
// regardless of when the script is fully executed
(function defineGlobalFunctions() {
    // Initialize canvas function - define globally at the start
    window.initializeCanvas = function() {
        console.log('Global initializeCanvas called');
        
        // Create canvas using fabric.js
        const canvas = new fabric.Canvas('canvas', {
        width: document.getElementById('image-container').offsetWidth,
        height: 400,
        selection: true,
            preserveObjectStacking: true
        });
        
        // Store canvas globally
        window.canvas = canvas;
        
        // Log initialization
        if (typeof logMessage === 'function') {
            logMessage('Canvas initialized with proper global function', 'DEBUG');
        } else {
            console.log('Canvas initialized (logMessage not available yet)');
        }
        
        console.log('Canvas initialized and exposed as window.canvas');
        
        return canvas;
    };
    
    // Resize canvas function - define globally at the start
    window.resizeCanvas = function() {
        console.log('Global resizeCanvas called');
        
        if (!window.canvas) {
            console.error('Canvas not initialized yet');
            return;
        }
        
        const canvas = window.canvas;
        
    // Get the current image object
    const objects = canvas.getObjects();
    const imgObject = objects.find(obj => obj.type === 'image');
    
    if (!imgObject) {
        // If no image, just resize to container width
        canvas.setWidth(document.getElementById('image-container').offsetWidth);
        canvas.renderAll();
        return;
    }
    
    // Get the new container width
    const containerWidth = document.getElementById('image-container').offsetWidth;
    
    // Calculate height based on image aspect ratio
    const aspectRatio = imgObject.height / imgObject.width;
    const newHeight = containerWidth * aspectRatio * imgObject.scaleX;
    
    // Update canvas dimensions
    canvas.setWidth(containerWidth);
    canvas.setHeight(newHeight);
    
    // Update container height
    document.getElementById('image-container').style.height = `${newHeight}px`;
    
    // Rescale the image to fit the new width
    const newScaleFactor = containerWidth / imgObject.width;
    imgObject.scale(newScaleFactor);
    
    // Center the image
    imgObject.set({
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top'
    });
    
    // Redraw the canvas
    canvas.renderAll();
    
        if (typeof logMessage === 'function') {
    logMessage(`Canvas resized to ${containerWidth}x${Math.round(newHeight)} pixels`);
        }
    };
    
    // Cursor trail update function
    window.updateCursorTrail = function(pointer) {
        // Implementation removed as requested
        if (typeof logMessage === 'function') {
            logMessage('Cursor trail update event handling removed', 'DEBUG');
        }
    };
    
    // Log that we've defined the global functions
    console.log('Global canvas functions defined:', 
        'initializeCanvas=', typeof window.initializeCanvas,
        'resizeCanvas=', typeof window.resizeCanvas,
        'updateCursorTrail=', typeof window.updateCursorTrail
    );
})();

// Constants
const DEFAULT_CURSOR_SIZE = 10;

// State variables - these will be initialized after the canvas is created
let canvas;
let isPanning = false;
let lastPosX;
let lastPosY;
let zoomLevel = 1;
let showCursorTail = false;
let laserPointerMode = false; // Track when mouse is down for laser pointer mode
let cursorTrailPoints = [];
let cursorSize = DEFAULT_CURSOR_SIZE;
let lastKnownMousePosition = { x: 0, y: 0 };
let lastLoggedMousePosition = { x: 0, y: 0 };
const MOUSE_POSITION_TOLERANCE = 3; // Log when position changes by more than 3 pixels
const CURSOR_TRAIL_DURATION = 1000; // Trail duration in milliseconds (1 second)
let cursorTrailUpdateTimer; // Timer for updating cursor trail

// Expose canvas to global scope (for backward compatibility)
window.getCanvas = function() {
    return window.canvas || canvas;
};

/**
 * Calculate distance between two points
 * @param {Object} p1 - First point with x,y coordinates
 * @param {Object} p2 - Second point with x,y coordinates
 * @returns {number} - Distance between points
 */
function calculateDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Check if mouse has moved significantly and log if needed
 * @param {Object} currentPos - Current mouse position
 */
function checkAndLogMouseMovement(currentPos) {
    const distance = calculateDistance(currentPos, lastLoggedMousePosition);
    
    if (distance > MOUSE_POSITION_TOLERANCE) {
        logMessage(`Mouse moved: X: ${Math.round(currentPos.x)}, Y: ${Math.round(currentPos.y)} (${distance.toFixed(1)}px)`);
        lastLoggedMousePosition = { ...currentPos };
    }
}

/**
 * Initialize the canvas - local implementation
 * This will be called by the global function if needed
 */
function initializeCanvas() {
    console.log('Local initializeCanvas function called');
    canvas = new fabric.Canvas('canvas', {
        width: document.getElementById('image-container').offsetWidth,
        height: 400,
        selection: true,
        preserveObjectStacking: true // Keep objects stacked in the order they were added
    });
    
    // Event handlers removed as requested
    logMessage('Canvas initialized with event handling removed', 'DEBUG');
    
    // Make sure laser pointer is not active until mouse down
    laserPointerMode = false;
    
    logMessage('Canvas initialized');
    
    // Expose the canvas globally for other modules
    window.canvas = canvas;
}

/**
 * Resize the canvas to fit the container while maintaining aspect ratio
 * Local implementation for backward compatibility
 */
function resizeCanvas() {
    console.log('Local resizeCanvas called - forwarding to global implementation');
    if (typeof window.resizeCanvas === 'function') {
        window.resizeCanvas();
    }
}

/**
 * Setup pan and zoom event handlers for the canvas
 * (Function kept for compatibility, but implementation removed)
 */
function setupPanZoomHandlers() {
    logMessage('Pan/zoom event handlers removed as requested', 'DEBUG');
}

/**
 * Handle mouse enter event
 * (Function kept for compatibility, but implementation removed)
 */
function canvasMouseEnter() {
    logMessage('Mouse enter event handling removed', 'DEBUG');
}

/**
 * Handle mouse leave event
 * (Function kept for compatibility, but implementation removed)
 */
function canvasMouseLeave() {
    logMessage('Mouse leave event handling removed', 'DEBUG');
}

/**
 * Update coordinates display directly from DOM events
 * (Function kept for compatibility, but implementation removed)
 * @param {Object} pointer - The canvas pointer coordinates
 */
function updateCoordinatesDirect(pointer) {
    logMessage('Coordinate update event handling removed', 'DEBUG');
}

/**
 * Update coordinates display when mouse moves over canvas
 * (Function kept for compatibility, but implementation removed)
 * @param {Object} options - The fabric.js event object
 */
function updateCoordinates(options) {
    logMessage('Coordinate update event handling removed', 'DEBUG');
}

/**
 * Update the opacity of cursor trail points to create a fading effect
 * (Function kept for compatibility, but implementation removed)
 */
function updateTrailOpacity() {
    // Implementation removed as requested
}

/**
 * Render the cursor trail on canvas
 * (Function kept for compatibility, but implementation removed)
 */
function renderCursorTrail() {
    // Implementation removed as requested
}

/**
 * Update cursor trail with current pointer position
 * (Function kept for compatibility, but implementation removed)
 * @param {Object} pointer - The canvas pointer coordinates
 */
function updateCursorTrail(pointer) {
    // Implementation removed as requested
}

/**
 * Update cursor size based on slider value
 * (Function kept for compatibility, but implementation removed)
 */
function updateCursorSize() {
    logMessage('Cursor size update event handling removed', 'DEBUG');
}

/**
 * Set the active tool
 * (Function kept for compatibility, but implementation removed)
 * @param {string} toolName - The tool name to set active
 */
function setTool(toolName) {
    logMessage(`Tool selection event handling removed: ${toolName}`, 'DEBUG');
}

console.log('=== canvas.js: LOADING COMPLETED ==='); 