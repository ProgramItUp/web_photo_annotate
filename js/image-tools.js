/**
 * Image manipulation functionality for the image annotation application
 */

// State variables
let brightnessValue = 0;
let contrastValue = 0;
const DEFAULT_BRIGHTNESS = 0;
const DEFAULT_CONTRAST = 0;
const DEFAULT_IMAGE_PATH = 'https://prod-images-static.radiopaedia.org/images/157210/332aa0c67cb2e035e372c7cb3ceca2_big_gallery.jpg';

console.log('image-tools.js loaded - DEFAULT_IMAGE_PATH:', DEFAULT_IMAGE_PATH);

// Expose functions to global scope
window.loadDefaultImage = loadDefaultImage;
window.loadLocalImage = loadLocalImage;
window.loadUrlImage = loadUrlImage;
window.updateImageFilters = updateImageFilters;

/**
 * Load the default image when the application starts
 */
function loadDefaultImage() {
    console.log('loadDefaultImage called - setting URL input to:', DEFAULT_IMAGE_PATH);
    logMessage(`Initializing default image: ${DEFAULT_IMAGE_PATH}`, 'DEBUG');
    
    // Set the default URL in the input field
    const urlInput = document.getElementById('url-image');
    if (urlInput) {
        urlInput.value = DEFAULT_IMAGE_PATH;
        logMessage('Set default URL in input field', 'DEBUG');
    } else {
        console.error('URL input element not found');
        logMessage('Error: URL input element not found', 'ERROR');
    }
    
    try {
        // Load the default image
        logMessage(`Loading default image from URL: ${DEFAULT_IMAGE_PATH}`);
        loadImageToCanvas(DEFAULT_IMAGE_PATH);
    } catch (error) {
        console.error('Error loading default image:', error);
        logMessage(`Error loading default image: ${error.message}`, 'ERROR');
        throw error;
    }
}

/**
 * Load an image from a local file
 * Event handling removed as requested
 */
function loadLocalImage(e) {
    logMessage('Local image loading event handling removed', 'DEBUG');
}

/**
 * Load an image from a URL
 * Event handling removed as requested
 */
function loadUrlImage() {
    logMessage('URL image loading event handling removed', 'DEBUG');
}

/**
 * Load image to canvas from a source URL or data URL
 * @param {string} src - The image source URL or data URL
 */
