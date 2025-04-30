/**
 * Canvas-related functionality for the image annotation application
 */

console.log('=== canvas.js: LOADING STARTED ===');

// Ensure fabric is available globally
if (typeof fabric === 'undefined') {
    console.error('ERROR: Fabric.js library not loaded. Canvas initialization will fail!');
} else {
    // Completely disable panning by overriding Fabric.js internals immediately
    fabric.Canvas.prototype.allowTouchScrolling = false;
    
    // Disable the panning functionality entirely
    fabric.Canvas.prototype.setCursor = function(value) {
        // Always use default cursor
        this.upperCanvasEl.style.cursor = value || 'default';
    };
    
    // Prevent dragging of the canvas
    fabric.Canvas.prototype.relativePan = function() {
        // Do nothing to prevent panning
        return this;
    };
    
    fabric.Canvas.prototype.absolutePan = function() {
        // Do nothing to prevent panning
        return this;
    };
    
    console.log('Fabric.js panning functionality disabled');
}

// Make sure fabric is available in window object
window.fabric = fabric;

// Define the functions in the global scope right away to ensure they're available
// regardless of when the script is fully executed
(function defineGlobalFunctions() {
    // Initialize canvas function - define globally at the start
    window.initializeCanvas = function() {
        console.log('Global initializeCanvas called');
        
        // Create canvas using fabric.js with panning disabled
        const canvas = new fabric.Canvas('canvas', {
            width: document.getElementById('image-container').offsetWidth,
            height: 400,
            selection: false,
            preserveObjectStacking: true,
            allowTouchScrolling: false,
            skipTargetFind: true,
            fireRightClick: false,
            stopContextMenu: true
        });
        
        // Disable all interactive features to prevent panning
        canvas.isDrawingMode = false;
        canvas.skipTargetFind = true;
        canvas.selection = false;
        
        // Explicitly disable built-in panning
        canvas.allowTouchScrolling = false;
        
        // Store canvas globally
        window.canvas = canvas;
        
        // Set up cursor trail tracking
        setupCursorTrailTracking(canvas);
        
        // Log initialization
        if (typeof logMessage === 'function') {
            logMessage('Canvas initialized with proper global function', 'DEBUG');
        } else {
            console.log('Canvas initialized (logMessage not available yet)');
        }
        
        console.log('Canvas initialized and exposed as window.canvas');
        
        return canvas;
    };
    
    // Add function to enable/disable cursor trail
    window.setCursorTrailEnabled = function(enabled) {
        window.cursorTrailEnabled = enabled;
        
        if (typeof logMessage === 'function') {
            logMessage(`Cursor trail ${enabled ? 'enabled' : 'disabled'} by user setting`, 'DEBUG');
        }
        
        // Update checkbox state if it exists
        const checkbox = document.getElementById('cursor-tail-toggle');
        if (checkbox && checkbox.checked !== enabled) {
            checkbox.checked = enabled;
        }
        
        // If disabled, clear any existing trail
        if (!enabled && window.canvas) {
            clearCursorTrail();
        }
    };
    
    // Resize canvas function - define globally at the start
    window.resizeCanvas = function() {
        console.log('Global resizeCanvas called');
        
        if (!window.canvas) {
            console.error('Canvas not initialized yet');
            return;
        }
        
        const canvas = window.canvas;
        const container = document.getElementById('image-container');
        
        // Get the current image object
        const objects = canvas.getObjects();
        const imgObject = objects.find(obj => obj.type === 'image');
        
        if (!imgObject) {
            // If no image, resize to container width (or some default)
            canvas.setWidth(container.offsetWidth);
            canvas.setHeight(400); // Default height if no image
            canvas.renderAll();
            return;
        }
        
        // --- MODIFICATION START: Use 1:1 scaling ---
        const naturalWidth = imgObject.width; // Use image's natural dimensions
        const naturalHeight = imgObject.height;

        console.log(`Resizing canvas for 1:1 image ${naturalWidth}x${naturalHeight}`);
        
        // Update canvas dimensions to match image exactly
        canvas.setWidth(naturalWidth);
        canvas.setHeight(naturalHeight);
        
        // Set image scale to 1 (100%)
        imgObject.set({
            scaleX: 1,
            scaleY: 1,
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top'
        });
        // --- MODIFICATION END ---
        
        // Redraw the canvas
        canvas.renderAll();
        
        if (typeof logMessage === 'function') {
            logMessage(`Canvas resized to image natural size: ${naturalWidth}x${naturalHeight} pixels`);
        }
    };
    
    // NEW: Resize canvas to fit image within max dimensions
    window.resizeCanvasToFit = function(maxWidth, maxHeight) {
        console.log(`Global resizeCanvasToFit called with max dimensions: ${maxWidth}x${maxHeight}`);

        if (!window.canvas) {
            console.error('Canvas not initialized yet');
            return;
        }

        const canvas = window.canvas;
        const objects = canvas.getObjects();
        const imgObject = objects.find(obj => obj.type === 'image');

        if (!imgObject) {
            if (typeof logMessage === 'function') {
                logMessage('No image loaded to resize.', 'WARN');
            }
            // Optionally resize the empty canvas to defaults or container size?
            // For now, do nothing if no image.
            return;
        }

        const naturalWidth = imgObject.width;
        const naturalHeight = imgObject.height;

        if (naturalWidth <= 0 || naturalHeight <= 0) {
            logMessage('Image has invalid natural dimensions.', 'WARN');
            return;
        }

        // Calculate scale factor
        const widthScale = maxWidth / naturalWidth;
        const heightScale = maxHeight / naturalHeight;
        const scaleFactor = Math.min(widthScale, heightScale); // Ensure it fits within BOTH dimensions

        const targetWidth = naturalWidth * scaleFactor;
        const targetHeight = naturalHeight * scaleFactor;

        logMessage(`Resizing canvas to fit image within ${maxWidth}x${maxHeight}. Target: ${targetWidth.toFixed(0)}x${targetHeight.toFixed(0)}, Scale: ${scaleFactor.toFixed(3)}`);

        // Update canvas dimensions
        canvas.setWidth(targetWidth);
        canvas.setHeight(targetHeight);

        // Set image scale and position
        imgObject.set({
            scaleX: scaleFactor,
            scaleY: scaleFactor,
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top'
        });

        // Redraw the canvas
        canvas.renderAll();
    };
    
    // Re-implementing cursor trail update function
    window.updateCursorTrail = function(pointer, pixelCoords) {
        if (!showCursorTail || !pixelCoords) return;
        
        const now = Date.now();
        
        // Store current position (canvas coordinates)
        // lastKnownMousePosition = { x: pointer.x, y: pointer.y }; // Can be removed if not used elsewhere
        
        // Check if mouse has moved at least 3 pixels from the last logged point (using canvas coords for move check)
        const lastPoint = cursorTrailPoints.length > 0 ? 
            cursorTrailPoints[cursorTrailPoints.length - 1] :
            // Use canvas coords for initial offset check
            { cx: pointer.x - 10, cy: pointer.y - 10, time: 0 }; 
        
        // Calculate distance using canvas coordinates for visual spacing
        const distance = calculateDistance({x: pointer.x, y: pointer.y}, {x: lastPoint.cx, y: lastPoint.cy});
        
        // Only add a new point if movement exceeds the pixel threshold (3px)
        if (distance >= 3) {
            // *** Store BOTH canvas and pixel coordinates ***
            cursorTrailPoints.push({
                cx: pointer.x,
                cy: pointer.y,
                px: pixelCoords.x,
                py: pixelCoords.y,
                time: now,
                opacity: 1
            });
            
            // Log the position (displaying pixel coords for consistency)
            if (typeof logMessage === 'function') {
                logMessage(`Cursor trail updated: Canvas(X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}) Pixel(X: ${pixelCoords.x}, Y: ${pixelCoords.y})`, 'DEBUG');
            }
            
            // IMPORTANT: Send PIXEL coordinates to the recording system
            if (typeof window.updateCursorTrailPosition === 'function' && typeof window.isRecording === 'function' && window.isRecording()) {
                // *** START DIAGNOSTIC LOGGING ***
                console.log(`RECORDING COORDS (Pixel): X=${pixelCoords.x}, Y=${pixelCoords.y}`);
                // *** END DIAGNOSTIC LOGGING ***
                window.updateCursorTrailPosition(pixelCoords.x, pixelCoords.y);
                logMessage(`Sent PIXEL cursor position to recording system: X: ${pixelCoords.x}, Y: ${pixelCoords.y}`, 'DEBUG');
            }
            
            // Render the updated trail (uses cx, cy internally)
            renderCursorTrail();
            
            // Periodically clean up old points
            if (now - lastTrailCleanup > 200) {
                cleanupCursorTrail();
                lastTrailCleanup = now;
            }
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
// const DEFAULT_CURSOR_SIZE = 10; // Moved to config.js
const CURSOR_TRAIL_DURATION = 2000; // Trail duration in milliseconds (1 second)

// State variables - these will be initialized after the canvas is created
let canvas;
let isPanning = false; // Keep this false to disable panning
let lastPosX;
let lastPosY;
let zoomLevel = 1;
let showCursorTail = false; // Start with cursor trail disabled until mouse down
let laserPointerMode = false; 
let cursorTrailPoints = [];
let cursorSize = DEFAULT_CURSOR_SIZE;
let lastKnownMousePosition = { x: 0, y: 0 };
let lastLoggedMousePosition = { x: 0, y: 0 };
const MOUSE_POSITION_TOLERANCE = 3; // Log when position changes by more than 3 pixels
let cursorTrailUpdateTimer; // Timer for updating cursor trail
let lastTrailCleanup = 0; // Time of last trail cleanup
let contrastFilter = null;

/**
 * Initialize the application's cursor trail
 * Called automatically when document is ready
 */
function initCursorTrail() {
    // Get cursor size from slider or use default
    const cursorSizeSlider = document.getElementById('cursor-size');
    if (cursorSizeSlider) {
        const sliderValue = parseInt(cursorSizeSlider.value);
        cursorSize = isNaN(sliderValue) ? DEFAULT_CURSOR_SIZE : sliderValue;
        window.cursorSize = cursorSize;
        logMessage(`Cursor size initialized to ${cursorSize}px from slider`, 'DEBUG');
    } else {
        cursorSize = DEFAULT_CURSOR_SIZE;
        window.cursorSize = cursorSize;
        logMessage(`Cursor size initialized to default ${cursorSize}px`, 'DEBUG');
    }
    
    // Set default state based on checkbox
    const cursorTrailToggle = document.getElementById('cursor-tail-toggle');
    if (cursorTrailToggle) {
        window.cursorTrailEnabled = cursorTrailToggle.checked;
        updateCursorTrailStatus(false, window.cursorTrailEnabled);
    }
}

// Expose canvas to global scope (for backward compatibility)
window.getCanvas = function() {
    return window.canvas || canvas;
};

// Expose key variables to global scope
window.cursorSize = cursorSize;
window.showCursorTail = showCursorTail;
window.cursorTrailEnabled = true; // Enable trail by default
window.initCursorTrail = initCursorTrail; // Make initialization function globally available
window.renderCursorTrail = renderCursorTrail; // Make render function globally available

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
 * NEW: Convert canvas coordinates to image pixel coordinates
 * @param {Object} canvasPoint - Point with x, y in canvas space
 * @returns {Object|null} Point with x, y in image pixel space, or null if no image
 */
function getPixelCoordinatesFromCanvasPoint(canvasPoint) {
    if (!window.canvas) return null;
    const imgObject = window.canvas.getObjects().find(obj => obj.type === 'image');
    if (!imgObject) return null;

    // Calculate the scale factor (assuming uniform scaling for simplicity here)
    // Based on the logic in resizeCanvas
    const scale = imgObject.scaleX; // Assuming scaleX and scaleY are the same

    // Adjust for image position on canvas (usually 0,0 but good practice)
    const imageOriginX = imgObject.left;
    const imageOriginY = imgObject.top;

    // Convert canvas coords to image coords
    const pixelX = Math.floor((canvasPoint.x - imageOriginX) / scale);
    const pixelY = Math.floor((canvasPoint.y - imageOriginY) / scale);

    // Optional: Clamp to image natural dimensions if needed
    // const clampedX = Math.max(0, Math.min(pixelX, imgObject.width - 1));
    // const clampedY = Math.max(0, Math.min(pixelY, imgObject.height - 1));

    return { x: pixelX, y: pixelY };
}

/**
 * NEW: Convert image pixel coordinates to canvas coordinates
 * @param {Object} pixelPoint - Point with x, y in image pixel space
 * @returns {Object|null} Point with x, y in canvas space, or null if no image/canvas
 */
function getCanvasCoordinatesFromPixelPoint(pixelPoint) {
    if (!window.canvas) return null;
    const imgObject = window.canvas.getObjects().find(obj => obj.type === 'image');
    if (!imgObject) return null;

    // Get the current scale factor of the image on the canvas
    const scale = imgObject.scaleX; // Assuming uniform scale

    // Get the image's top-left corner position on the canvas (usually 0,0)
    const imageOriginX = imgObject.left;
    const imageOriginY = imgObject.top;

    // Convert pixel coords to canvas coords
    const canvasX = (pixelPoint.x * scale) + imageOriginX;
    const canvasY = (pixelPoint.y * scale) + imageOriginY;

    return { x: canvasX, y: canvasY };
}

/**
 * Check if mouse has moved significantly and log if needed
 * @param {Object} currentPos - Current mouse position (canvas coordinates)
 */
function checkAndLogMouseMovement(currentPos) {
    // Convert from canvas coordinates to screen coordinates (Original logic, now unused for display)
    // const canvas = window.canvas;
    // if (!canvas) return;
    // const canvasElement = canvas.lowerCanvasEl;
    // const rect = canvasElement.getBoundingClientRect();
    // const scaleFactor = zoomLevel || 1;
    // const screenX = Math.round(currentPos.x);
    // const screenY = Math.round(currentPos.y);
    
    // *** NEW: Get Image Pixel Coordinates ***
    const pixelCoords = getPixelCoordinatesFromCanvasPoint(currentPos);
    if (!pixelCoords) return; // Exit if no image or coords couldn't be calculated

    const distance = calculateDistance(
        pixelCoords, 
        lastLoggedMousePosition // Assuming lastLoggedMousePosition stores pixel coords now
    );
    
    // Log based on pixel coordinate distance
    if (distance > MOUSE_POSITION_TOLERANCE) {
        // DEBUG: Temporarily disabled mouse move logging // logMessage(`Mouse moved (Canvas: ${Math.round(currentPos.x)},${Math.round(currentPos.y)} | Pixel: ${pixelCoords.x},${pixelCoords.y}) - Dist: ${distance.toFixed(1)}px`);
        lastLoggedMousePosition = pixelCoords; 
        
        // Update coordinates in UI with IMAGE PIXEL coordinates
        updateCoordinatesDisplay(pixelCoords.x, pixelCoords.y);
    }
}

/**
 * Update coordinates display in the UI
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
 * Initialize the canvas - local implementation
 * This will be called by the global function if needed
 */
function initializeCanvas() {
    console.log('Local initializeCanvas function called');
    canvas = new fabric.Canvas('canvas', {
        width: document.getElementById('image-container').offsetWidth,
        height: 400,
        selection: false,
        preserveObjectStacking: true,
        allowTouchScrolling: false,
        skipTargetFind: true,
        fireRightClick: false,
        stopContextMenu: true
    });
    
    // Disable all interactive features to prevent panning
    canvas.isDrawingMode = false;
    canvas.skipTargetFind = true;
    canvas.selection = false;
    
    // Explicitly disable built-in panning
    canvas.allowTouchScrolling = false;
    
    // Set up cursor trail tracking
    setupCursorTrailTracking(canvas);
    
    logMessage('Canvas initialized with cursor trail enabled, panning disabled', 'DEBUG');
    
    // Make sure laser pointer is not active until mouse down
    laserPointerMode = false;
    
    logMessage('Canvas initialized');
    
    // Expose the canvas globally for other modules
    window.canvas = canvas;
}

/**
 * Setup cursor trail tracking for the canvas
 * @param {fabric.Canvas} canvas - The fabric canvas to setup cursor tracking on
 */
function setupCursorTrailTracking(canvas) {
    if (!canvas) {
        console.error('Cannot setup cursor trail - canvas is null');
        return;
    }
    
    // Initialize with cursor tail disabled until mouse down
    showCursorTail = false;
    window.showCursorTail = false;
    updateCursorTrailStatus(false);
    
    // Track mouse button state
    let isMouseDown = false;
    
    // Remove existing event listeners to ensure we don't have duplicates
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');
    
    // Add our custom event handlers
    canvas.on('mouse:move', function(options) {
        const pointer = canvas.getPointer(options.e); // Canvas coordinates
        const pixelCoords = getPixelCoordinatesFromCanvasPoint(pointer); // Pixel coordinates

        // Check if mouse button is down and trail is enabled
        const isBBoxActive = window.DrawingTools && typeof window.DrawingTools.isInBoundingBoxMode === 'function' && window.DrawingTools.isInBoundingBoxMode();
        const isLaserToolActive = (document.getElementById('tool-laser')?.classList.contains('active'));

        if (isLaserToolActive && isMouseDown && typeof window.addLaserPointerPoint === 'function') {
            // Pass pixel coordinates directly
            if (pixelCoords) { // Ensure pixelCoords are valid
                window.addLaserPointerPoint(pixelCoords);
            }
        }

        if (isMouseDown && window.cursorTrailEnabled && !isBBoxActive && pixelCoords) { // Check if pixelCoords are valid
            updateCursorTrail(pointer, pixelCoords); // Pass both sets of coordinates
            logMessage('Cursor trail point added', 'DEBUG');
        }

        // Update coordinate display with IMAGE PIXEL coordinates
        if (pixelCoords) {
            updateCoordinatesDisplay(pixelCoords.x, pixelCoords.y);
        } else {
            updateCoordinatesDisplay('---', '---'); 
        }
    });
    
    // Enable cursor trail when mouse button pressed
    canvas.on('mouse:down', function(options) {
        // Only activate for left mouse button (button 0)
        if (options.e.button === 0) {
            isMouseDown = true;
            const pointer = canvas.getPointer(options.e); // Canvas Coords
            const pixelCoords = getPixelCoordinatesFromCanvasPoint(pointer); // Pixel Coords

            // Determine if laser pointer tool is active
            const isLaserToolActive = (document.getElementById('tool-laser')?.classList.contains('active'));

            // *** NEW: Start laser pointer event ***
            if (isLaserToolActive && typeof window.startLaserPointerEvent === 'function' && pixelCoords) {
                window.startLaserPointerEvent(pixelCoords);
            }
            
            // Only enable trail visualization if the user has enabled it via the checkbox
            if (window.cursorTrailEnabled) {
                // *** MODIFICATION: Check if bounding box is NOT active ***
                const isBBoxActive = window.DrawingTools && typeof window.DrawingTools.isInBoundingBoxMode === 'function' && window.DrawingTools.isInBoundingBoxMode();

                // Only show trail visually if BBox is not active
                if (!isBBoxActive) {
                    showCursorTail = true;
                    window.showCursorTail = true;
                    updateCursorTrailStatus(true);
                    clearCursorTrail();
                    updateCursorTrail(pointer, getPixelCoordinatesFromCanvasPoint(pointer)); // Render initial point only if BBox not active
                    logMessage('Mouse down - cursor trail visualization activated', 'DEBUG');
                } else {
                    showCursorTail = false; // Ensure trail is visually off if BBox is active
                    window.showCursorTail = false;
                    updateCursorTrailStatus(false, true); // Set status to READY (since checkbox is checked)
                    clearCursorTrail(); // Ensure no residual dots
                    logMessage('Mouse down - BBox active, cursor trail visualization suppressed', 'DEBUG');
                }
            } else {
                logMessage('Mouse down - cursor trail visualization disabled by user preference', 'DEBUG');
            }
        }
    });
    
    // Disable cursor trail when mouse button released
    canvas.on('mouse:up', function(options) {
        if (options.e.button === 0) { // Only care about left button release
            isMouseDown = false;
            const pointer = canvas.getPointer(options.e); // Canvas Coords
            const pixelCoords = getPixelCoordinatesFromCanvasPoint(pointer); // Pixel Coords

            // *** NEW: Finalize laser pointer event ***
            // Check if the laser tool was active just before mouse up
            const wasLaserToolActive = (document.getElementById('tool-laser')?.classList.contains('active'));
            if (wasLaserToolActive && typeof window.finalizeLaserPointerEvent === 'function' && pixelCoords) {
                window.finalizeLaserPointerEvent(pixelCoords);
            }

            if (window.cursorTrailEnabled) {
                showCursorTail = false;
                window.showCursorTail = false;
                updateCursorTrailStatus(false, true); // Pass true to indicate it's ready state
                clearCursorTrail(); // Clear the visual trail
                logMessage('Mouse up - cursor trail visualization deactivated', 'DEBUG');
            }
        }
    });
    
    // Reset positioning when mouse enters
    canvas.on('mouse:over', function() {
        // Clear any previous trail
        cursorTrailPoints = [];
        logMessage('Mouse entered canvas', 'DEBUG');
    });
    
    // Clean up when mouse leaves
    canvas.on('mouse:out', function() {
        isMouseDown = false;
        showCursorTail = false;
        window.showCursorTail = false;
        
        // Update status to inactive or ready depending on checkbox state
        updateCursorTrailStatus(false, window.cursorTrailEnabled);
        
        // Clear the trail
        clearCursorTrail();
        
        logMessage('Mouse left canvas - cursor trail disabled', 'DEBUG');
    });
    
    // Start the periodic trail update
    startCursorTrailUpdate();
    
    // Completely disable panning on the canvas element directly
    const canvasEl = canvas.getElement();
    
    // Add direct event listeners to the canvas element
    canvasEl.addEventListener('mousedown', function(e) {
        // Only handle left mouse button
        if (e.button === 0) {
            // Prevent default to disable panning
            e.preventDefault();
        }
    }, { passive: false });
    
    canvasEl.addEventListener('mousemove', function(e) {
        // Prevent panning
        if (e.buttons === 1) { // Left button pressed during move
            e.preventDefault();
        }
    }, { passive: false });
    
    // Also add listeners to the upper canvas to ensure capturing all events
    canvas.upperCanvasEl.addEventListener('mousedown', function(e) {
        // Prevent panning
        e.preventDefault();
    }, { passive: false });
    
    logMessage('Cursor trail tracking enabled with left mouse button activation', 'INFO');
    logMessage('Panning completely disabled on canvas', 'INFO');
}

/**
 * Start the periodic cursor trail update
 */
function startCursorTrailUpdate() {
    // Update trail opacity/lifetime every 50ms
    cursorTrailUpdateTimer = setInterval(function() {
        updateTrailOpacity();
        renderCursorTrail();
    }, 50);
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
 * Update the opacity of cursor trail points to create a fading effect
 */
function updateTrailOpacity() {
    if (!showCursorTail || cursorTrailPoints.length === 0) return;
    
    const now = Date.now();
    
    // Update opacity of each point based on age
    cursorTrailPoints.forEach(point => {
        const age = now - point.time;
        // Linear fade based on age over 1 second
        point.opacity = Math.max(0, 1 - (age / CURSOR_TRAIL_DURATION));
    });
}

/**
 * Remove old trail points that have completely faded
 */
function cleanupCursorTrail() {
    if (cursorTrailPoints.length === 0) return;
    
    const now = Date.now();
    
    // Remove points older than CURSOR_TRAIL_DURATION
    cursorTrailPoints = cursorTrailPoints.filter(point => {
        return (now - point.time) < CURSOR_TRAIL_DURATION;
    });
}

/**
 * Render the cursor trail on canvas
 */
function renderCursorTrail() {
    if (!showCursorTail || !window.canvas) return;
    
    const canvas = window.canvas;
    
    // Remove any existing cursor trail objects
    const existingTrail = canvas.getObjects().filter(obj => obj.isCursorTrail);
    existingTrail.forEach(obj => canvas.remove(obj));
    
    // Only render if we have points
    if (cursorTrailPoints.length === 0) return;
    
    // Get the current cursor size from either window or local variable
    const currentCursorSize = window.cursorSize || cursorSize;
    
    // Draw dots with decreasing saliency for each point
    cursorTrailPoints.forEach((point, index) => {
        if (point.opacity <= 0.05) return; // Skip nearly invisible points
        
        // Calculate size based on opacity (decreasing size as the point ages)
        const dotSize = currentCursorSize * point.opacity;
        
        // *** Use CANVAS coordinates (cx, cy) for rendering ***
        const circle = new fabric.Circle({
            left: point.cx - dotSize/2,
            top: point.cy - dotSize/2,
            radius: dotSize/2,
            fill: `rgba(255, 0, 0, ${point.opacity * 0.6})`,
            stroke: `rgba(255, 0, 0, ${point.opacity})`,
            strokeWidth: 1 * point.opacity, // Thinner stroke for older points
            selectable: false,
            evented: false,
            isCursorTrail: true
        });
        
        canvas.add(circle);
    });
    
    // Always add the current cursor position with full opacity
    if (cursorTrailPoints.length > 0) {
        const lastPoint = cursorTrailPoints[cursorTrailPoints.length - 1];
        // *** Use CANVAS coordinates (cx, cy) for rendering ***
        const currentCursor = new fabric.Circle({
            left: lastPoint.cx - currentCursorSize/2,
            top: lastPoint.cy - currentCursorSize/2,
            radius: currentCursorSize/2,
            fill: 'rgba(255, 0, 0, 0.6)',
            stroke: 'rgba(255, 0, 0, 1)',
            strokeWidth: 2,
            selectable: false,
            evented: false,
            isCursorTrail: true
        });
        
        canvas.add(currentCursor);
    }
    
    canvas.renderAll();
}

/**
 * Update cursor trail with current pointer position
 * @param {Object} pointer - The canvas pointer coordinates {x, y}
 * @param {Object} pixelCoords - The corresponding image pixel coordinates {x, y}
 */
function updateCursorTrail(pointer, pixelCoords) { // Modified signature
    if (!showCursorTail || !pixelCoords) return; // Check pixelCoords validity
    
    const now = Date.now();
    
    // Store current position (canvas coordinates)
    // lastKnownMousePosition = { x: pointer.x, y: pointer.y }; // Can be removed if not used elsewhere
    
    // Check if mouse has moved at least 3 pixels from the last logged point (using canvas coords for move check)
    const lastPoint = cursorTrailPoints.length > 0 ? 
        cursorTrailPoints[cursorTrailPoints.length - 1] :
        // Use canvas coords for initial offset check
        { cx: pointer.x - 10, cy: pointer.y - 10, time: 0 }; 
    
    // Calculate distance using canvas coordinates for visual spacing
    const distance = calculateDistance({x: pointer.x, y: pointer.y}, {x: lastPoint.cx, y: lastPoint.cy});
    
    // Only add a new point if movement exceeds the pixel threshold (3px)
    if (distance >= 3) {
        // *** Store BOTH canvas and pixel coordinates ***
        cursorTrailPoints.push({
            cx: pointer.x,
            cy: pointer.y,
            px: pixelCoords.x,
            py: pixelCoords.y,
            time: now,
            opacity: 1
        });
        
        // Log the position (displaying pixel coords for consistency)
        if (typeof logMessage === 'function') {
            logMessage(`Cursor trail updated: Canvas(X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}) Pixel(X: ${pixelCoords.x}, Y: ${pixelCoords.y})`, 'DEBUG');
        }
        
        // IMPORTANT: Send PIXEL coordinates to the recording system
        if (typeof window.updateCursorTrailPosition === 'function' && typeof window.isRecording === 'function' && window.isRecording()) {
            // *** START DIAGNOSTIC LOGGING ***
            console.log(`RECORDING COORDS (Pixel): X=${pixelCoords.x}, Y=${pixelCoords.y}`);
            // *** END DIAGNOSTIC LOGGING ***
            window.updateCursorTrailPosition(pixelCoords.x, pixelCoords.y);
            logMessage(`Sent PIXEL cursor position to recording system: X: ${pixelCoords.x}, Y: ${pixelCoords.y}`, 'DEBUG');
        }
        
        // Render the updated trail (uses cx, cy internally)
        renderCursorTrail();
        
        // Periodically clean up old points
        if (now - lastTrailCleanup > 200) {
            cleanupCursorTrail();
            lastTrailCleanup = now;
        }
    }
}

/**
 * Clear all cursor trail points and remove them from the canvas
 */
function clearCursorTrail() {
    // Clear trail points array
    cursorTrailPoints = [];
    
    // Remove trail objects from canvas
    if (window.canvas) {
        const existingTrail = window.canvas.getObjects().filter(obj => obj.isCursorTrail);
        existingTrail.forEach(obj => window.canvas.remove(obj));
        window.canvas.renderAll();
    }
}

/**
 * Update the UI to reflect cursor trail status
 * @param {boolean} active - Whether the cursor trail is active
 * @param {boolean} ready - Whether the cursor trail is ready (checkbox checked)
 */
function updateCursorTrailStatus(active, ready = false) {
    // Update status in UI
    const statusEl = document.getElementById('cursor-trail-status');
    if (statusEl) {
        if (active) {
            statusEl.textContent = 'ACTIVE';
            statusEl.className = 'ms-2 badge status-active';
        } else if (ready) {
            statusEl.textContent = 'READY';
            statusEl.className = 'ms-2 badge bg-warning';
    } else {
            statusEl.textContent = 'INACTIVE';
            statusEl.className = 'ms-2 badge status-inactive';
        }
    }
    
    // Update cursor size slider state
    const cursorSizeSlider = document.getElementById('cursor-size');
    if (cursorSizeSlider) {
        cursorSizeSlider.disabled = !active && !ready;
    }
}

console.log('=== canvas.js: LOADING COMPLETED ==='); 