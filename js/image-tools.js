/**
 * Image manipulation functionality for the image annotation application
 */

// State variables
let brightnessValue = DEFAULT_BRIGHTNESS;
let contrastValue = DEFAULT_CONTRAST;
const DEFAULT_IMAGE_PATH = 'https://prod-images-static.radiopaedia.org/images/157210/332aa0c67cb2e035e372c7cb3ceca2_big_gallery.jpg';

console.log('image-tools.js loaded - DEFAULT_IMAGE_PATH:', DEFAULT_IMAGE_PATH);

/**
 * Load the default image when the application starts
 */
function loadDefaultImage() {
    console.log('loadDefaultImage called - setting URL input to:', DEFAULT_IMAGE_PATH);
    loadImageToCanvas(DEFAULT_IMAGE_PATH);
    // Prepopulate the URL input box with the default image URL
    document.getElementById('url-image').value = DEFAULT_IMAGE_PATH;
    logMessage(`Loaded default image: ${DEFAULT_IMAGE_PATH}`);
}

/**
 * Load an image from a local file
 * @param {Event} e - The file input change event
 */
function loadLocalImage(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            loadImageToCanvas(event.target.result);
            logMessage(`Loaded image from file: ${file.name}`);
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Load an image from a URL
 */
function loadUrlImage() {
    const url = document.getElementById('url-image').value;
    if (url) {
        loadImageToCanvas(url);
        logMessage(`Loaded image from URL: ${url}`);
    }
}

/**
 * Load image to canvas from a source URL or data URL
 * @param {string} src - The image source URL or data URL
 */
function loadImageToCanvas(src) {
    fabric.Image.fromURL(src, function(img) {
        // Clear canvas
        canvas.clear();
        cursorTrailPoints = [];
        
        // Scale image to fit canvas while maintaining aspect ratio
        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();
        
        if (img.width > canvasWidth || img.height > canvasHeight) {
            const scaleFactor = Math.min(
                canvasWidth / img.width,
                canvasHeight / img.height
            );
            img.scale(scaleFactor);
        }
        
        // Set image as the background
        img.selectable = false;
        
        // Ensure image is at the bottom layer
        canvas.add(img);
        img.sendToBack();
        
        // Reset zoom and pan
        canvas.setZoom(1);
        zoomLevel = 1;
        
        // Reset filters
        brightnessValue = DEFAULT_BRIGHTNESS;
        contrastValue = DEFAULT_CONTRAST;
        document.getElementById('brightness').value = DEFAULT_BRIGHTNESS;
        document.getElementById('contrast').value = DEFAULT_CONTRAST;
        
        canvas.renderAll();
        
        logMessage('Image loaded and displayed on canvas');
    });
}

/**
 * Update image filters based on slider values
 */
function updateImageFilters() {
    brightnessValue = parseInt(document.getElementById('brightness').value);
    contrastValue = parseInt(document.getElementById('contrast').value);
    
    const objects = canvas.getObjects();
    // Find the image object (usually the first/bottom object)
    const imgObject = objects.find(obj => obj.type === 'image');
    
    if (imgObject) {
        // Remove existing filters
        imgObject.filters = [];
        
        // Add brightness filter if needed
        if (brightnessValue !== 0) {
            imgObject.filters.push(new fabric.Image.filters.Brightness({
                brightness: brightnessValue / 100
            }));
        }
        
        // Add contrast filter if needed
        if (contrastValue !== 0) {
            imgObject.filters.push(new fabric.Image.filters.Contrast({
                contrast: contrastValue / 100
            }));
        }
        
        // Apply filters
        imgObject.applyFilters();
        canvas.renderAll();
        
        logMessage(`Image filters updated: Brightness=${brightnessValue}, Contrast=${contrastValue}`);
    }
} 