function loadImageToCanvas(src) {
    logMessage(`Loading image to canvas: ${src.substring(0, 50)}${src.length > 50 ? '...' : ''}`, 'DEBUG');
    
    fabric.Image.fromURL(src, function(img) {
        if (!img) {
            console.error('Failed to create fabric.Image from URL');
            logMessage('Error: Failed to create fabric.Image from URL', 'ERROR');
            return;
        }
        
        logMessage(`Image created: ${img.width}x${img.height}`, 'DEBUG');
        
        // Clear canvas
        canvas.clear();
        cursorTrailPoints = [];
        logMessage('Canvas cleared', 'DEBUG');
        
        // Calculate container width - use the full width of the container
        const container = document.getElementById('image-container');
        if (!container) {
            console.error('Image container element not found');
            logMessage('Error: Image container element not found', 'ERROR');
            return;
        }
        
        const containerWidth = container.offsetWidth;
        
        // Get natural image dimensions
        const naturalWidth = img.width;
        const naturalHeight = img.height;
        logMessage(`Natural dimensions: ${naturalWidth}x${naturalHeight}`, 'DEBUG');
        
        // Define maximum display dimensions
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        
        // Calculate scale factors to fit within max dimensions
        const scaleW = naturalWidth > MAX_WIDTH ? MAX_WIDTH / naturalWidth : 1;
        const scaleH = naturalHeight > MAX_HEIGHT ? MAX_HEIGHT / naturalHeight : 1;
        
        // Use the smaller scale factor to preserve aspect ratio and fit both constraints
        const scale = Math.min(scaleW, scaleH);
        
        // Calculate scaled dimensions
        const scaledWidth = naturalWidth * scale;
        const scaledHeight = naturalHeight * scale;
        logMessage(`Scaling image by ${scale.toFixed(3)} to ${scaledWidth.toFixed(0)}x${scaledHeight.toFixed(0)}`, 'DEBUG');
        
        // Resize the canvas to match the scaled image dimensions
        canvas.setWidth(scaledWidth);
        canvas.setHeight(scaledHeight);
        
        // Update the container height to match scaled height
        container.style.height = `${scaledHeight}px`;
        // Optionally set container width (useful if container is not block or has padding)
        // container.style.width = `${scaledWidth}px`; 
        
        // Apply the calculated scale to the Fabric image object
        img.set({ scaleX: scale, scaleY: scale });
        
        // Position the image at the top-left corner
        img.set({
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top'
        });
        
        // Set image as the background
        img.selectable = false;
        
        // Ensure image is at the bottom layer
        canvas.add(img);
        img.sendToBack();
        
        // Reset zoom and pan
        canvas.setZoom(1);
        zoomLevel = 1;
        window.zoomLevel = 1;
        window.zoomFactor = 1; // Ensure both zoom variables are in sync
        
        console.log('Image loaded, zoom level reset:', {
            zoomLevel,
            'window.zoomLevel': window.zoomLevel,
            'window.zoomFactor': window.zoomFactor
        });
        
        // Reset filters
        brightnessValue = DEFAULT_BRIGHTNESS;
        contrastValue = DEFAULT_CONTRAST;
        document.getElementById('brightness').value = DEFAULT_BRIGHTNESS;
        document.getElementById('contrast').value = DEFAULT_CONTRAST;
        
        canvas.renderAll();
        
        logMessage(`Image loaded and canvas resized to ${scaledWidth.toFixed(0)}x${scaledHeight.toFixed(0)} pixels`);
        
        // Reinitialize drawing tools
        if (window.drawingTools) {
            // Give a small delay to ensure canvas is fully ready
            setTimeout(() => {
                try {
                    // Re-apply current tool
                    const currentTool = window.drawingTools.currentTool || 'laser';
                    window.drawingTools.setTool(currentTool);
                    logMessage(`Reinitialized drawing tool: ${currentTool}`, 'DEBUG');
                } catch (error) {
                    console.error('Error reinitializing drawing tools:', error);
                    logMessage(`Error reinitializing drawing tools: ${error.message}`, 'ERROR');
                }
            }, 100);
        } else {
            logMessage('Drawing tools not available', 'WARN');
        }
    }, { 
        crossOrigin: 'anonymous',
        onerror: function(error) {
            console.error('Error loading image to canvas', error);
            logMessage('Error: Failed to load image to canvas', 'ERROR');
            if (error && error.message) {
                logMessage(`Details: ${error.message}`, 'ERROR');
            }
        }
    });
}

/**
 * Update image filters based on slider values
 * Event handling removed as requested
 */
function updateImageFilters() {
    logMessage('Image filter event handling removed', 'DEBUG');
}

/**
 * Transform canvas coordinates to image pixel coordinates, accounting for scale and position.
 * @param {number} canvasX - X coordinate relative to the canvas top-left.
 * @param {number} canvasY - Y coordinate relative to the canvas top-left.
 * @returns {Object} The transformed image pixel coordinates { x, y }, or null if canvas/image not ready.
 */
window.canvasToImageCoordinates = function(canvasX, canvasY) {
    const canvas = window.canvas;
    if (!canvas) {
        console.error('canvasToImageCoordinates: Canvas not available');
        return null;
    }
    
    // Find the image object on the canvas (assuming it's the first object or has type 'image')
    const imgObject = canvas.getObjects().find(obj => obj.type === 'image');
    
    if (!imgObject) {
        console.error('canvasToImageCoordinates: Image object not found on canvas');
        // Return canvas coordinates as a fallback?
        return { x: Math.round(canvasX), y: Math.round(canvasY) }; 
    }

    // Calculate coordinates relative to the image object's top-left corner on the canvas
    const relativeX = canvasX - imgObject.left;
    const relativeY = canvasY - imgObject.top;

    // Scale the relative coordinates back to the image's original pixel coordinates
    const imageX = relativeX / imgObject.scaleX;
    const imageY = relativeY / imgObject.scaleY;

    // Clamp coordinates to the image's natural dimensions
    // Use imgObject.width and imgObject.height which store the original dimensions
    const finalX = Math.max(0, Math.min(Math.floor(imageX), imgObject.width - 1));
    const finalY = Math.max(0, Math.min(Math.floor(imageY), imgObject.height - 1));

    return { x: finalX, y: finalY };
} 