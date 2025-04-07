/**
 * Drawing tools functionality for annotations
 * This contains laser pointer and cursor trail related functionality.
 */

// State for laser pointer trail
let currentLaserTrail = null;

// State variables
let boundingBoxActive = false;
let currentBoundingBox = null;
let boundingBoxStartPoint = null;
let activeBoundingBox = null; // Track the active (completed) bounding box
let boundingbox_mode = 'corners'; // Use a single variable for mode: 'corners' or 'pointer'

/**
 * Show laser pointer usage notification
 */
function showLaserPointerNotification() {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'alert alert-warning position-fixed top-50 start-50 translate-middle';
    notification.style.zIndex = '9999';
    notification.style.maxWidth = '400px';
    notification.innerHTML = `
        <div class="text-center">
            <h5>Laser Pointer Mode Active</h5>
            <p>Click and drag on the image to use the laser pointer.</p>
            <p>The laser pointer is automatically activated when you press the left mouse button.</p>
            <button class="btn btn-sm btn-primary" id="close-laser-notification">Got it!</button>
        </div>
    `;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Add event listener to close button
    document.getElementById('close-laser-notification').addEventListener('click', function() {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
    
    // Auto-remove after 5 seconds
    setTimeout(function() {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
    
    if (typeof logMessage === 'function') {
        logMessage('Laser pointer notification shown', 'DEBUG');
    }
}

/**
 * Start a new laser pointer trail during replay
 */
function startLaserTrail() {
    if (typeof logMessage === 'function') {
        logMessage('Starting laser pointer trail', 'DEBUG');
    }
    
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
            if (typeof logMessage === 'function') {
                logMessage('Created new laser trail container', 'DEBUG');
            }
        } else {
            if (typeof logMessage === 'function') {
                logMessage('Error: Cannot find canvas container for laser trail', 'ERROR');
            }
        }
    }
    
    // Make it visible
    trailContainer.style.display = 'block';
    
    // Initialize trail points array for this session
    window.currentLaserTrail = [];
    currentLaserTrail = [];
    
    if (typeof logMessage === 'function') {
        logMessage('Laser pointer trail initialized', 'DEBUG');
    }
}

/**
 * Add a point to the laser trail during replay
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
function addToLaserTrail(x, y) {
    if (x === undefined || y === undefined) {
        if (typeof logMessage === 'function') {
            logMessage('Error: Invalid coordinates for laser trail', 'ERROR');
        }
        return;
    }
    
    // Initialize the trail array if it doesn't exist
    if (!window.currentLaserTrail) {
        window.currentLaserTrail = [];
        currentLaserTrail = [];
        if (typeof logMessage === 'function') {
            logMessage('Initializing laser trail array', 'DEBUG');
        }
    }
    
    // Add point to the trail
    const point = { 
        x: x, 
        y: y,
        time: Date.now() // Add timestamp for aging effect
    };
    
    window.currentLaserTrail.push(point);
    currentLaserTrail.push(point);
    
    // Keep only the last 20 points to avoid performance issues
    if (window.currentLaserTrail.length > 20) {
        window.currentLaserTrail.shift();
    }
    
    if (currentLaserTrail.length > 20) {
        currentLaserTrail.shift();
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
        if (typeof logMessage === 'function') {
            logMessage('Error: Cannot find laser trail container', 'ERROR');
        }
        return;
    }
    
    // Use either the window-level or local trail data
    const trail = window.currentLaserTrail || currentLaserTrail;
    
    if (!trail || trail.length === 0) {
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
    trail.forEach((point, index, array) => {
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
    if (typeof logMessage === 'function') {
        logMessage('Clearing laser trail', 'DEBUG');
    }
    
    const trailContainer = document.getElementById('laser-trail-container');
    if (trailContainer) {
        trailContainer.innerHTML = '';
    } else {
        if (typeof logMessage === 'function') {
            logMessage('Warning: Laser trail container not found for clearing', 'WARN');
        }
    }
    
    window.currentLaserTrail = null;
    currentLaserTrail = null;
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
        if (typeof logMessage === 'function') {
            logMessage('Replay cursor element not found!', 'ERROR');
        }
        return;
    }
    
    // Get canvas position and scale
    const canvas = window.canvas;
    if (!canvas) {
        if (typeof logMessage === 'function') {
            logMessage('Canvas not available for replay', 'ERROR');
        }
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
    
    // Enhanced debugging for laser pointer events
    if (dataPoint.isLaserPointer === true) {
        if (dataPoint.type !== 'move') {
            if (typeof logMessage === 'function') {
                logMessage(`Laser pointer ${dataPoint.type} event at (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
            }
        }
    }
    
    // Show cursor events 
    if (dataPoint.type === 'down') {
        // Mouse down - make cursor larger and more opaque
        cursor.style.width = `${largerSize}px`;
        cursor.style.height = `${largerSize}px`;
        cursor.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        
        // If this is a laser pointer activation, start drawing the trail
        if (dataPoint.isLaserPointer) {
            if (typeof logMessage === 'function') {
                logMessage(`Starting laser trail at DOWN event: (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
            }
            startLaserTrail();
        }
    } else if (dataPoint.type === 'up') {
        // Mouse up - return to normal
        cursor.style.width = `${cursorSize}px`;
        cursor.style.height = `${cursorSize}px`;
        cursor.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
        
        // If this is a laser pointer deactivation, clear the trail
        if (dataPoint.isLaserPointer) {
            if (typeof logMessage === 'function') {
                logMessage(`Clearing laser trail at UP event: (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
            }
            clearLaserTrail();
        }
    } else if (dataPoint.type === 'move' && dataPoint.isLaserPointer) {
        // Log only occasionally to avoid flooding
        if (Math.random() < 0.05 && typeof logMessage === 'function') {
            logMessage(`Adding to laser trail at MOVE event: (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
        }
        
        // If this is a laser pointer movement, add to the trail
        addToLaserTrail(x, y);
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
 * Set the bounding box mode (pointer or draw)
 * @param {string} mode - The mode to set ('pointer' or 'draw')
 */
function setBoundingBoxMode(mode) {
    if (mode === 'pointer' || mode === 'corners') {
        boundingbox_mode = mode;
        if (typeof logMessage === 'function') {
            logMessage(`Bounding box ${mode} mode activated`, 'INFO');
        }
    } else {
        if (typeof logMessage === 'function') {
            logMessage(`Invalid boundingbox_mode: ${mode}`, 'ERROR');
        }
    }
}

/**
 * Initialize the bounding box functionality
 */
function initBoundingBox() {
    if (typeof logMessage === 'function') {
        logMessage('Initializing bounding box mode', 'DEBUG');
    }
    
    // Make sure the canvas is initialized
    if (!window.canvas) {
        if (typeof logMessage === 'function') {
            logMessage('Canvas not available for bounding box', 'ERROR');
        }
        return;
    }
    
    boundingBoxActive = true;
    
    // Show a notification about bounding box mode
    showBoundingBoxNotification();
    
    // Set up the canvas for bounding box creation
    window.canvas.on('mouse:down', handleBoundingBoxMouseDown);
    window.canvas.on('mouse:move', handleBoundingBoxMouseMove);
    window.canvas.on('mouse:up', handleBoundingBoxMouseUp);
    
    if (typeof logMessage === 'function') {
        logMessage('Bounding box mode activated', 'INFO');
    }
}

/**
 * Deactivate the bounding box mode
 */
function deactivateBoundingBox() {
    boundingBoxActive = false;
    
    // Remove event listeners
    if (window.canvas) {
        window.canvas.off('mouse:down', handleBoundingBoxMouseDown);
        window.canvas.off('mouse:move', handleBoundingBoxMouseMove);
        window.canvas.off('mouse:up', handleBoundingBoxMouseUp);
    }
    
    // Clear references but don't remove existing box
    currentBoundingBox = null;
    boundingBoxStartPoint = null;
    
    if (typeof logMessage === 'function') {
        logMessage('Bounding box mode deactivated', 'INFO');
    }
}

/**
 * Remove any existing bounding box from the canvas
 */
function removeExistingBoundingBox() {
    if (activeBoundingBox && window.canvas) {
        if (typeof logMessage === 'function') {
            logMessage('Removing existing bounding box', 'DEBUG');
        }
        
        window.canvas.remove(activeBoundingBox);
        activeBoundingBox = null;
    }
}

/**
 * Show a notification about bounding box mode
 */
function showBoundingBoxNotification() {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'alert alert-info position-fixed top-50 start-50 translate-middle';
    notification.style.zIndex = '9999';
    notification.style.maxWidth = '400px';
    notification.innerHTML = `
        <div class="text-center">
            <h5>Bounding Box Mode Active</h5>
            <p>Current mode: <strong>${boundingbox_mode === 'corners' ? 'Corners' : 'Pointer'}</strong></p>
            <p>${boundingbox_mode === 'corners' ? 
                'Click and drag on the image to create a bounding box. Only one bounding box can exist at a time.' : 
                'Click on the bounding box to select it. Use pointer mode to interact with the box.'}</p>
            <button class="btn btn-sm btn-primary" id="close-bounding-box-notification">Got it!</button>
        </div>
    `;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Add event listener to close button
    document.getElementById('close-bounding-box-notification').addEventListener('click', function() {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
    
    // Auto-remove after 5 seconds
    setTimeout(function() {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
    
    if (typeof logMessage === 'function') {
        logMessage('Bounding box notification shown', 'DEBUG');
    }
}

/**
 * Handle mouse down event for bounding box
 * @param {Event} event - Fabric.js mouse event
 */
function handleBoundingBoxMouseDown(event) {
    if (!boundingBoxActive) return;
    
    // Get canvas pointer coordinates
    const pointer = window.canvas.getPointer(event.e);
    
    // In pointer mode, just check if we clicked on the active bounding box
    if (boundingbox_mode === 'pointer') {
        // We'll implement pointer mode functionality later
        if (typeof logMessage === 'function') {
            logMessage(`Pointer mode: Click at (${Math.round(pointer.x)}, ${Math.round(pointer.y)})`, 'DEBUG');
        }
        return;
    }
    
    // Only proceed with drawing in draw mode
    if (boundingbox_mode !== 'corners') return;
    
    // Remove any existing bounding box before creating a new one
    removeExistingBoundingBox();
    
    // Store the starting point
    boundingBoxStartPoint = {
        x: pointer.x,
        y: pointer.y
    };
    
    // Create a new bounding box
    currentBoundingBox = new fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: 'rgba(0, 0, 255, 0.2)',
        stroke: 'blue',
        strokeWidth: 2,
        selectable: true,
        hasControls: true,
        hasBorders: true,
        transparentCorners: false,
        cornerColor: 'blue',
        cornerSize: 10,
        cornerStyle: 'circle',
        // Enable all control points
        lockMovementX: false,
        lockMovementY: false,
        lockRotation: true, // No rotation for bounding box
        lockScalingX: false,
        lockScalingY: false,
        lockUniScaling: false
    });
    
    // Add the box to the canvas
    window.canvas.add(currentBoundingBox);
    
    if (typeof logMessage === 'function') {
        logMessage(`Started drawing bounding box at (${Math.round(pointer.x)}, ${Math.round(pointer.y)})`, 'DEBUG');
    }
    
    // Capture the event for recording if recording is active
    if (typeof window.captureMouseDownDirect === 'function') {
        window.captureMouseDownDirect(pointer.x, pointer.y, 0);
    }
}

/**
 * Handle mouse move event for bounding box
 * @param {Event} event - Fabric.js mouse event
 */
function handleBoundingBoxMouseMove(event) {
    if (!boundingBoxActive) return;
    
    // In pointer mode, just handle moving the cursor
    if (boundingbox_mode === 'pointer') {
        // Pointer mode functionality will be implemented later
        return;
    }
    
    // Only proceed with drawing in draw mode
    if (boundingbox_mode !== 'corners' || !currentBoundingBox || !boundingBoxStartPoint) return;
    
    // Get canvas pointer coordinates
    const pointer = window.canvas.getPointer(event.e);
    
    // Calculate width and height based on mouse position
    let width = pointer.x - boundingBoxStartPoint.x;
    let height = pointer.y - boundingBoxStartPoint.y;
    
    // Handle negative dimensions (dragging left or up)
    if (width < 0) {
        currentBoundingBox.set('left', pointer.x);
        width = Math.abs(width);
    }
    
    if (height < 0) {
        currentBoundingBox.set('top', pointer.y);
        height = Math.abs(height);
    }
    
    // Update the bounding box dimensions
    currentBoundingBox.set({
        width: width,
        height: height
    });
    
    // Refresh the canvas
    window.canvas.renderAll();
    
    // Update coordinates display
    updateCoordinatesDisplay(Math.round(pointer.x), Math.round(pointer.y));
    
    // Log occasionally to prevent spam
    if (Math.random() < 0.05 && typeof logMessage === 'function') {
        logMessage(`Drawing bounding box: width=${Math.round(width)}, height=${Math.round(height)}`, 'DEBUG');
    }
    
    // Capture the event for recording if recording is active
    if (typeof window.updateCursorTrailPosition === 'function') {
        window.updateCursorTrailPosition(pointer.x, pointer.y);
    }
}

/**
 * Handle mouse up event for bounding box
 * @param {Event} event - Fabric.js mouse event
 */
function handleBoundingBoxMouseUp(event) {
    if (!boundingBoxActive || !currentBoundingBox) return;
    
    // Get canvas pointer coordinates
    const pointer = window.canvas.getPointer(event.e);
    
    if (typeof logMessage === 'function') {
        logMessage(`Completed bounding box: width=${Math.round(currentBoundingBox.width)}, height=${Math.round(currentBoundingBox.height)}`, 'INFO');
    }
    
    // Make sure the box has some minimum size
    if (currentBoundingBox.width < 5 || currentBoundingBox.height < 5) {
        // Box is too small, remove it
        window.canvas.remove(currentBoundingBox);
        if (typeof logMessage === 'function') {
            logMessage('Bounding box too small, removed', 'DEBUG');
        }
        
        // Reset tracking variables
        currentBoundingBox = null;
        boundingBoxStartPoint = null;
        activeBoundingBox = null; // No active box
    } else {
        // Set the current box as the active bounding box
        activeBoundingBox = currentBoundingBox;
        
        // Set the box as the active object so it can be immediately resized
        window.canvas.setActiveObject(currentBoundingBox);
        
        // Reset drawing state
        currentBoundingBox = null;
        boundingBoxStartPoint = null;
    }
    
    // Capture the event for recording if recording is active
    if (typeof window.captureMouseUpDirect === 'function') {
        window.captureMouseUpDirect(pointer.x, pointer.y, 0);
    }
    
    // Refresh the canvas
    window.canvas.renderAll();
}

// Direct mouse event capture functions for cursor trail system
window.captureMouseDownDirect = function(x, y, button) {
    // Check if recording is active using the global functions
    if (typeof window.isRecording !== 'function' || typeof window.isPaused !== 'function') {
        return;
    }
    
    if (!window.isRecording() || window.isPaused()) return;
    
    // Ensure coordinates are valid
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
        console.error(`Invalid mouse down position: x=${x}, y=${y}`);
        return;
    }
    
    const now = Date.now();
    const elapsedTimeMs = typeof window.getCurrentRecordingTime === 'function' ? 
        window.getCurrentRecordingTime() : now;
    
    // Log that we're capturing this event
    if (typeof logMessage === 'function') {
        logMessage(`Direct capture of mouse down: X: ${Math.round(x)}, Y: ${Math.round(y)}, button: ${button}`, 'DEBUG');
    }
    
    // Store in mouse data if the global mouseData array exists
    if (window.mouseData && Array.isArray(window.mouseData)) {
        window.mouseData.push({
            type: 'down',
            button: button,
            x: x,
            y: y,
            timeOffset: elapsedTimeMs,
            realTime: now,
            isLaserPointer: true, // Since this comes from cursor trail system
            source: 'direct' // Mark the source
        });
        
        if (typeof logMessage === 'function') {
            logMessage(`Mouse DOWN event recorded at ${elapsedTimeMs}ms (data point #${window.mouseData.length})`, 'DEBUG');
        }
    }
};

window.captureMouseUpDirect = function(x, y, button) {
    // Check if recording is active using the global functions
    if (typeof window.isRecording !== 'function' || typeof window.isPaused !== 'function') {
        return;
    }
    
    if (!window.isRecording() || window.isPaused()) return;
    
    // Ensure coordinates are valid
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
        console.error(`Invalid mouse up position: x=${x}, y=${y}`);
        return;
    }
    
    const now = Date.now();
    const elapsedTimeMs = typeof window.getCurrentRecordingTime === 'function' ? 
        window.getCurrentRecordingTime() : now;
    
    // Log that we're capturing this event
    if (typeof logMessage === 'function') {
        logMessage(`Direct capture of mouse up: X: ${Math.round(x)}, Y: ${Math.round(y)}, button: ${button}`, 'DEBUG');
    }
    
    // Store in mouse data if the global mouseData array exists
    if (window.mouseData && Array.isArray(window.mouseData)) {
        window.mouseData.push({
            type: 'up',
            button: button,
            x: x,
            y: y,
            timeOffset: elapsedTimeMs,
            realTime: now,
            isLaserPointer: true, // Since this comes from cursor trail system
            source: 'direct' // Mark the source
        });
        
        if (typeof logMessage === 'function') {
            logMessage(`Mouse UP event recorded at ${elapsedTimeMs}ms (data point #${window.mouseData.length})`, 'DEBUG');
        }
    }
};

// Add hook to capture cursor trail updates directly
window.updateCursorTrailPosition = function(x, y) {
    // Check if recording is active using the global functions
    if (typeof window.isRecording !== 'function' || typeof window.isPaused !== 'function') {
        return;
    }
    
    // If we are recording, also store this position in the mouse data
    if (window.isRecording() && !window.isPaused()) {
        const now = Date.now();
        // Don't throttle laser pointer movements for better trail quality
        const isLaserActive = true; // If this function is called, we know laser is active
        
        // Get elapsed recording time
        const elapsedTimeMs = typeof window.getCurrentRecordingTime === 'function' ? 
            window.getCurrentRecordingTime() : now;
        
        // Ensure x and y are valid numbers
        if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
            console.error(`Invalid cursor position: x=${x}, y=${y}`);
            return;
        }
        
        // Store mouse data with timestamp if the global mouseData array exists
        if (window.mouseData && Array.isArray(window.mouseData)) {
            window.mouseData.push({
                type: 'move',
                x: x,
                y: y,
                timeOffset: elapsedTimeMs, // Time in ms from recording start
                realTime: now,
                isLaserPointer: isLaserActive, // This is definitely a laser pointer movement
                source: 'cursorTrail' // Mark the source of this data point
            });
            
            // Log occasionally to prevent log spam
            if (now % 1000 < 20 && typeof logMessage === 'function') {
                logMessage(`Captured cursor trail position: X: ${Math.round(x)}, Y: ${Math.round(y)}`, 'DEBUG');
                logMessage(`Total mouse data points: ${window.mouseData.length}`, 'DEBUG');
            }
        }
    }
};

// Export functions for use in recording.js
window.DrawingTools = {
    showLaserPointerNotification,
    startLaserTrail,
    addToLaserTrail,
    drawLaserTrail,
    clearLaserTrail,
    createReplayCursor,
    updateReplayCursor,
    hideReplayCursor,
    updateCoordinatesDisplay,
    // Add the new bounding box functions to the export
    initBoundingBox,
    deactivateBoundingBox,
    removeExistingBoundingBox,
    setBoundingBoxMode,
    showBoundingBoxNotification
}; 