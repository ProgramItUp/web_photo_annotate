/**
 * Canvas-related functionality for the image annotation application
 */

// State variables
let canvas;
let isPanning = false;
let lastPosX;
let lastPosY;
let zoomLevel = 1;
let showCursorTail = false;
let cursorTrailPoints = [];
let cursorSize = DEFAULT_CURSOR_SIZE;
let lastKnownMousePosition = { x: 0, y: 0 };
let lastLoggedMousePosition = { x: 0, y: 0 };
const MOUSE_POSITION_TOLERANCE = 3; // Log when position changes by more than 3 pixels
const CURSOR_TRAIL_DURATION = 1000; // Trail duration in milliseconds (1 second)
let cursorTrailUpdateTimer; // Timer for updating cursor trail

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
 * Initialize the canvas
 */
function initializeCanvas() {
    canvas = new fabric.Canvas('canvas', {
        width: document.getElementById('image-container').offsetWidth,
        height: 400,
        selection: true,
        preserveObjectStacking: true // Keep objects stacked in the order they were added
    });
    
    // Add mouse event listeners
    canvas.on('mouse:move', updateCoordinates);
    canvas.on('mouse:over', canvasMouseEnter);
    canvas.on('mouse:out', canvasMouseLeave);
    
    // Also add direct DOM event listeners for more reliable tracking
    canvas.wrapperEl.addEventListener('mousemove', function(e) {
        // Convert from DOM coordinates to canvas coordinates
        const rect = canvas.upperCanvasEl.getBoundingClientRect();
        const pointer = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        updateCoordinatesDirect(pointer);
    });
    
    // Setup pan and zoom handlers
    setupPanZoomHandlers();
    
    // Set default tool
    setTool('select');
    
    // Set up timer to update cursor trail regularly
    cursorTrailUpdateTimer = setInterval(updateTrailOpacity, 50); // Update every 50ms
    
    logMessage('Canvas initialized');
}

/**
 * Resize the canvas to fit the container
 */
function resizeCanvas() {
    canvas.setWidth(document.getElementById('image-container').offsetWidth);
    canvas.renderAll();
}

/**
 * Setup pan and zoom event handlers for the canvas
 */
function setupPanZoomHandlers() {
    // Pan with Ctrl+click and drag
    canvas.on('mouse:down', function(opt) {
        if (opt.e.ctrlKey) {
            isPanning = true;
            canvas.selection = false;
            lastPosX = opt.e.clientX;
            lastPosY = opt.e.clientY;
            canvas.setCursor('grabbing');
        }
    });
    
    canvas.on('mouse:move', function(opt) {
        if (isPanning && opt.e.ctrlKey) {
            const deltaX = opt.e.clientX - lastPosX;
            const deltaY = opt.e.clientY - lastPosY;
            lastPosX = opt.e.clientX;
            lastPosY = opt.e.clientY;
            
            // Move all objects together
            const objects = canvas.getObjects();
            objects.forEach(obj => {
                obj.left += deltaX;
                obj.top += deltaY;
                obj.setCoords();
            });
            
            canvas.renderAll();
        }
    });
    
    canvas.on('mouse:up', function() {
        if (isPanning) {
            isPanning = false;
            canvas.selection = true;
            canvas.setCursor('default');
        }
    });
    
    // Zoom with mouse wheel
    canvas.on('mouse:wheel', function(opt) {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        
        // Limit zoom level
        if (zoom > 20) zoom = 20;
        if (zoom < 0.1) zoom = 0.1;
        
        zoomLevel = zoom;
        
        // Calculate zoom point (mouse position)
        const point = new fabric.Point(opt.e.offsetX, opt.e.offsetY);
        
        // Apply zoom centered on mouse position
        canvas.zoomToPoint(point, zoom);
        
        opt.e.preventDefault();
        opt.e.stopPropagation();
    });
}

/**
 * Update cursor size from slider
 */
function updateCursorSize() {
    cursorSize = parseInt(document.getElementById('cursor-size').value);
    
    // Update cursor trail if it exists
    if (canvas.getActiveObject() && canvas.getActiveObject().type === 'circle' && canvas.getActiveObject().id === 'cursor') {
        canvas.getActiveObject().set({
            radius: cursorSize / 2
        });
        canvas.renderAll();
    }
    
    logMessage(`Cursor size set to ${cursorSize}`);
}

/**
 * Handle mouse enter event
 * @param {Object} options - The fabric.js event object
 */
