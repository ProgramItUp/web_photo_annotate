/**
 * Drawing tools functionality for annotations
 * This contains laser pointer and cursor trail related functionality.
 */

// State for laser pointer trail
let currentLaserTrail = null;
let activeLaserEvent = null;  // Reference to the current laser event being recorded

// State variables
let boundingBoxActive = false;
let currentBoundingBox = null;
let boundingBoxStartPoint = null;
let activeBoundingBox = null; // Track the active (completed) bounding box
let boundingbox_mode = 'corners'; // Use a single variable for mode: 'corners' or 'pointer'
let pointerDragging = false; // Track if we're currently dragging in pointer mode
let minX, minY, maxX, maxY; // Min and max coordinates for pointer mode
let activeBoundingBoxEvent = null; // Reference to the current bbox event being recorded
let lastRecordedBoxTime = 0; // For throttling intermediate points
let lastRecordedBoxPos = { x: 0, y: 0 }; // For throttling intermediate points

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
    
    // Keep only the last 20 points to avoid performance issues (in the data array)
    if (window.currentLaserTrail.length > 20) {
        window.currentLaserTrail.shift();
    }
    
    // Draw the trail (will now only add the newest point visually)
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
    
    // Use only the window-level trail data
    const trail = window.currentLaserTrail; // <<< Use window scope only
    
    if (!trail || trail.length === 0) {
        // Nothing to draw
        return;
    }
    
    // --- MODIFICATION START: Don't clear, just add newest point ---
    // trailContainer.innerHTML = ''; // <<< REMOVED Line: Don't clear current trail
    
    // Get the *newest* point added
    const newestPoint = trail[trail.length - 1];
    if (!newestPoint) return; 
    
    const cursorSize = window.cursorSize || 10;
    const now = Date.now();
    
    // Draw ONLY the newest point
        const pointElement = document.createElement('div');
        pointElement.className = 'laser-trail-point';
        
    // Calculate style based on age (or just make it fully visible initially)
    const opacity = 0.9; // Start fully visible
    const size = cursorSize; // Start at full size

        pointElement.style.width = `${size}px`;
        pointElement.style.height = `${size}px`;
    pointElement.style.backgroundColor = `rgba(255, 30, 30, ${opacity})`; 
    pointElement.style.left = `${newestPoint.x}px`;
    pointElement.style.top = `${newestPoint.y}px`;
        pointElement.style.boxShadow = `0 0 ${Math.round(size/2)}px rgba(255, 0, 0, ${opacity * 0.8})`;
        pointElement.style.border = `1px solid rgba(255, 255, 255, ${opacity * 0.5})`;
    // Add position absolute and transform to center the dot on the point
    pointElement.style.position = 'absolute';
    pointElement.style.borderRadius = '50%';
    pointElement.style.transform = 'translate(-50%, -50%)';
    pointElement.style.pointerEvents = 'none'; // Ensure it doesn't block interactions
        
        // Add to container
        trailContainer.appendChild(pointElement);

    // --- TODO: Add logic to fade/remove older points ---
    // We need a separate mechanism, maybe using requestAnimationFrame or setTimeout,
    // to periodically iterate through the child elements of trailContainer
    // and reduce their opacity / remove them based on age.
    // For now, this will just accumulate points.
    // --- MODIFICATION END ---
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
        trailContainer.innerHTML = ''; // <<< Ensure this clears the visuals
    } else {
        if (typeof logMessage === 'function') {
            logMessage('Warning: Laser trail container not found for clearing', 'WARN');
        }
    }
    
    window.currentLaserTrail = null;
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
    
    console.log('DEBUG: createReplayCursor function defined');
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
            // --- Match interactive style --- //
            fill: 'transparent',
            stroke: 'blue',
            strokeWidth: 2, 
            selectable: false,
            hasControls: false,
            hasBorders: false,
            // transparentCorners: false, // Not needed
            // cornerColor: 'blue',      // Not needed
            // cornerSize: 10,           // Not needed
            // cornerStyle: 'circle',    // Not needed
            // --- End Match interactive style --- //
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
                // --- Match interactive style --- //
                fill: 'transparent',
                stroke: 'blue',
                strokeWidth: 2,
                selectable: false,
                hasControls: false,
                hasBorders: false,
                // transparentCorners: false, // Not needed
                // cornerColor: 'blue',      // Not needed
                // cornerSize: 10,           // Not needed
                // cornerStyle: 'circle',    // Not needed
                // --- End Match interactive style --- //
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
                height: height,
                // --- Match interactive style --- //
                fill: 'transparent',
                stroke: 'blue',
                strokeWidth: 2,
                selectable: false,
                hasControls: false,
                hasBorders: false,
                evented: false
                // --- End Match interactive style --- //
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
    if (!window.canvas) {
        if (typeof logMessage === 'function') { logMessage('Canvas not available for bounding box', 'ERROR'); }
        return;
    }
    boundingBoxActive = true;
    window.canvas.on('mouse:down', handleBoundingBoxMouseDown);
    window.canvas.on('mouse:move', handleBoundingBoxMouseMove);
    window.canvas.on('mouse:up', handleBoundingBoxMouseUp);
    if (typeof logMessage === 'function') { logMessage('Bounding box mode activated', 'INFO'); }
}

