/**
 * BoundingBox tool implementation
 * Allows drawing boxes around regions of interest using two different modes:
 * - corners: draw from one corner to the opposite
 * - pointer: track pointer movement to create a bounding box
 */

import { getImagePixelCoordinates, imageToCanvasCoordinates } from '../core/coordinates.js';

export class BoundingBoxTool {
    /**
     * Creates a new BoundingBoxTool
     * @param {HTMLElement} imageContainer - Container holding the image
     * @param {HTMLImageElement} image - Image element
     * @param {Object} options - Configuration options
     */
    constructor(imageContainer, image, options = {}) {
        this.imageContainer = imageContainer;
        this.image = image;
        this.zoomFactor = options.zoomFactor || 1;
        this.active = false;
        this.mode = options.mode || 'corners'; // 'corners' or 'pointer'
        this.boxColor = options.boxColor || 'rgba(0, 100, 255, 0.8)';
        this.currentBoxColor = options.currentBoxColor || 'rgba(255, 0, 0, 0.8)';
        this.lineWidth = options.lineWidth || 2;
        
        // Create overlay canvas for drawing boxes
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'bounding-box-canvas';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'none';
        this.ctx = this.canvas.getContext('2d');
        this.imageContainer.appendChild(this.canvas);
        
        this.boxes = []; // Saved boxes
        this.currentBox = null; // Box being drawn
        this.isDrawing = false;
        this.pointerTrackingPoints = []; // For pointer mode
        
        this.resizeCanvas();
        this.setupEventListeners();
    }
    
    /**
     * Resizes the canvas to match the image container dimensions
     */
    resizeCanvas() {
        if (this.imageContainer) {
            this.canvas.width = this.imageContainer.clientWidth;
            this.canvas.height = this.imageContainer.clientHeight;
            this.redrawBoxes();
        }
    }
    
    /**
     * Activates the bounding box tool
     * @param {string} mode - Drawing mode ('corners' or 'pointer')
     */
    activate(mode = 'corners') {
        this.active = true;
        this.mode = mode;
        this.imageContainer.classList.add('bounding-box-active');
    }
    
    /**
     * Deactivates the bounding box tool
     */
    deactivate() {
        this.active = false;
        this.isDrawing = false;
        this.currentBox = null;
        this.pointerTrackingPoints = [];
        this.imageContainer.classList.remove('bounding-box-active');
    }
    
    /**
     * Starts drawing a new bounding box
     * @param {MouseEvent} event - Mouse event
     * @returns {Object} The image pixel coordinates where the box started
     */
    startBox(event) {
        if (!this.active) return null;
        
        const coords = getImagePixelCoordinates(event, this.image, this.zoomFactor);
        
        this.isDrawing = true;
        
        if (this.mode === 'corners') {
            this.currentBox = {
                startX: coords.x,
                startY: coords.y,
                width: 0,
                height: 0
            };
        } else if (this.mode === 'pointer') {
            this.pointerTrackingPoints = [coords];
            this.currentBox = {
                startX: coords.x,
                startY: coords.y,
                width: 0,
                height: 0
            };
        }
        
        return coords; // Return image pixel coordinates for recording
    }
    
    /**
     * Updates the current bounding box as the mouse moves
     * @param {MouseEvent} event - Mouse event
     * @returns {Object} The current image pixel coordinates
     */
    updateBox(event) {
        if (!this.isDrawing || !this.currentBox) return null;
        
        const coords = getImagePixelCoordinates(event, this.image, this.zoomFactor);
        
        if (this.mode === 'corners') {
            this.currentBox.width = coords.x - this.currentBox.startX;
            this.currentBox.height = coords.y - this.currentBox.startY;
        } else if (this.mode === 'pointer') {
            this.pointerTrackingPoints.push(coords);
            
            // Find min/max x,y from all tracking points
            const xPoints = this.pointerTrackingPoints.map(p => p.x);
            const yPoints = this.pointerTrackingPoints.map(p => p.y);
            
            const minX = Math.min(...xPoints);
            const maxX = Math.max(...xPoints);
            const minY = Math.min(...yPoints);
            const maxY = Math.max(...yPoints);
            
            this.currentBox.startX = minX;
            this.currentBox.startY = minY;
            this.currentBox.width = maxX - minX;
            this.currentBox.height = maxY - minY;
        }
        
        this.redrawBoxes();
        return coords;
    }
    
    /**
     * Finalizes the current bounding box
     * @param {MouseEvent} event - Mouse event
     * @returns {Object} The final image pixel coordinates
     */
    finishBox(event) {
        if (!this.isDrawing || !this.currentBox) return null;
        
        const coords = getImagePixelCoordinates(event, this.image, this.zoomFactor);
        
        // Normalize box (handle negative width/height)
        const box = this.normalizeBox(this.currentBox);
        
        // Only add if box has some size
        if (box.width > 1 && box.height > 1) {
            this.boxes.push(box);
        }
        
        this.isDrawing = false;
        this.currentBox = null;
        this.pointerTrackingPoints = [];
        
        this.redrawBoxes();
        return coords;
    }
    
    /**
     * Normalizes a box to ensure positive width and height
     * @param {Object} box - Box object with startX, startY, width, height
     * @returns {Object} Normalized box
     */
    normalizeBox(box) {
        const normalized = {...box};
        
        if (normalized.width < 0) {
            normalized.startX += normalized.width;
            normalized.width = Math.abs(normalized.width);
        }
        
        if (normalized.height < 0) {
            normalized.startY += normalized.height;
            normalized.height = Math.abs(normalized.height);
        }
        
        return normalized;
    }
    
    /**
     * Redraws all boxes on the canvas
     */
    redrawBoxes() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw all saved boxes
        this.boxes.forEach(box => {
            this.drawBox(box, this.boxColor);
        });
        
        // Draw current box if active
        if (this.currentBox) {
            this.drawBox(this.currentBox, this.currentBoxColor);
        }
    }
    
    /**
     * Draws a single box on the canvas
     * @param {Object} box - Box object with startX, startY, width, height
     * @param {string} color - CSS color value
     */
    drawBox(box, color) {
        // Convert image coordinates to canvas coordinates
        const start = imageToCanvasCoordinates(box.startX, box.startY, this.zoomFactor);
        const end = imageToCanvasCoordinates(
            box.startX + box.width,
            box.startY + box.height,
            this.zoomFactor
        );
        
        // Calculate width and height in canvas space
        const width = end.x - start.x;
        const height = end.y - start.y;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.strokeRect(start.x, start.y, width, height);
    }
    
    /**
     * Updates the zoom factor for properly scaling and positioning boxes
     * @param {number} zoomFactor - The new zoom factor
     */
    updateZoomFactor(zoomFactor) {
        this.zoomFactor = zoomFactor;
        this.resizeCanvas();
    }
    
    /**
     * Sets the drawing mode
     * @param {string} mode - Drawing mode ('corners' or 'pointer')
     */
    setMode(mode) {
        this.mode = mode;
    }
    
    /**
     * Removes the most recent box
     */
    undoLastBox() {
        if (this.boxes.length > 0) {
            this.boxes.pop();
            this.redrawBoxes();
        }
    }
    
    /**
     * Removes all boxes
     */
    clearBoxes() {
        this.boxes = [];
        this.redrawBoxes();
    }
    
    /**
     * Sets up event listeners for window resize
     */
    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }
} 