function canvasMouseEnter(options) {
    logMessage('Mouse entered canvas');
    
    // Initialize or update lastLoggedMousePosition when the mouse enters
    const pointer = canvas.getPointer(options.e);
    lastLoggedMousePosition = {
        x: pointer.x,
        y: pointer.y
    };
    
    // Additional logic for mouse enter
}

/**
 * Handle mouse leave event
 * @param {Object} options - The fabric.js event object
 */
function canvasMouseLeave(options) {
    logMessage('Mouse left canvas');
    // Update coordinates to show that mouse is outside
    document.getElementById('coordinates').textContent = 'Mouse: outside canvas';
}

/**
 * Update coordinates display directly (from DOM events)
 * @param {Object} pointer - The pointer coordinates
 */
function updateCoordinatesDirect(pointer) {
    const imageCoords = transformCoordinates(pointer);
    document.getElementById('coordinates').textContent = `Mouse: X: ${Math.round(imageCoords.x)}, Y: ${Math.round(imageCoords.y)}`;
    
    // Update global mouse position tracker
    lastKnownMousePosition = {
        x: pointer.x,
        y: pointer.y
    };
    
    // Check if significant movement and log if needed
    checkAndLogMouseMovement(lastKnownMousePosition);
    
    // Update cursor trail if enabled
    if (showCursorTail) {
        updateCursorTrail(pointer);
    }
}

/**
 * Update coordinates display when mouse moves over canvas
 * @param {Object} options - The fabric.js event object
 */
function updateCoordinates(options) {
    if (!options || !options.e) return;
    
    const pointer = canvas.getPointer(options.e);
    const imageCoords = transformCoordinates(pointer);
    document.getElementById('coordinates').textContent = `Mouse: X: ${Math.round(imageCoords.x)}, Y: ${Math.round(imageCoords.y)}`;
    
    // Update global mouse position tracker
    lastKnownMousePosition = {
        x: pointer.x,
        y: pointer.y
    };
    
    // Check if significant movement and log if needed
    checkAndLogMouseMovement(lastKnownMousePosition);
    
    // Update cursor trail if enabled
    if (showCursorTail) {
        updateCursorTrail(pointer);
    }
    
    // No longer need random logging since we have tolerance-based logging
    
    // Record mouse data if tracking is active
    if (isRecording && !isPaused) {
        // We're only adding data 5 times per second, so we don't need to do it on every move
        // This is handled by the interval in toggleRecording()
    }
}

/**
 * Update cursor trail opacity periodically even when mouse is outside canvas
 */
function updateTrailOpacity() {
    if (showCursorTail && cursorTrailPoints.length > 0) {
        // Only update opacity without adding new points
        renderCursorTrail();
    }
}

/**
 * Render the cursor trail dots with current opacity values
 */
function renderCursorTrail() {
    // Clear existing trail
    const existingTrail = canvas.getObjects().filter(obj => obj.id && obj.id.startsWith('cursorTrail'));
    existingTrail.forEach(obj => canvas.remove(obj));
    
    // Only keep points from the last CURSOR_TRAIL_DURATION
    const trailTimeLimit = Date.now() - CURSOR_TRAIL_DURATION;
    cursorTrailPoints = cursorTrailPoints.filter(point => point.time > trailTimeLimit);
    
    // Draw trail as dots with decreasing opacity
    cursorTrailPoints.forEach((point, index) => {
        // Calculate age of point in milliseconds
        const age = Date.now() - point.time;
        // Calculate opacity based on age (newer points are more opaque)
        const opacity = 1 - (age / CURSOR_TRAIL_DURATION);
        // Calculate size based on age (newer points are larger)
        const size = Math.max(2, cursorSize / 3 * opacity * 2);
        
        const dot = new fabric.Circle({
            left: point.x,
            top: point.y,
            radius: size,
            fill: 'rgba(255, 0, 0, ' + opacity + ')',
            stroke: null,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
            id: 'cursorTrail_' + index
        });
        
        canvas.add(dot);
        dot.bringToFront();
    });
}

/**
 * Update the cursor trail visualization
 * @param {Object} pointer - The canvas pointer coordinates
 */
function updateCursorTrail(pointer) {
    // Add current point to trail
    cursorTrailPoints.push({
        x: pointer.x,
        y: pointer.y,
        time: Date.now()
    });
    
    // Render the trail
    renderCursorTrail();
} 