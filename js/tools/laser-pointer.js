/**
 * LaserPointer tool implementation
 * Creates a visual laser pointer trail that fades over time
 */

import { getImagePixelCoordinates } from '../core/coordinates.js';

export class LaserPointer {
    /**
     * Creates a new LaserPointer tool
     * @param {HTMLElement} imageContainer - Container holding the image
     * @param {HTMLImageElement} image - Image element
     * @param {Object} options - Configuration options
     */
    constructor(imageContainer, image, options = {}) {
        this.imageContainer = imageContainer;
        this.image = image;
        this.zoomFactor = options.zoomFactor || 1;
        this.active = false;
        this.trailPoints = [];
        this.maxTrailPoints = options.maxTrailPoints || 50;
        this.trailFadeTime = options.trailFadeTime || 1000; // ms
        this.pointSize = options.pointSize || 10;
        this.pointColor = options.pointColor || 'red';
        this.fadeInterval = null;
        
        // Create trail container
        this.trailContainer = document.createElement('div');
        this.trailContainer.className = 'laser-trail-container';
        this.trailContainer.style.position = 'absolute';
        this.trailContainer.style.top = '0';
        this.trailContainer.style.left = '0';
        this.trailContainer.style.pointerEvents = 'none';
        this.trailContainer.style.width = '100%';
        this.trailContainer.style.height = '100%';
        this.imageContainer.appendChild(this.trailContainer);
    }
    
    /**
     * Activates the laser pointer tool
     */
    activate() {
        this.active = true;
        this.imageContainer.classList.add('laser-pointer-active');
        this.imageContainer.style.cursor = 'none';
        
        // Start fade interval
        this.fadeInterval = setInterval(() => this.updateTrailOpacity(), 50);
    }
    
    /**
     * Deactivates the laser pointer tool
     */
    deactivate() {
        this.active = false;
        this.clearTrail();
        this.imageContainer.classList.remove('laser-pointer-active');
        this.imageContainer.style.cursor = 'default';
        
        // Clear fade interval
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
    }
    
    /**
     * Adds a trail point at the current mouse position
     * @param {MouseEvent} event - Mouse event
     * @returns {Object} The image pixel coordinates of the point
     */
    addTrailPoint(event) {
        if (!this.active) return null;
        
        const coords = getImagePixelCoordinates(event, this.image, this.zoomFactor);
        
        // Create point element
        const point = document.createElement('div');
        point.className = 'laser-point';
        point.style.position = 'absolute';
        point.style.width = `${this.pointSize}px`;
        point.style.height = `${this.pointSize}px`;
        point.style.borderRadius = '50%';
        point.style.backgroundColor = this.pointColor;
        point.style.boxShadow = `0 0 ${this.pointSize}px ${this.pointColor}`;
        point.style.pointerEvents = 'none';
        
        // Position in canvas/display coordinates - account for zoom
        const displayCoords = {
            x: coords.x * this.zoomFactor,
            y: coords.y * this.zoomFactor
        };
        
        point.style.left = `${displayCoords.x - (this.pointSize / 2)}px`;
        point.style.top = `${displayCoords.y - (this.pointSize / 2)}px`;
        
        this.trailContainer.appendChild(point);
        
        // Record the timestamp for fading
        const timestamp = Date.now();
        this.trailPoints.push({
            element: point,
            timestamp: timestamp
        });
        
        // Limit trail length
        if (this.trailPoints.length > this.maxTrailPoints) {
            const oldestPoint = this.trailPoints.shift();
            this.trailContainer.removeChild(oldestPoint.element);
        }
        
        // Update opacity immediately for smooth fading
        this.updateTrailOpacity();
        
        return coords; // Return image pixel coordinates for recording
    }
    
    /**
     * Updates the opacity of all trail points based on their age
     */
    updateTrailOpacity() {
        const now = Date.now();
        const pointsToRemove = [];
        
        this.trailPoints.forEach((point, index) => {
            const age = now - point.timestamp;
            
            // Calculate opacity based on age
            const opacity = Math.max(0, 1 - (age / this.trailFadeTime));
            
            if (opacity <= 0) {
                // Mark for removal if fully transparent
                pointsToRemove.push(index);
            } else {
                // Update opacity
                point.element.style.opacity = opacity;
            }
        });
        
        // Remove fully faded points (in reverse order to avoid index shifting)
        for (let i = pointsToRemove.length - 1; i >= 0; i--) {
            const index = pointsToRemove[i];
            const point = this.trailPoints[index];
            this.trailContainer.removeChild(point.element);
            this.trailPoints.splice(index, 1);
        }
    }
    
    /**
     * Clears all trail points
     */
    clearTrail() {
        this.trailPoints.forEach(point => {
            this.trailContainer.removeChild(point.element);
        });
        this.trailPoints = [];
    }
    
    /**
     * Updates the zoom factor for properly positioning trail points
     * @param {number} zoomFactor - The new zoom factor
     */
    updateZoomFactor(zoomFactor) {
        this.zoomFactor = zoomFactor;
        
        // Update positions of existing trail points
        this.trailPoints.forEach(point => {
            // Get current position
            const left = parseInt(point.element.style.left) + (this.pointSize / 2);
            const top = parseInt(point.element.style.top) + (this.pointSize / 2);
            
            // Calculate image coordinates
            const imageX = left / this.zoomFactor;
            const imageY = top / this.zoomFactor;
            
            // Update with new zoom factor
            point.element.style.left = `${imageX * zoomFactor - (this.pointSize / 2)}px`;
            point.element.style.top = `${imageY * zoomFactor - (this.pointSize / 2)}px`;
        });
        
        // Update zoom factor
        this.zoomFactor = zoomFactor;
    }
    
    /**
     * Sets the size of the laser point
     * @param {number} size - Size in pixels
     */
    setPointSize(size) {
        this.pointSize = size;
    }
    
    /**
     * Sets the color of the laser point
     * @param {string} color - CSS color value
     */
    setPointColor(color) {
        this.pointColor = color;
    }
} 