/**
 * Deactivate the bounding box mode
 */
function deactivateBoundingBox() {
    boundingBoxActive = false;
    if (window.canvas) {
        window.canvas.off('mouse:down', handleBoundingBoxMouseDown);
        window.canvas.off('mouse:move', handleBoundingBoxMouseMove);
        window.canvas.off('mouse:up', handleBoundingBoxMouseUp);
    }
    currentBoundingBox = null;
    boundingBoxStartPoint = null;
    // Complete any active bounding box event if mouse up didn't fire properly
    if (activeBoundingBoxEvent) {
        finalizeBoundingBoxEvent(activeBoundingBoxEvent.final_coords || null); // Use last known coords or null
    }
    if (typeof logMessage === 'function') { logMessage('Bounding box mode deactivated', 'INFO'); }
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
 * Handle mouse down event for bounding box - Starts recording a new event.
 * @param {Event} event - Fabric.js mouse event
 */
function handleBoundingBoxMouseDown(options) {
    if (!boundingBoxActive) return;
    const pointer = window.canvas.getPointer(options.e);

    // *** START NEW RECORDING EVENT ***
    if (typeof window.isRecording === 'function' && window.isRecording() && !window.isPaused()) {
        const now = Date.now();
        const timeOffset = window.getCurrentRecordingTime();
        activeBoundingBoxEvent = {
            event_id: `bbox_${now}`,
            mode: boundingbox_mode,
            start_time_offset: timeOffset,
            end_time_offset: null,
            duration_ms: null,
            intermediate_coords: [],
            final_coords: null
        };
        // Add initial point to intermediate coords
        activeBoundingBoxEvent.intermediate_coords.push({
            timeOffset: timeOffset,
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0
        });
        // Ensure category exists
        if (!window.recordedEvents.bounding_box) {
            window.recordedEvents.bounding_box = [];
        }
        window.recordedEvents.bounding_box.push(activeBoundingBoxEvent);
        logMessage(`Started recording bounding_box event ${activeBoundingBoxEvent.event_id} (mode: ${boundingbox_mode})`, 'DEBUG');

        // Reset throttling variables
        lastRecordedBoxTime = now;
        lastRecordedBoxPos = { x: pointer.x, y: pointer.y };
    } else {
        activeBoundingBoxEvent = null; // Not recording
    }
    // *** END NEW RECORDING EVENT ***

    // --- Existing Logic for Drawing/Pointer Mode --- //
    if (boundingbox_mode === 'pointer') {
        pointerDragging = true;
        minX = maxX = pointer.x;
        minY = maxY = pointer.y;
        if (!activeBoundingBox) {
            activeBoundingBox = new fabric.Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: 'transparent', // No fill
                stroke: 'blue',
                strokeWidth: 2,
                selectable: false, // Not selectable
                hasControls: false, // No controls/handles
                hasBorders: false, // No default border
                lockRotation: true,
                evented: false // Don't capture events on the box itself
            });
            window.canvas.add(activeBoundingBox);
        }
    } else { // corners mode
    removeExistingBoundingBox();
        boundingBoxStartPoint = { x: pointer.x, y: pointer.y };
    currentBoundingBox = new fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: 'transparent', // No fill
        stroke: 'blue',
        strokeWidth: 2,
        selectable: false, // Not selectable
        hasControls: false, // No controls/handles
        hasBorders: false, // No default border
        lockRotation: true,
        evented: false // Don't capture events on the box itself
    });
    window.canvas.add(currentBoundingBox);
    }
    // --- End Existing Logic --- //

    // Ensure default cursor is used
    window.canvas.defaultCursor = 'default';
    window.canvas.hoverCursor = 'default';
}

