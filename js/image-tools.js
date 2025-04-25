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
        
        // Calculate the height based on the image's aspect ratio
        const aspectRatio = img.height / img.width;
        const newHeight = containerWidth * aspectRatio;
        
        logMessage(`Container dimensions: ${containerWidth}x${Math.round(newHeight)}`, 'DEBUG');
        
        // Resize the canvas to match the image dimensions
        canvas.setWidth(containerWidth);
        canvas.setHeight(newHeight);
        
        // Update the container height to match
        container.style.height = `${newHeight}px`;
        
        // Scale image to fit canvas width while maintaining aspect ratio
        const scaleFactor = containerWidth / img.width;
        img.scale(scaleFactor);
        
        logMessage(`Image scaled by factor: ${scaleFactor.toFixed(3)}`, 'DEBUG');
        
        // Center the image
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
        
        logMessage(`Image loaded and resized to ${containerWidth}x${Math.round(newHeight)} pixels`);
        
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
 * Transform canvas coordinates to image coordinates
 * @param {Object} pointer - The canvas pointer coordinates
 * @returns {Object} The transformed coordinates
 */
function transformCoordinates(pointer) {
    // Just return the original coordinates for now
    return pointer;
} 