/**
 * Core module for image loading and handling
 * Manages image source, zoom, pan, and image transformations
 */

import { getImagePixelCoordinates } from './coordinates.js';

export class ImageHandler {
    /**
     * Creates a new ImageHandler
     * @param {HTMLElement} imageContainer - Container element for the image
     * @param {HTMLElement} coordinateDisplay - Element to display coordinates
     */
    constructor(imageContainer, coordinateDisplay) {
        this.imageContainer = imageContainer;
        this.coordinateDisplay = coordinateDisplay;
        this.image = null;
        this.zoomFactor = 1;
        this.panOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.brightness = 0;
        this.contrast = 0;
        this.panningEnabled = true;
        
        // Create the image if it doesn't exist
        if (!this.image) {
            this.image = new Image();
            this.image.className = 'main-image';
            this.imageContainer.appendChild(this.image);
        }
        
        this.setupEventListeners();
    }
    
    /**
     * Loads an image from a File object
     * @param {File} file - The image file to load
     */
    loadFromFile(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => this.setImageSource(e.target.result);
        reader.readAsDataURL(file);
    }
    
    /**
     * Loads an image from a URL
     * @param {string} url - The URL of the image to load
     */
    loadFromURL(url) {
        if (!url) return;
        this.setImageSource(url);
    }
    
    /**
     * Sets the image source and resets view
     * @param {string} src - The image source (URL or data URL)
     */
    setImageSource(src) {
        this.image.onload = () => {
            this.resetView();
            // Dispatch a custom event when image is loaded
            this.imageContainer.dispatchEvent(new CustomEvent('image-loaded', { 
                detail: { 
                    image: this.image,
                    width: this.image.naturalWidth,
                    height: this.image.naturalHeight
                }
            }));
        };
        this.image.src = src;
    }
    
    /**
     * Resets zoom, pan and filters to default values
     */
    resetView() {
        this.zoomFactor = 1;
        this.panOffset = { x: 0, y: 0 };
        this.brightness = 0;
        this.contrast = 0;
        this.updateImageTransform();
    }
    
    /**
     * Updates the zoom level
     * @param {number} factor - The zoom factor to apply
     */
    zoom(factor) {
        this.zoomFactor = Math.max(0.1, Math.min(10, this.zoomFactor * factor));
        this.updateImageTransform();
        
        // Dispatch a custom event for the zoom change
        this.imageContainer.dispatchEvent(new CustomEvent('zoom-changed', { 
            detail: { zoomFactor: this.zoomFactor }
        }));
    }
    
    /**
     * Zooms in at a specific point
     * @param {number} x - X coordinate to zoom at
     * @param {number} y - Y coordinate to zoom at
     * @param {number} factor - The zoom factor to apply
     */
    zoomAtPoint(x, y, factor) {
        const oldZoom = this.zoomFactor;
        this.zoomFactor = Math.max(0.1, Math.min(10, this.zoomFactor * factor));
        
        // Adjust pan to keep the point under cursor
        this.panOffset.x += (x * (1 - this.zoomFactor / oldZoom));
        this.panOffset.y += (y * (1 - this.zoomFactor / oldZoom));
        
        this.updateImageTransform();
        
        // Dispatch zoom change event
        this.imageContainer.dispatchEvent(new CustomEvent('zoom-changed', { 
            detail: { zoomFactor: this.zoomFactor }
        }));
    }
    
    /**
     * Set the brightness level
     * @param {number} value - Brightness value (-100 to 100)
     */
    setBrightness(value) {
        this.brightness = value;
        this.updateFilters();
    }
    
    /**
     * Set the contrast level
     * @param {number} value - Contrast value (-100 to 100)
     */
    setContrast(value) {
        this.contrast = value;
        this.updateFilters();
    }
    
    /**
     * Updates image CSS filters for brightness and contrast
     */
    updateFilters() {
        this.image.style.filter = `brightness(${100 + this.brightness}%) contrast(${100 + this.contrast}%)`;
    }
    
    /**
     * Updates image transform properties (zoom and pan)
     */
    updateImageTransform() {
        this.image.style.transform = `translate(${this.panOffset.x}px, ${this.panOffset.y}px) scale(${this.zoomFactor})`;
        this.image.style.transformOrigin = 'top left';
    }
    
    /**
     * Enable or disable panning
     * @param {boolean} enabled - Whether panning should be enabled
     */
    setPanningEnabled(enabled) {
        this.panningEnabled = enabled;
        this.imageContainer.style.cursor = enabled ? 'default' : 'crosshair';
    }
    
    /**
     * Sets up event listeners for the image
     */
    setupEventListeners() {
        // Mouse wheel for zoom
        this.imageContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            // Get mouse position relative to image container
            const rect = this.imageContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Determine zoom factor based on wheel direction
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            
            // Apply zoom centered on mouse position
            this.zoomAtPoint(mouseX, mouseY, zoomFactor);
        });
        
        // Mouse events for panning
        this.imageContainer.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left mouse button
            if (!this.panningEnabled) return; // Skip if panning is disabled
            
            this.isDragging = true;
            this.dragStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
            this.imageContainer.style.cursor = 'grabbing';
        });
        
        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) {
                // Update coordinate display when not dragging
                if (this.image.complete && this.imageContainer.contains(e.target)) {
                    const coords = getImagePixelCoordinates(e, this.image, this.zoomFactor);
                    if (this.coordinateDisplay) {
                        this.coordinateDisplay.textContent = `Mouse: X: ${coords.x}, Y: ${coords.y}`;
                    }
                }
                return;
            }
            
            // Update pan offset when dragging
            this.panOffset.x = e.clientX - this.dragStart.x;
            this.panOffset.y = e.clientY - this.dragStart.y;
            this.updateImageTransform();
        });
        
        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.imageContainer.style.cursor = this.panningEnabled ? 'default' : 'crosshair';
            }
        });
        
        // Handle mouseleave for coordinate display
        this.imageContainer.addEventListener('mouseleave', () => {
            if (this.coordinateDisplay) {
                this.coordinateDisplay.textContent = 'Mouse: X: -, Y: -';
            }
        });
        
        // Handle image load
        this.image.addEventListener('load', () => {
            // Reset the view on new image load
            this.resetView();
        });
    }
    
    /**
     * Gets the current zoom factor
     * @returns {number} The current zoom factor
     */
    getZoomFactor() {
        return this.zoomFactor;
    }
} 