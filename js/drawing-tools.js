/**
 * Drawing tools functionality for the image annotation application
 */

// State variables
let currentTool = 'select';
let isDrawing = false;
let drawingObject = null;
let startPoint = {};

/**
 * Set the active drawing tool
 * @param {string} tool - The tool name to set active
 */
function setTool(tool) {
    currentTool = tool;
    
    // Update UI
    const toolButtons = document.querySelectorAll('[id^="tool-"]');
    toolButtons.forEach(button => {
        button.classList.remove('tool-selected');
    });
    document.getElementById(`tool-${tool}`).classList.add('tool-selected');
    
    // Remove previous drawing event handlers
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');
    
    // Add panning event handlers
    setupPanZoomHandlers();
    
    logMessage(`Tool switched to: ${tool}`);
    
    // Set canvas behavior based on tool
    if (tool === 'select') {
        canvas.isDrawingMode = false;
        canvas.selection = true;
    } else if (tool === 'dot') {
        canvas.isDrawingMode = false;
        canvas.selection = false;
        
        // Setup dot placement on click
        canvas.on('mouse:down', placeDot);
    } else if (tool === 'squiggle') {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush.width = cursorSize;
        canvas.freeDrawingBrush.color = '#000000';
        canvas.selection = false;
    } else {
        canvas.isDrawingMode = false;
        canvas.selection = false;
        
        // Setup drawing handlers for shapes
        canvas.on('mouse:down', startDrawing);
        canvas.on('mouse:move', drawing);
        canvas.on('mouse:up', endDrawing);
    }
}

/**
 * Start drawing a shape
 * @param {Object} options - The fabric.js event object
 */
function startDrawing(options) {
    if (options.e.ctrlKey) return; // Don't draw if ctrl is pressed (panning)
    if (currentTool !== 'box' && currentTool !== 'circle' && currentTool !== 'arrow') return;
    
    isDrawing = true;
    const pointer = canvas.getPointer(options.e);
    startPoint = { x: pointer.x, y: pointer.y };
    
    if (currentTool === 'box') {
        drawingObject = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            stroke: '#000000',
            strokeWidth: 2,
            fill: 'rgba(0, 0, 0, 0.1)',
            selectable: true
        });
    } else if (currentTool === 'circle') {
        drawingObject = new fabric.Circle({
            left: pointer.x,
            top: pointer.y,
            radius: 0,
            stroke: '#000000',
            strokeWidth: 2,
            fill: 'rgba(0, 0, 0, 0.1)',
            selectable: true
        });
    } else if (currentTool === 'arrow') {
        // For arrow, we'll use a line with an arrow head
        drawingObject = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: '#000000',
            strokeWidth: 2,
            selectable: true
        });
    }
    
    canvas.add(drawingObject);
    
    // Ensure drawing object is on top
    drawingObject.bringToFront();
}

/**
 * Continue drawing a shape as the mouse moves
 * @param {Object} options - The fabric.js event object
 */
function drawing(options) {
    if (!isDrawing) return;
    if (options.e.ctrlKey) return; // Don't draw if ctrl is pressed (panning)
    
    const pointer = canvas.getPointer(options.e);
    
    if (currentTool === 'box') {
        if (startPoint.x > pointer.x) {
            drawingObject.set({ left: pointer.x });
        }
        if (startPoint.y > pointer.y) {
            drawingObject.set({ top: pointer.y });
        }
        
        drawingObject.set({
            width: Math.abs(startPoint.x - pointer.x),
            height: Math.abs(startPoint.y - pointer.y)
        });
    } else if (currentTool === 'circle') {
        const radius = Math.sqrt(
            Math.pow(startPoint.x - pointer.x, 2) +
            Math.pow(startPoint.y - pointer.y, 2)
        ) / 2;
        
        const centerX = (startPoint.x + pointer.x) / 2;
        const centerY = (startPoint.y + pointer.y) / 2;
        
        drawingObject.set({
            left: centerX - radius,
            top: centerY - radius,
            radius: radius
        });
    } else if (currentTool === 'arrow') {
        drawingObject.set({
            x2: pointer.x,
            y2: pointer.y
        });
    }
    
    canvas.renderAll();
}

/**
 * Finish drawing a shape when mouse is released
 * @param {Object} options - The fabric.js event object
 */
function endDrawing(options) {
    if (!isDrawing) return;
    if (options && options.e.ctrlKey) return; // Don't end drawing if ctrl is pressed (panning)
    
    isDrawing = false;
    
    if (currentTool === 'arrow' && drawingObject) {
        // Add arrow head
        const dx = drawingObject.x2 - drawingObject.x1;
        const dy = drawingObject.y2 - drawingObject.y1;
        const angle = Math.atan2(dy, dx);
        
        const headLength = 15;
        const headAngle = Math.PI / 6; // 30 degrees
        
        const arrowHead1 = new fabric.Line([
            drawingObject.x2, 
            drawingObject.y2,
            drawingObject.x2 - headLength * Math.cos(angle - headAngle),
            drawingObject.y2 - headLength * Math.sin(angle - headAngle)
        ], {
            stroke: '#000000',
            strokeWidth: 2,
            selectable: false
        });
        
        const arrowHead2 = new fabric.Line([
            drawingObject.x2, 
            drawingObject.y2,
            drawingObject.x2 - headLength * Math.cos(angle + headAngle),
            drawingObject.y2 - headLength * Math.sin(angle + headAngle)
        ], {
            stroke: '#000000',
            strokeWidth: 2,
            selectable: false
        });
        
        // Group the arrow parts
        const arrowGroup = new fabric.Group([drawingObject, arrowHead1, arrowHead2], {
            selectable: true
        });
        canvas.remove(drawingObject);
        canvas.add(arrowGroup);
        
        // Ensure arrow is on top
        arrowGroup.bringToFront();
    } else if (drawingObject) {
        // Ensure other shapes are on top
        drawingObject.bringToFront();
    }
    
    drawingObject = null;
    canvas.renderAll();
}

/**
 * Place a dot at the clicked position
 * @param {Object} options - The fabric.js event object
 */
function placeDot(options) {
    if (options.e.ctrlKey) return; // Don't place dot if ctrl is pressed (panning)
    
    const pointer = canvas.getPointer(options.e);
    
    // Create dot
    const dot = new fabric.Circle({
        left: pointer.x,
        top: pointer.y,
        radius: cursorSize / 2,
        fill: '#000000',
        stroke: '#000000',
        strokeWidth: 1,
        originX: 'center',
        originY: 'center',
        selectable: true
    });
    
    canvas.add(dot);
    dot.bringToFront();
    canvas.renderAll();
    
    logMessage(`Dot placed at X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}`);
}

/**
 * Delete the selected object from the canvas
 */
function deleteSelected() {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        canvas.remove(activeObject);
        canvas.renderAll();
        logMessage('Object deleted');
    }
} 