/**
 * Handle mouse move event for bounding box - Adds intermediate points to active event.
 * @param {Event} event - Fabric.js mouse event
 */
function handleBoundingBoxMouseMove(options) {
    if (!boundingBoxActive) return;
    const pointer = window.canvas.getPointer(options.e);
    let currentCoords = null;
    
    // --- Existing Logic for Drawing/Pointer Mode Update --- //
    if (boundingbox_mode === 'pointer' && pointerDragging) {
        minX = Math.min(minX, pointer.x); maxX = Math.max(maxX, pointer.x);
        minY = Math.min(minY, pointer.y); maxY = Math.max(maxY, pointer.y);
        if (activeBoundingBox) {
            activeBoundingBox.set({ left: minX, top: minY, width: maxX - minX, height: maxY - minY });
            // Re-apply style to ensure no controls appear if they were somehow re-enabled
            activeBoundingBox.set({
                selectable: false,
                hasControls: false,
                hasBorders: false,
                evented: false
            });
            window.canvas.renderAll();
        }
        currentCoords = { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
    } else if (boundingbox_mode === 'corners' && currentBoundingBox && boundingBoxStartPoint) {
    let width = pointer.x - boundingBoxStartPoint.x;
    let height = pointer.y - boundingBoxStartPoint.y;
        let left = boundingBoxStartPoint.x;
        let top = boundingBoxStartPoint.y;
        if (width < 0) { left = pointer.x; width = Math.abs(width); }
        if (height < 0) { top = pointer.y; height = Math.abs(height); }
        currentBoundingBox.set({ left: left, top: top, width: width, height: height });
        // Re-apply style to ensure no controls appear
        currentBoundingBox.set({
            selectable: false,
            hasControls: false,
            hasBorders: false,
            evented: false
        });
    window.canvas.renderAll();
        currentCoords = { left: left, top: top, width: width, height: height };
    } else {
        return; // Not drawing or dragging
    }
    updateCoordinatesDisplay(Math.round(pointer.x), Math.round(pointer.y));
    // --- End Existing Logic --- //

    // *** RECORD INTERMEDIATE POINT (Throttled) ***
    if (activeBoundingBoxEvent && currentCoords) {
        const now = Date.now();
        const timeOffset = window.getCurrentRecordingTime();
        const timeDiff = now - lastRecordedBoxTime;
        const distDiff = Math.sqrt(Math.pow(pointer.x - lastRecordedBoxPos.x, 2) + Math.pow(pointer.y - lastRecordedBoxPos.y, 2));

        // Check config constants (use window scope or pass them in)
        const interval = window.BOUNDING_BOX_RECORD_INTERVAL_MS || 100;
        const threshold = window.BOUNDING_BOX_RECORD_PIXEL_THRESHOLD || 5;

        if (timeDiff >= interval || distDiff >= threshold) {
            activeBoundingBoxEvent.intermediate_coords.push({
                timeOffset: timeOffset,
                left: currentCoords.left,
                top: currentCoords.top,
                width: currentCoords.width,
                height: currentCoords.height
            });
            lastRecordedBoxTime = now;
            lastRecordedBoxPos = { x: pointer.x, y: pointer.y };
            // logMessage(`Recorded intermediate bbox coord (#${activeBoundingBoxEvent.intermediate_coords.length})`, 'DEBUG');
    }
    }
    // *** END RECORD INTERMEDIATE POINT ***
}

/**
 * Handle mouse up event for bounding box - Finalizes the active event.
 * @param {Event} event - Fabric.js mouse event
 */
function handleBoundingBoxMouseUp(options) {
    if (!boundingBoxActive) return;
    const pointer = window.canvas.getPointer(options.e);
    let finalCoords = null;
    
    // --- Existing Logic for Finalizing Draw/Pointer --- //
    if (boundingbox_mode === 'pointer' && pointerDragging) {
        pointerDragging = false;
        if (activeBoundingBox && (maxX - minX >= 5 && maxY - minY >= 5)) {
            finalCoords = { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
            activeBoundingBox.set(finalCoords); // Ensure final update
            // Re-apply style on finalization
            activeBoundingBox.set({
                selectable: false,
                hasControls: false,
                hasBorders: false,
                evented: false
            });
            // Don't set active object as it's not selectable
            // window.canvas.setActiveObject(activeBoundingBox);
        } else if (activeBoundingBox) {
            // Too small or invalid, remove visual
            window.canvas.remove(activeBoundingBox);
            activeBoundingBox = null;
        }
    } else if (boundingbox_mode === 'corners' && currentBoundingBox) {
        if (currentBoundingBox.width >= 5 && currentBoundingBox.height >= 5) {
            finalCoords = { left: currentBoundingBox.left, top: currentBoundingBox.top, width: currentBoundingBox.width, height: currentBoundingBox.height };
            // Re-apply style on finalization
            currentBoundingBox.set({
                selectable: false,
                hasControls: false,
                hasBorders: false,
                evented: false
            });
            activeBoundingBox = currentBoundingBox; // Keep the drawn box
            // Don't set active object as it's not selectable
            // window.canvas.setActiveObject(activeBoundingBox);
        } else {
            window.canvas.remove(currentBoundingBox); // Too small
        }
        currentBoundingBox = null;
        boundingBoxStartPoint = null;
    } else {
        return; // Mouse up without active drawing/dragging
    }
    window.canvas.renderAll();
    // --- End Existing Logic --- //

    // Reset cursor to default if the tool is still active
    if (boundingBoxActive) {
        window.canvas.defaultCursor = 'default';
        window.canvas.hoverCursor = 'default';
    }

    finalizeBoundingBoxEvent(finalCoords);
}

/**
 * Helper to finalize the active bounding box event.
 * @param {Object|null} finalCoords - The final coordinates, or null if box was invalid.
 */
function finalizeBoundingBoxEvent(finalCoords) {
    if (activeBoundingBoxEvent) {
        const endTimeOffset = window.getCurrentRecordingTime ? window.getCurrentRecordingTime() : Date.now();
        activeBoundingBoxEvent.end_time_offset = endTimeOffset;
        activeBoundingBoxEvent.duration_ms = endTimeOffset - activeBoundingBoxEvent.start_time_offset;
        activeBoundingBoxEvent.final_coords = finalCoords; // Store final coords or null

        // Add final state to intermediate coords for consistency if it exists
        if (finalCoords) {
             activeBoundingBoxEvent.intermediate_coords.push({
                timeOffset: endTimeOffset,
                left: finalCoords.left,
                top: finalCoords.top,
                width: finalCoords.width,
                height: finalCoords.height
            });
        }
        
        logMessage(`Finalized bounding_box event ${activeBoundingBoxEvent.event_id}. Valid: ${!!finalCoords}`, 'DEBUG');
        activeBoundingBoxEvent = null; // Clear active event reference
    }
}

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

// *** NEW Laser Pointer Event Recording Functions ***

/**
 * Starts recording a new laser pointer event.
 * Called on mouse:down when the laser tool is active.
 * @param {Object} options - Fabric.js event options containing pointer coordinates.
 */
function startLaserPointerEvent(options) {
    if (!window.isRecording || !window.isRecording()) return; // Only record if recording is active
    if (activeLaserEvent) {
        logMessage('Warning: startLaserPointerEvent called while another event was active. Finalizing previous.', 'WARN');
        finalizeLaserPointerEvent(options); // Finalize the previous one just in case
    }

    const pointer = window.canvas.getPointer(options.e);
    const timeOffset = window.getCurrentRecordingTime ? window.getCurrentRecordingTime() : Date.now(); // Get current recording time

    activeLaserEvent = {
        event_id: `laser_${Date.now()}`,
        start_time_offset: timeOffset,
        end_time_offset: null,
        duration_ms: null,
        points: [
            { x: pointer.x, y: pointer.y, timeOffset: timeOffset } // Record the starting point
        ]
    };

    window.recordedEvents.laser_pointer.push(activeLaserEvent);
    logMessage(`Started laser_pointer event ${activeLaserEvent.event_id} at offset ${timeOffset.toFixed(0)}ms`, 'DEBUG');
}

/**
 * Adds a point to the currently active laser pointer event.
 * Called on mouse:move when the laser tool is active.
 * @param {Object} options - Fabric.js event options containing pointer coordinates.
 */
function addLaserPointerPoint(options) {
    // Only add points if recording and an event is active
    if (!window.isRecording || !window.isRecording() || !activeLaserEvent) return;

    const pointer = window.canvas.getPointer(options.e);
    const timeOffset = window.getCurrentRecordingTime ? window.getCurrentRecordingTime() : Date.now();

    activeLaserEvent.points.push({
        x: pointer.x,
        y: pointer.y,
        timeOffset: timeOffset
    });
    // Optional: Add throttling here if needed for performance
}

/**
 * Finalizes the currently active laser pointer event.
 * Called on mouse:up.
 * @param {Object} options - Fabric.js event options containing pointer coordinates.
 */
function finalizeLaserPointerEvent(options) {
    if (!activeLaserEvent) return; // No active event to finalize

    const pointer = window.canvas.getPointer(options.e);
    const timeOffset = window.getCurrentRecordingTime ? window.getCurrentRecordingTime() : Date.now();

    // Add the final point
    activeLaserEvent.points.push({
        x: pointer.x,
        y: pointer.y,
        timeOffset: timeOffset
    });

    activeLaserEvent.end_time_offset = timeOffset;
    activeLaserEvent.duration_ms = activeLaserEvent.end_time_offset - activeLaserEvent.start_time_offset;

    logMessage(`Finalized laser_pointer event ${activeLaserEvent.event_id}. Duration: ${activeLaserEvent.duration_ms.toFixed(0)}ms, Points: ${activeLaserEvent.points.length}`, 'DEBUG');

    activeLaserEvent = null; // Clear the active event reference
}

// Export functions for use in recording.js
// document.addEventListener('DOMContentLoaded', function() { // <<< REMOVED WRAPPER
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
    debugBoundingBoxReplay, // Export debug function
    // Recording hooks (called by canvas event listeners)
    startLaserPointerEvent,
    addLaserPointerPoint,
    finalizeLaserPointerEvent
}; 
// console.log('DEBUG: window.DrawingTools object assigned on DOMContentLoaded: ', window.DrawingTools);
console.log('DEBUG: window.DrawingTools object assigned directly: ', window.DrawingTools);
console.log('DEBUG: Keys assigned to window.DrawingTools:', Object.keys(window.DrawingTools || {}));
// }); // <<< REMOVED WRAPPER 