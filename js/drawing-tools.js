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
let pointerDragging = false; // Track if we're currently dragging in pointer mode
let minX, minY, maxX, maxY; // Min and max coordinates for pointer mode

/**
 * Show laser pointer usage notification
 * Disabled to avoid annoying popups
 */
function showLaserPointerNotification() {
    // Log mode activation but don't show UI notification
    if (typeof logMessage === 'function') {
        logMessage('Laser pointer mode activated', 'DEBUG');
    }
    
    // No UI notification displayed anymore
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
 * Dedicated function to handle bounding box events during replay
 * This is separate from cursor updates to ensure proper processing
 * @param {Object} dataPoint - Mouse data point with bounding box info
 */
function handleBoundingBoxReplay(dataPoint) {
    // Check for both legacy isBoundingBox property and new activeTool property
    if (!dataPoint || (dataPoint.isBoundingBox !== true && dataPoint.activeTool !== 'boundingBox')) {
        return false; // Not a bounding box event
    }
    
    // Log all bounding box events for debugging
    if (typeof logMessage === 'function') {
        logMessage(`Replaying bounding box: ${dataPoint.type}, mode=${dataPoint.boundingbox_mode}, coords=${JSON.stringify(dataPoint.boxCoords || {})}`, 'DEBUG');
        
        // Additional detailed logging for diagnosis
        const details = {
            isBoundingBox: dataPoint.isBoundingBox,
            activeTool: dataPoint.activeTool,
            type: dataPoint.type,
            mode: dataPoint.boundingbox_mode,
            hasCoords: !!dataPoint.boxCoords,
            source: dataPoint.source || 'unknown'
        };
        logMessage(`Bounding box event details: ${JSON.stringify(details)}`, 'DEBUG');
    }
    
    try {
        if (dataPoint.type === 'down') {
            // Create new bounding box on mouse down
            startReplayBoundingBox(dataPoint.x, dataPoint.y, dataPoint.boundingbox_mode);
            if (typeof logMessage === 'function') {
                logMessage(`Started bounding box replay at (${Math.round(dataPoint.x)},${Math.round(dataPoint.y)})`, 'INFO');
            }
            return true;
        } else if (dataPoint.type === 'move' && dataPoint.boxCoords) {
            // Update box on move events if we have box coordinates
            const result = updateReplayBoundingBox(dataPoint.boxCoords, dataPoint.boundingbox_mode);
            
            // Log occasional updates
            if (Math.random() < 0.1 && typeof logMessage === 'function') {
                logMessage(`Updated bounding box during replay: ${result ? 'SUCCESS' : 'FAILED'}`, 'DEBUG');
            }
            return result;
        } else if (dataPoint.type === 'up' && dataPoint.boxCoords) {
            // Final update on mouse up with box coordinates
            const result = updateReplayBoundingBox(dataPoint.boxCoords, dataPoint.boundingbox_mode);
            if (typeof logMessage === 'function') {
                logMessage(`Completed bounding box replay with dimensions: ${Math.round(dataPoint.boxCoords.width)}x${Math.round(dataPoint.boxCoords.height)}`, 'INFO');
            }
            return result;
        } else if (dataPoint.type === 'move' || dataPoint.type === 'up') {
            // Handle case where we have a move or up event without coordinates
            if (typeof logMessage === 'function') {
                logMessage(`Received ${dataPoint.type} event without boxCoords!`, 'WARN');
            }
            return false;
        }
    } catch (error) {
        if (typeof logMessage === 'function') {
            logMessage(`Error in bounding box replay: ${error.message}`, 'ERROR');
        }
        console.error('Bounding box replay error:', error);
    }
    
    return false; // Not processed
}

/**
 * Update the replay cursor position
 * @param {Object} dataPoint - Mouse data point with x, y coordinates
 */
function updateReplayCursor(dataPoint) {
    // Check for both the legacy isBoundingBox property and the new activeTool property
    const isBoundingBoxEvent = dataPoint.isBoundingBox === true || dataPoint.activeTool === 'boundingBox';
    
    // First, check if this is a bounding box event and handle it with the dedicated function
    if (isBoundingBoxEvent) {
        const handled = handleBoundingBoxReplay(dataPoint);
        if (handled) {
            // If it was handled by the bounding box handler, just update the cursor visual
            // but don't do the default cursor updates that would interfere
            const cursor = document.getElementById('replay-cursor');
            if (cursor) {
                cursor.style.left = `${dataPoint.x}px`;
                cursor.style.top = `${dataPoint.y}px`;
            }
            
            // Update coordinates display
            updateCoordinatesDisplay(Math.round(dataPoint.x), Math.round(dataPoint.y));
            
            // Log that we successfully handled a bounding box event
            if (typeof logMessage === 'function' && Math.random() < 0.1) {
                logMessage(`Handled bounding box event during replay: type=${dataPoint.type}`, 'DEBUG');
            }
            
            return;
        } else {
            // Log if a bounding box event wasn't successfully handled
            if (typeof logMessage === 'function') {
                logMessage(`Failed to handle bounding box event: type=${dataPoint.type}, mode=${dataPoint.boundingbox_mode || 'unknown'}`, 'WARN');
            }
        }
    }
    
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
    
    // Check if this is a laser pointer event (using both legacy and new properties)
    const isLaserPointerEvent = dataPoint.isLaserPointer === true || dataPoint.activeTool === 'laserPointer';
    
    // Make sure we don't process bounding box events as laser pointer events
    // This explicit check helps prevent any bugs where both flags might be set
    if (isBoundingBoxEvent) {
        // Skip laser pointer processing for bounding box events
        if (typeof logMessage === 'function' && Math.random() < 0.01) {
            logMessage(`Skipping laser pointer processing for bounding box event: ${dataPoint.type}`, 'DEBUG');
        }
        return;
    }
    
    // Handle laser pointer replay (existing code)
    if (isLaserPointerEvent) {
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
        if (isLaserPointerEvent) {
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
        if (isLaserPointerEvent) {
            if (typeof logMessage === 'function') {
                logMessage(`Clearing laser trail at UP event: (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
            }
            clearLaserTrail();
        }
    } else if (dataPoint.type === 'move' && isLaserPointerEvent) {
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
 * Start a bounding box during replay
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate 
 * @param {string} mode - The bounding box mode ('corners' or 'pointer')
 */
function startReplayBoundingBox(x, y, mode) {
    try {
        // Validate mode parameter
        if (!mode) {
            mode = 'corners'; // Default mode if not specified
            if (typeof logMessage === 'function') {
                logMessage('No bounding box mode specified, using default "corners" mode', 'WARN');
            }
        }
        
        if (typeof logMessage === 'function') {
            logMessage(`Starting replay bounding box: mode=${mode}, pos=(${Math.round(x)}, ${Math.round(y)})`, 'INFO');
        }
        
        // Remove any existing replay bounding box
        removeReplayBoundingBox();
        
        if (!window.canvas) {
            if (typeof logMessage === 'function') {
                logMessage('Cannot create replay bounding box: Canvas not available', 'ERROR');
            }
            return false;
        }
        
        // Validate coordinates
        if (isNaN(x) || isNaN(y)) {
            if (typeof logMessage === 'function') {
                logMessage(`Invalid coordinates for replay bounding box: x=${x}, y=${y}`, 'ERROR');
            }
            return false;
        }
        
        // Create a new bounding box for replay with more visible styling
        window.replayBoundingBox = new fabric.Rect({
            left: x,
            top: y,
            width: 1, // Start with 1px width to ensure visibility
            height: 1, // Start with 1px height to ensure visibility
            fill: 'rgba(0, 0, 255, 0.3)', // More visible blue fill
            stroke: 'blue',
            strokeWidth: 3, // Thicker stroke
            selectable: true,
            hasControls: true,
            hasBorders: true,
            transparentCorners: false,
            cornerColor: 'blue',
            cornerSize: 10,
            cornerStyle: 'circle',
            // Additional properties to ensure visibility and persistence
            evented: false, // Don't allow events to interfere with replay
            objectCaching: false, // Don't cache to ensure updates are visible
            excludeFromExport: true // Don't include in exports
        });
        
        // Add to canvas and ensure it's on top
        window.canvas.add(window.replayBoundingBox);
        window.canvas.bringToFront(window.replayBoundingBox);
        window.canvas.renderAll(); // Ensure it's rendered immediately
        
        // Set a flag to prevent accidental removal during replay
        window.replayBoundingBox.isReplayBox = true;
        
        if (typeof logMessage === 'function') {
            logMessage(`Created replay bounding box in ${mode} mode at (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
        }
        
        return true;
    } catch (error) {
        if (typeof logMessage === 'function') {
            logMessage(`Error creating replay bounding box: ${error.message}`, 'ERROR');
        }
        console.error('Error creating replay bounding box:', error);
        return false;
    }
}

/**
 * Update the replay bounding box with new coordinates
 * @param {Object} coords - The box coordinates
 * @param {string} mode - The bounding box mode
 */
function updateReplayBoundingBox(coords, mode) {
    try {
        if (!coords) {
            if (typeof logMessage === 'function') {
                logMessage('Missing coordinates for bounding box update', 'ERROR');
            }
            return false;
        }
        
        // Validate coordinates
        if (isNaN(coords.left) || isNaN(coords.top) || isNaN(coords.width) || isNaN(coords.height)) {
            if (typeof logMessage === 'function') {
                logMessage(`Invalid box coordinates: ${JSON.stringify(coords)}`, 'ERROR');
            }
            return false;
        }
        
        // Make sure width and height are not negative
        const width = Math.max(1, coords.width); // Minimum width of 1 to ensure visibility
        const height = Math.max(1, coords.height); // Minimum height of 1 to ensure visibility
        
        // Create if it doesn't exist
        if (!window.replayBoundingBox) {
            if (typeof logMessage === 'function') {
                logMessage(`Creating new bounding box during update: ${Math.round(width)}x${Math.round(height)}`, 'INFO');
            }
            
            window.replayBoundingBox = new fabric.Rect({
                left: coords.left,
                top: coords.top,
                width: width,
                height: height,
                fill: 'rgba(0, 0, 255, 0.3)', // More visible blue fill
                stroke: 'blue',
                strokeWidth: 3, // Thicker stroke for visibility
                selectable: true,
                hasControls: true,
                hasBorders: true,
                transparentCorners: false,
                cornerColor: 'blue',
                cornerSize: 10,
                cornerStyle: 'circle',
                evented: false, // Don't allow events to interfere with replay
                objectCaching: false // Don't cache to ensure updates are visible
            });
            
            // Set a flag to prevent accidental removal during replay
            window.replayBoundingBox.isReplayBox = true;
            
            // Add to canvas
            if (window.canvas) {
                window.canvas.add(window.replayBoundingBox);
                window.canvas.bringToFront(window.replayBoundingBox);
                
                if (typeof logMessage === 'function') {
                    logMessage(`Created new replay bounding box with dimensions: ${Math.round(width)}x${Math.round(height)}`, 'DEBUG');
                }
            } else {
                if (typeof logMessage === 'function') {
                    logMessage('Cannot create bounding box: Canvas not available', 'ERROR');
                }
                return false;
            }
        } else {
            // Update existing box
            window.replayBoundingBox.set({
                left: coords.left,
                top: coords.top,
                width: width,
                height: height
            });
            
            // Occasionally log the update
            if (Math.random() < 0.05 && typeof logMessage === 'function') {
                logMessage(`Updated replay bounding box to: ${Math.round(width)}x${Math.round(height)}`, 'DEBUG');
            }
        }
        
        // Refresh the canvas
        if (window.canvas) {
            // Always bring box to front to ensure visibility
            window.canvas.bringToFront(window.replayBoundingBox);
            window.canvas.renderAll();
            
            // Force the box to be visible
            if (window.replayBoundingBox && !window.replayBoundingBox.visible) {
                window.replayBoundingBox.visible = true;
                if (typeof logMessage === 'function') {
                    logMessage('Forced bounding box visibility', 'DEBUG');
                }
            }
            
            return true;
        } else {
            if (typeof logMessage === 'function') {
                logMessage('Cannot render bounding box: Canvas not available', 'ERROR');
            }
            return false;
        }
    } catch (error) {
        if (typeof logMessage === 'function') {
            logMessage(`Error updating replay bounding box: ${error.message}`, 'ERROR');
        }
        console.error('Error updating replay bounding box:', error);
        return false;
    }
}

/**
 * Remove the replay bounding box
 */
function removeReplayBoundingBox() {
    try {
        if (window.replayBoundingBox && window.canvas) {
            window.canvas.remove(window.replayBoundingBox);
            window.replayBoundingBox = null;
            
            if (typeof logMessage === 'function') {
                logMessage('Removed replay bounding box', 'DEBUG');
            }
            return true;
        }
        return false;
    } catch (error) {
        if (typeof logMessage === 'function') {
            logMessage(`Error removing replay bounding box: ${error.message}`, 'ERROR');
        }
        console.error('Error removing replay bounding box:', error);
        return false;
    }
}

/**
 * Hide the replay cursor
 * Only when replay is complete, not during replay
 * @param {boolean} isComplete - Whether the replay is complete (default: true)
 */
function hideReplayCursor(isComplete = true) {
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
    
    // Only remove bounding box and clear annotations if replay is complete
    if (isComplete) {
        // Log that we're doing final cleanup
        if (typeof logMessage === 'function') {
            logMessage('Replay complete - performing final cleanup', 'INFO');
        }
        
        // Remove any replay bounding box
        removeReplayBoundingBox();
        
        // Clean up any bounding boxes from annotations if needed
        if (typeof window.clearAnnotationsFromCanvas === 'function') {
            // Only run if we're not in recording mode (to avoid clearing during recording)
            if (typeof window.isRecording === 'function' && !window.isRecording()) {
                window.clearAnnotationsFromCanvas();
                logMessage('Cleared annotation objects after replay ended', 'DEBUG');
            }
        }
    } else {
        // During replay, just log that we're hiding cursor temporarily
        if (typeof logMessage === 'function' && cursor) {
            logMessage('Temporarily hiding replay cursor', 'DEBUG');
        }
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
 * Disabled to avoid annoying popups
 */
function showBoundingBoxNotification() {
    // Log mode activation but don't show UI notification
    if (typeof logMessage === 'function') {
        logMessage(`Bounding box mode activated: ${boundingbox_mode}`, 'DEBUG');
    }
    
    // No UI notification displayed anymore
}

/**
 * Handle mouse down event for bounding box
 * @param {Event} event - Fabric.js mouse event
 */
function handleBoundingBoxMouseDown(event) {
    if (!boundingBoxActive) return;
    
    // Get canvas pointer coordinates
    const pointer = window.canvas.getPointer(event.e);
    
    // Convert canvas coordinates to image pixel coordinates for recording
    const imageCoords = window.canvasToImageCoordinates(pointer.x, pointer.y);
    
    // In pointer mode, capture start of drag and initialize min/max values
    if (boundingbox_mode === 'pointer') {
        pointerDragging = true;
        
        // Initialize min/max with starting point (using canvas coordinates for display)
        minX = maxX = pointer.x;
        minY = maxY = pointer.y;
        
        // If there's no active bounding box, create one
        if (!activeBoundingBox) {
            activeBoundingBox = new fabric.Rect({
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
                lockRotation: true
            });
            
            window.canvas.add(activeBoundingBox);
        }
        
        if (typeof logMessage === 'function') {
            logMessage(`Pointer mode: Started tracking at (${Math.round(imageCoords.x)}, ${Math.round(imageCoords.y)})`, 'DEBUG');
        }
        
        // Capture the event for recording if recording is active
        if (typeof window.captureMouseDownDirect === 'function') {
            // Convert box coordinates to image space
            const imageBoxCoords = {
                left: imageCoords.x,
                top: imageCoords.y,
                width: 0,
                height: 0
            };
            
            const boxData = {
                isBoundingBox: true,
                boundingbox_mode: boundingbox_mode,
                // Send image coordinates for recording
                boxCoords: imageBoxCoords
            };
            
            window.captureMouseDownDirect(imageCoords.x, imageCoords.y, 0, boxData);
            
            if (typeof logMessage === 'function') {
                logMessage(`Sent bounding box DOWN event to recording system: mode=${boundingbox_mode}`, 'DEBUG');
            }
        }
        
        return;
    }
    
    // Only proceed with drawing in corners mode
    if (boundingbox_mode !== 'corners') return;
    
    // Remove any existing bounding box before creating a new one
    removeExistingBoundingBox();
    
    // Store the starting point (using canvas coordinates for display)
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
        logMessage(`Started drawing bounding box at (${Math.round(imageCoords.x)}, ${Math.round(imageCoords.y)})`, 'DEBUG');
    }
    
    // Capture the event for recording if recording is active
    if (typeof window.captureMouseDownDirect === 'function') {
        // Convert box coordinates to image space
        const imageBoxCoords = {
            left: imageCoords.x,
            top: imageCoords.y,
            width: 0,
            height: 0
        };
        
        const boxData = {
            isBoundingBox: true,
            boundingbox_mode: boundingbox_mode,
            // Send image coordinates for recording
            boxCoords: imageBoxCoords
        };
        
        window.captureMouseDownDirect(imageCoords.x, imageCoords.y, 0, boxData);
        
        if (typeof logMessage === 'function') {
            logMessage(`Sent bounding box DOWN event to recording system: mode=${boundingbox_mode}`, 'DEBUG');
        }
    }
}

/**
 * Handle mouse move event for bounding box
 * @param {Event} event - Fabric.js mouse event
 */
function handleBoundingBoxMouseMove(event) {
    if (!boundingBoxActive) return;
    
    // Get canvas pointer coordinates
    const pointer = window.canvas.getPointer(event.e);
    
    // Convert canvas coordinates to image pixel coordinates for recording
    const imageCoords = window.canvasToImageCoordinates(pointer.x, pointer.y);
    
    // In pointer mode, update min/max coordinates and bounding box
    if (boundingbox_mode === 'pointer' && pointerDragging) {
        // Update min/max values based on current pointer position (canvas coordinates for display)
        minX = Math.min(minX, pointer.x);
        maxX = Math.max(maxX, pointer.x);
        minY = Math.min(minY, pointer.y);
        maxY = Math.max(maxY, pointer.y);
        
        // Update bounding box with new min/max values
        if (activeBoundingBox) {
            activeBoundingBox.set({
                left: minX,
                top: minY,
                width: maxX - minX,
                height: maxY - minY
            });
            
            // Refresh the canvas
            window.canvas.renderAll();
        }
        
        // Update coordinates display (using image coordinates)
        updateCoordinatesDisplay(Math.round(imageCoords.x), Math.round(imageCoords.y));
        
        // Occasionally log the current min/max values
        if (Math.random() < 0.05 && typeof logMessage === 'function') {
            // Convert min/max to image coordinates for logging
            const minXImage = window.canvasToImageCoordinates(minX, minY).x;
            const minYImage = window.canvasToImageCoordinates(minX, minY).y;
            const maxXImage = window.canvasToImageCoordinates(maxX, maxY).x;
            const maxYImage = window.canvasToImageCoordinates(maxX, maxY).y;
            
            logMessage(`Pointer tracking: min(${Math.round(minXImage)},${Math.round(minYImage)}) max(${Math.round(maxXImage)},${Math.round(maxYImage)})`, 'DEBUG');
        }
        
        // Capture the event for recording if recording is active
        if (typeof window.updateCursorTrailPosition === 'function') {
            // Convert box coordinates to image coordinates for recording
            const boxCoordsImage = {
                left: window.canvasToImageCoordinates(minX, minY).x,
                top: window.canvasToImageCoordinates(minX, minY).y,
                width: window.canvasToImageCoordinates(maxX, maxY).x - window.canvasToImageCoordinates(minX, minY).x,
                height: window.canvasToImageCoordinates(maxX, maxY).y - window.canvasToImageCoordinates(minX, minY).y
            };
            
            window.updateCursorTrailPosition(imageCoords.x, imageCoords.y, {
                isBoundingBox: true,
                boundingbox_mode: boundingbox_mode,
                boxCoords: boxCoordsImage
            });
        }
        
        return;
    }
    
    // Only proceed with drawing in corners mode
    if (boundingbox_mode !== 'corners' || !currentBoundingBox || !boundingBoxStartPoint) return;
    
    // Calculate width and height based on mouse position (canvas coordinates for display)
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
    
    // Update coordinates display (using image coordinates)
    updateCoordinatesDisplay(Math.round(imageCoords.x), Math.round(imageCoords.y));
    
    // Log occasionally to prevent spam
    if (Math.random() < 0.05 && typeof logMessage === 'function') {
        // Convert width and height to image space for logging
        const widthImage = width / (window.zoomLevel || 1);
        const heightImage = height / (window.zoomLevel || 1);
        logMessage(`Drawing bounding box: width=${Math.round(widthImage)}, height=${Math.round(heightImage)}`, 'DEBUG');
    }
    
    // Capture the event for recording if recording is active
    if (typeof window.updateCursorTrailPosition === 'function') {
        // Convert box coordinates to image coordinates for recording
        const boxCoordsImage = {
            left: window.canvasToImageCoordinates(currentBoundingBox.left, currentBoundingBox.top).x,
            top: window.canvasToImageCoordinates(currentBoundingBox.left, currentBoundingBox.top).y,
            width: currentBoundingBox.width / (window.zoomLevel || 1),
            height: currentBoundingBox.height / (window.zoomLevel || 1)
        };
        
        window.updateCursorTrailPosition(imageCoords.x, imageCoords.y, {
            isBoundingBox: true,
            boundingbox_mode: boundingbox_mode,
            boxCoords: boxCoordsImage
        });
    }
}

/**
 * Handle mouse up event for bounding box
 * @param {Event} event - Fabric.js mouse event
 */
function handleBoundingBoxMouseUp(event) {
    if (!boundingBoxActive) return;
    
    // Get canvas pointer coordinates
    const pointer = window.canvas.getPointer(event.e);
    
    // Convert canvas coordinates to image pixel coordinates for recording
    const imageCoords = window.canvasToImageCoordinates(pointer.x, pointer.y);
    
    // In pointer mode, finalize the bounding box
    if (boundingbox_mode === 'pointer' && pointerDragging) {
        pointerDragging = false;
        
        if (typeof logMessage === 'function') {
            if (activeBoundingBox) {
                // Convert min/max to image coordinates for logging
                const minXImage = window.canvasToImageCoordinates(minX, minY).x;
                const minYImage = window.canvasToImageCoordinates(minX, minY).y;
                const maxXImage = window.canvasToImageCoordinates(maxX, maxY).x;
                const maxYImage = window.canvasToImageCoordinates(maxX, maxY).y;
                
                logMessage(`Pointer mode: Bounding box updated to (${Math.round(minXImage)},${Math.round(minYImage)}) - (${Math.round(maxXImage)},${Math.round(maxYImage)})`, 'INFO');
            }
        }
        
        // Make sure the box has some minimum size
        if (activeBoundingBox && (maxX - minX < 5 || maxY - minY < 5)) {
            // Box is too small, consider removing it or resetting
            if (typeof logMessage === 'function') {
                logMessage('Bounding box too small, maintaining previous size', 'DEBUG');
            }
        } else if (activeBoundingBox) {
            // Set the box as the active object
            window.canvas.setActiveObject(activeBoundingBox);
        }
        
        // Define box coordinates for recording
        let boxCoords = null;
        if (activeBoundingBox) {
            // Convert box coordinates to image coordinates for recording
            boxCoords = {
                left: window.canvasToImageCoordinates(activeBoundingBox.left, activeBoundingBox.top).x,
                top: window.canvasToImageCoordinates(activeBoundingBox.left, activeBoundingBox.top).y,
                width: activeBoundingBox.width / (window.zoomLevel || 1),
                height: activeBoundingBox.height / (window.zoomLevel || 1)
            };
        }
        
        // Capture the event for recording if recording is active
        if (typeof window.captureMouseUpDirect === 'function') {
            const boxData = {
                isBoundingBox: true,
                boundingbox_mode: boundingbox_mode,
                boxCoords: boxCoords
            };
            
            window.captureMouseUpDirect(imageCoords.x, imageCoords.y, 0, boxData);
            
            if (typeof logMessage === 'function') {
                logMessage(`Sent bounding box UP event to recording system: mode=${boundingbox_mode}`, 'DEBUG');
                if (boxCoords) {
                    logMessage(`Final box dimensions: ${Math.round(boxCoords.width)}x${Math.round(boxCoords.height)}`, 'DEBUG');
                }
            }
        }
        
        // Refresh the canvas
        window.canvas.renderAll();
        
        return;
    }
    
    // Only proceed with corners mode
    if (boundingbox_mode !== 'corners' || !currentBoundingBox) return;
    
    if (typeof logMessage === 'function') {
        // Convert width and height to image space for logging
        const widthImage = currentBoundingBox.width / (window.zoomLevel || 1);
        const heightImage = currentBoundingBox.height / (window.zoomLevel || 1);
        logMessage(`Completed bounding box: width=${Math.round(widthImage)}, height=${Math.round(heightImage)}`, 'INFO');
    }
    
    // Store box coordinates before potentially removing it
    // Convert to image coordinates for consistency
    const boxCoords = {
        left: window.canvasToImageCoordinates(currentBoundingBox.left, currentBoundingBox.top).x,
        top: window.canvasToImageCoordinates(currentBoundingBox.left, currentBoundingBox.top).y,
        width: currentBoundingBox.width / (window.zoomLevel || 1),
        height: currentBoundingBox.height / (window.zoomLevel || 1)
    };
    
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
        const boxData = {
            isBoundingBox: true,
            boundingbox_mode: boundingbox_mode,
            boxCoords: boxCoords
        };
        
        window.captureMouseUpDirect(imageCoords.x, imageCoords.y, 0, boxData);
        
        if (typeof logMessage === 'function') {
            logMessage(`Sent bounding box UP event to recording system: width=${Math.round(boxCoords.width)}, height=${Math.round(boxCoords.height)}`, 'DEBUG');
        }
    }
    
    // Refresh the canvas
    window.canvas.renderAll();
}

// Add hook to capture cursor trail updates directly
window.updateCursorTrailPosition = function(x, y, extraData = {}) {
    // Check if recording is active using the global functions
    if (typeof window.isRecording !== 'function' || typeof window.isPaused !== 'function') {
        return;
    }
    
    // If we are recording, also store this position in the mouse data
    if (window.isRecording() && !window.isPaused()) {
        const now = Date.now();
        // Don't throttle laser pointer movements for better trail quality
        const isBoundingBox = !!extraData.isBoundingBox;
        
        // IMPORTANT: For bounding box events, don't mark them as laser pointer events
        const isLaserActive = isBoundingBox ? false : (extraData.isLaserPointer || false); 
        
        // Get elapsed recording time
        const elapsedTimeMs = typeof window.getCurrentRecordingTime === 'function' ? 
            window.getCurrentRecordingTime() : now;
        
        // Ensure x and y are valid numbers
        if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
            console.error(`Invalid cursor position: x=${x}, y=${y}`);
            return;
        }
        
        // Process extraData to ensure consistent format for bounding box data
        let boxData = null;
        
        if (isBoundingBox) {
            // Format box coordinates consistently if they exist
            if (extraData.boxCoords) {
                boxData = {
                    left: extraData.boxCoords.left || 0,
                    top: extraData.boxCoords.top || 0,
                    width: extraData.boxCoords.width || 0,
                    height: extraData.boxCoords.height || 0
                };
                
                // Occasionally log bound box move events
                if (Math.random() < 0.05 && typeof logMessage === 'function') {
                    logMessage(`Recording bounding box MOVE: mode=${extraData.boundingbox_mode || 'corners'}, at (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
                }
            }
        }
        
        // Store mouse data with timestamp if the global mouseData array exists
        if (window.mouseData && Array.isArray(window.mouseData)) {
            window.mouseData.push({
                type: 'move',
                x: x,
                y: y,
                timeOffset: elapsedTimeMs, // Time in ms from recording start
                realTime: now,
                isLaserPointer: isLaserActive,
                isBoundingBox: isBoundingBox,
                boundingbox_mode: isBoundingBox ? extraData.boundingbox_mode || 'corners' : undefined,
                boxCoords: boxData,
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

// Direct mouse event capture functions for cursor trail system
window.captureMouseDownDirect = function(x, y, button, extraData = {}) {
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
    
    // Process extraData to ensure consistent format for bounding box data
    const isBoundingBox = !!extraData.isBoundingBox;
    let boxData = null;
    
    if (isBoundingBox) {
        // Ensure we have the mode
        const mode = extraData.boundingbox_mode || 'corners';
        
        // Format box coordinates consistently if they exist
        if (extraData.boxCoords) {
            boxData = {
                left: extraData.boxCoords.left || 0,
                top: extraData.boxCoords.top || 0,
                width: extraData.boxCoords.width || 0,
                height: extraData.boxCoords.height || 0
            };
        }
        
        if (typeof logMessage === 'function') {
            logMessage(`Recording bounding box DOWN: mode=${mode}, at (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
        }
    }
    
    // Log that we're capturing this event
    if (typeof logMessage === 'function') {
        logMessage(`Direct capture of mouse down: X: ${Math.round(x)}, Y: ${Math.round(y)}, button: ${button}`, 'DEBUG');
    }
    
    // Store in mouse data if the global mouseData array exists
    if (window.mouseData && Array.isArray(window.mouseData)) {
        // IMPORTANT: For bounding box events, we should NOT mark them as laser pointer events
        // This prevents confusion during replay
        const isLaserPointerEvent = isBoundingBox ? false : (extraData.isLaserPointer || false);
        
        // Create a clean object to ensure no circular references or unexpected properties
        const eventData = {
            type: 'down',
            button: button,
            x: x,
            y: y,
            timeOffset: elapsedTimeMs,
            realTime: now,
            isLaserPointer: isLaserPointerEvent,
            // Explicitly set bounding box properties to ensure they're included
            isBoundingBox: isBoundingBox,
            boundingbox_mode: isBoundingBox ? extraData.boundingbox_mode || 'corners' : undefined,
            boxCoords: boxData,
            source: 'direct' // Mark the source
        };
        
        // Add to the mouse data array
        window.mouseData.push(eventData);
        
        if (typeof logMessage === 'function') {
            logMessage(`Mouse DOWN event recorded at ${elapsedTimeMs}ms (data point #${window.mouseData.length})`, 'DEBUG');
            
            // Add additional debug info for bounding box events
            if (isBoundingBox) {
                logMessage(`Added bounding box DOWN event: isBoundingBox=${isBoundingBox}, mode=${eventData.boundingbox_mode}`, 'DEBUG');
            }
        }
    }
};

window.captureMouseUpDirect = function(x, y, button, extraData = {}) {
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
    
    // Process extraData to ensure consistent format for bounding box data
    const isBoundingBox = !!extraData.isBoundingBox;
    let boxData = null;
    
    if (isBoundingBox) {
        // Ensure we have the mode
        const mode = extraData.boundingbox_mode || 'corners';
        
        // Format box coordinates consistently if they exist
        if (extraData.boxCoords) {
            boxData = {
                left: extraData.boxCoords.left || 0,
                top: extraData.boxCoords.top || 0,
                width: extraData.boxCoords.width || 0,
                height: extraData.boxCoords.height || 0
            };
        }
        
        if (typeof logMessage === 'function') {
            logMessage(`Recording bounding box UP: mode=${mode}, at (${Math.round(x)}, ${Math.round(y)})`, 'DEBUG');
            if (boxData) {
                logMessage(`Box dimensions: ${Math.round(boxData.width)}x${Math.round(boxData.height)}`, 'DEBUG');
            }
        }
    }
    
    // Log that we're capturing this event
    if (typeof logMessage === 'function') {
        logMessage(`Direct capture of mouse up: X: ${Math.round(x)}, Y: ${Math.round(y)}, button: ${button}`, 'DEBUG');
    }
    
    // Store in mouse data if the global mouseData array exists
    if (window.mouseData && Array.isArray(window.mouseData)) {
        // IMPORTANT: For bounding box events, we should NOT mark them as laser pointer events
        // This prevents confusion during replay
        const isLaserPointerEvent = isBoundingBox ? false : (extraData.isLaserPointer || false);
        
        // Create a clean object to ensure no circular references or unexpected properties
        const eventData = {
            type: 'up',
            button: button,
            x: x,
            y: y,
            timeOffset: elapsedTimeMs,
            realTime: now,
            isLaserPointer: isLaserPointerEvent,
            // Explicitly set bounding box properties to ensure they're included
            isBoundingBox: isBoundingBox,
            boundingbox_mode: isBoundingBox ? extraData.boundingbox_mode || 'corners' : undefined,
            boxCoords: boxData,
            source: 'direct' // Mark the source
        };
        
        // Add to the mouse data array
        window.mouseData.push(eventData);
        
        if (typeof logMessage === 'function') {
            logMessage(`Mouse UP event recorded at ${elapsedTimeMs}ms (data point #${window.mouseData.length})`, 'DEBUG');
            
            // Add additional debug info for bounding box events
            if (isBoundingBox) {
                logMessage(`Added bounding box UP event: isBoundingBox=${isBoundingBox}, mode=${eventData.boundingbox_mode}`, 'DEBUG');
                if (boxData) {
                    logMessage(`Box final dimensions: ${Math.round(boxData.width)}x${Math.round(boxData.height)}`, 'DEBUG');
                }
            }
        }
    }
};

/**
 * Check if bounding box mode is currently active
 * @returns {boolean} True if bounding box mode is active
 */
function isInBoundingBoxMode() {
    return boundingBoxActive;
}

/**
 * Get the current bounding box mode (corners or pointer)
 * @returns {string} The current bounding box mode
 */
function getBoundingBoxMode() {
    return boundingbox_mode;
}

/**
 * Get the initial coordinates for a new bounding box
 * Used when starting to draw a new box
 * @returns {Object|null} Initial box coordinates or null if not available
 */
function getInitialBoxCoords() {
    if (!boundingBoxStartPoint) {
        return null;
    }
    
    return {
        left: boundingBoxStartPoint.x,
        top: boundingBoxStartPoint.y,
        width: 0,
        height: 0
    };
}

/**
 * Get the current coordinates of the active bounding box
 * @returns {Object|null} Current box coordinates or null if no active box
 */
function getCurrentBoxCoords() {
    // First try the current box being drawn
    if (currentBoundingBox) {
        return {
            left: currentBoundingBox.left,
            top: currentBoundingBox.top,
            width: currentBoundingBox.width || 0,
            height: currentBoundingBox.height || 0
        };
    }
    
    // Then try the completed active box
    if (activeBoundingBox) {
        return {
            left: activeBoundingBox.left,
            top: activeBoundingBox.top,
            width: activeBoundingBox.width || 0,
            height: activeBoundingBox.height || 0
        };
    }
    
    // If we're in pointer mode with min/max values
    if (boundingbox_mode === 'pointer' && minX !== undefined && maxX !== undefined) {
        const width = maxX - minX;
        const height = maxY - minY;
        
        return {
            left: minX,
            top: minY,
            width: width > 0 ? width : 0,
            height: height > 0 ? height : 0
        };
    }
    
    return null;
}

/**
 * Debug function to verify bounding box replay status
 * Will log information about current replay status
 */
function debugBoundingBoxReplay() {
    // Log general debug info
    if (typeof logMessage === 'function') {
        logMessage('--- BOUNDING BOX REPLAY DEBUG ---', 'INFO');
        logMessage(`Bounding box mode active: ${boundingBoxActive}`, 'INFO');
        logMessage(`Current mode: ${boundingbox_mode}`, 'INFO');
        
        // Check if we have a replay bounding box
        if (window.replayBoundingBox) {
            const box = window.replayBoundingBox;
            logMessage(`Replay bounding box exists: left=${Math.round(box.left)}, top=${Math.round(box.top)}, width=${Math.round(box.width)}, height=${Math.round(box.height)}`, 'INFO');
        } else {
            logMessage('No replay bounding box currently exists', 'WARN');
        }
        
        // Check canvas
        if (window.canvas) {
            const objects = window.canvas.getObjects();
            const boundingBoxes = objects.filter(obj => obj.type === 'rect');
            logMessage(`Canvas has ${objects.length} objects (${boundingBoxes.length} rectangles)`, 'INFO');
            
            // List all rectangles
            boundingBoxes.forEach((box, index) => {
                logMessage(`Rectangle #${index+1}: left=${Math.round(box.left)}, top=${Math.round(box.top)}, width=${Math.round(box.width)}, height=${Math.round(box.height)}`, 'INFO');
            });
        } else {
            logMessage('Canvas not available', 'ERROR');
        }
        
        logMessage('--- END DEBUG INFO ---', 'INFO');
    }
    
    // Create a test bounding box if requested and none exists
    if (!window.replayBoundingBox && window.canvas) {
        logMessage('Creating a test bounding box for debugging', 'INFO');
        const testBox = new fabric.Rect({
            left: 100,
            top: 100,
            width: 200,
            height: 150,
            fill: 'rgba(255, 0, 0, 0.2)',
            stroke: 'red',
            strokeWidth: 3
        });
        
        window.canvas.add(testBox);
        window.canvas.renderAll();
        logMessage('Test bounding box created - if you see a red rectangle, canvas rendering is working', 'INFO');
    }
}

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
    showBoundingBoxNotification,
    startReplayBoundingBox,
    updateReplayBoundingBox,
    removeReplayBoundingBox,
    handleBoundingBoxReplay,
    isInBoundingBoxMode,  // Export the new function
    getBoundingBoxMode,   // Export the new function
    getInitialBoxCoords,  // Export the new function
    getCurrentBoxCoords,  // Export the new function
    debugBoundingBoxReplay // Export debug function
}; 