/**
 * Main application file for the image annotation tool
 */

console.log('=== app.js: LOADING STARTED ===');

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded fired');
    console.log('initializeCanvas available =', typeof window.initializeCanvas);
    
    // Initialize the application without delay since canvas.js is loaded synchronously now
    initializeApp();
    
    // Initialize cursor trail
    if (typeof initCursorTrail === 'function') {
        initCursorTrail();
        logMessage('Cursor trail initialized', 'DEBUG');
    } else {
        logMessage('initCursorTrail function not available', 'WARN');
    }
    
    // Add event listener specifically for the URL load button as requested
    const loadUrlBtn = document.getElementById('load-url-btn');
    if (loadUrlBtn) {
        loadUrlBtn.addEventListener('click', function() {
            logMessage('Load URL button clicked');
            loadUrlImage();
        });
        logMessage('URL image load button enabled', 'DEBUG');
    } else {
        logMessage('Could not find URL load button', 'ERROR');
    }
    
    // Enable image adjustment tools
    const brightnessSlider = document.getElementById('brightness');
    const contrastSlider = document.getElementById('contrast');
    
    if (brightnessSlider && contrastSlider) {
        brightnessSlider.addEventListener('input', function() {
            logMessage(`Brightness adjusted to: ${this.value}`);
            updateImageFilters();
        });
        
        contrastSlider.addEventListener('input', function() {
            logMessage(`Contrast adjusted to: ${this.value}`);
            updateImageFilters();
        });
        
        logMessage('Image adjustment tools enabled', 'DEBUG');
    } else {
        logMessage('Could not find image adjustment sliders', 'ERROR');
    }
    
    // Enable cursor size slider
    const cursorSizeSlider = document.getElementById('cursor-size');
    if (cursorSizeSlider) {
        cursorSizeSlider.addEventListener('input', function() {
            logMessage(`Cursor size adjusted to: ${this.value}`);
            updateCursorSize();
        });
        logMessage('Cursor size adjustment enabled', 'DEBUG');
    } else {
        logMessage('Could not find cursor size slider', 'ERROR');
    }
    
    // Enable cursor trail toggle checkbox
    const cursorTrailToggle = document.getElementById('cursor-tail-toggle');
    if (cursorTrailToggle) {
        cursorTrailToggle.addEventListener('change', function() {
            const enableTrail = this.checked;
            logMessage(`Cursor trail toggle: ${enableTrail ? 'ON' : 'OFF'}`);
            toggleCursorTrail(enableTrail);
        });
        logMessage('Cursor trail toggle enabled', 'DEBUG');
    } else {
        logMessage('Could not find cursor trail toggle', 'ERROR');
    }
});

/**
 * Main initialization function
 */
function initializeApp() {
    try {
        console.log('=== Application starting ===');
        logMessage('Application starting initialization', 'DEBUG');
        
        // Initialize the canvas
        logMessage('Initializing canvas...', 'DEBUG');
        try {
            // initializeCanvas function should be available now since canvas.js
            // is loaded without defer in the HTML head
            window.initializeCanvas();
            logMessage('Canvas initialized successfully', 'DEBUG');
        } catch (canvasError) {
            console.error('Error initializing canvas:', canvasError);
            logMessage('Failed to initialize canvas: ' + canvasError.message, 'ERROR');
            throw canvasError; // Re-throw to stop initialization
        }
        
        // Initialize the email modal - make this optional
        try {
            logMessage('Initializing email modal...', 'DEBUG');
            if (typeof window.initializeEmailModal === 'function') {
                window.initializeEmailModal();
                logMessage('Email modal initialized', 'DEBUG');
            } else {
                logMessage('Email modal function not found, skipping', 'WARN');
            }
        } catch (modalError) {
            console.error('Error initializing email modal:', modalError);
            logMessage('Error initializing email modal: ' + modalError.message, 'WARN');
            // Non-critical error, continue with application
        }
        
        // Event listeners removed as requested
        logMessage('Event handling code removed as requested', 'DEBUG');
        
        // Don't load default image automatically during debugging
        logMessage('Default image loading skipped as requested during debugging', 'DEBUG');
        
        logMessage('Application initialized successfully');
        console.log('=== Application initialized successfully ===');
    } catch (error) {
        console.error('Fatal error initializing application:', error);
        logMessage('Fatal error initializing application: ' + error.message, 'ERROR');
        alert('Failed to initialize the application. Please check the console for details.');
    }
}

/**
 * Set up all event listeners for the application
 * Event handling code removed as requested
 */
function setupEventListeners() {
    logMessage('Event handling code removed as requested', 'DEBUG');
}

/**
 * Initialize the email sending functionality modal
 */
function initializeEmailModal() {
    // Email functionality initialization without event handling
    logMessage('Email modal initialized without event handlers', 'DEBUG');
}

/**
 * Load image from local file input
 * Retained function signature but removed implementation
 */
function loadLocalImage() {
    logMessage('Image loading event handling removed', 'DEBUG');
}

/**
 * Load an image from the URL input
 * Implemented to enable URL loading functionality
 */
function loadUrlImage() {
    const urlInput = document.getElementById('url-image');
    if (!urlInput) {
        logMessage('URL input field not found', 'ERROR');
        return;
    }
    
    const url = urlInput.value.trim();
    if (!url) {
        logMessage('No URL provided. Please enter an image URL.', 'WARN');
        return;
    }
    
    logMessage(`Loading image from URL: ${url}`);
    loadImageFromUrl(url);
}

/**
 * Load the default image
 */
function loadDefaultImage() {
    const defaultUrl = document.getElementById('url-image').value;
    logMessage(`Attempting to load default image from ${defaultUrl}`, 'DEBUG');
    // Implementation retained for initialization only, not event handling
    loadImageFromUrl(defaultUrl);
}

/**
 * Load an image from a URL
 * @param {string} url - The URL of the image to load
 */
function loadImageFromUrl(url) {
    logMessage(`Loading image from URL: ${url}`, 'DEBUG');
    if (typeof fabric === 'undefined' || typeof fabric.Image === 'undefined') {
        logMessage('Error: Fabric.js library not loaded', 'ERROR');
        return;
    }
    
    if (typeof window.canvas === 'undefined') {
        logMessage('Error: Canvas not initialized', 'ERROR');
        return;
    }
    
    // Show loading indicator
    logMessage('Loading image, please wait...', 'INFO');
    
    fabric.Image.fromURL(url, function(img) {
        try {
            if (!img) {
                logMessage('Failed to load image from URL', 'ERROR');
                return;
            }
            
            // Clear the canvas
            window.canvas.clear();
            
            // Add the image to the canvas without scaling - the resizeCanvas function will handle this
            img.set({
                left: 0,
                top: 0,
                originX: 'left',
                originY: 'top'
            });
            
            window.canvas.add(img);
            
            // Store the original image for potential reset
            window.canvas.setBackgroundImage(img, window.canvas.renderAll.bind(window.canvas));
            
            // Resize the canvas to match the image aspect ratio
            if (typeof window.resizeCanvas === 'function') {
                window.resizeCanvas();
    } else {
                logMessage('resizeCanvas function not available', 'ERROR');
            }
            
            // Reset image adjustments
            document.getElementById('brightness').value = 0;
            document.getElementById('contrast').value = 0;
            
            logMessage(`Image loaded successfully: ${img.width}x${img.height} pixels`, 'INFO');
            } catch (error) {
            console.error('Error loading image:', error);
            logMessage('Error loading image: ' + error.message, 'ERROR');
        }
    }, { 
        crossOrigin: 'Anonymous',
        // Add error handling for image loading
        onerror: function() {
            logMessage(`Failed to load image from URL: ${url}`, 'ERROR');
        }
    });
}

/**
 * Log a message to the log area
 * @param {string} message - The message to log
 * @param {string} level - The log level (DEBUG, INFO, WARN, ERROR)
 */
function logMessage(message, level = 'INFO') {
    const logArea = document.getElementById('log-area');
    if (!logArea) return;
    
    // Don't log mouse moved messages at debug level for cleaner log
    if (message.startsWith('Mouse moved:') && level === 'INFO') {
        level = 'DEBUG';
    }
    
    // Format the message with timestamp and level
    const now = new Date();
    const timestamp = now.toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;
    
    // Update coordinates display for cursor position messages (if at debug level)
    if (level !== 'DEBUG' || !message.startsWith('Mouse moved:')) {
        // Add message to log area (skip mouse moved debug messages to reduce spam)
        logArea.value += formattedMessage + '\n';
        
        // Auto-scroll to bottom
        logArea.scrollTop = logArea.scrollHeight;
    }
    
    // Always log cursor trail updates regardless of level for better debugging
    if (message.startsWith('Cursor trail updated:')) {
        logArea.value += formattedMessage + '\n';
        logArea.scrollTop = logArea.scrollHeight;
    }
    
    // Also log to console for debugging
    switch (level) {
        case 'DEBUG':
            console.debug(formattedMessage);
            break;
        case 'WARN':
            console.warn(formattedMessage);
            break;
        case 'ERROR':
            console.error(formattedMessage);
            break;
        default:
            console.log(formattedMessage);
    }
}

/**
 * Update image filters based on slider values
 */
function updateImageFilters() {
    if (!window.canvas) {
        logMessage('Canvas not available', 'ERROR');
        return;
    }
    
    const objects = window.canvas.getObjects();
    const imgObject = objects.find(obj => obj.type === 'image');
    
    if (!imgObject) {
        logMessage('No image loaded to apply filters', 'WARN');
        return;
    }
    
    try {
        // Get slider values
        const brightnessValue = parseInt(document.getElementById('brightness').value) / 100;
        const contrastValue = parseInt(document.getElementById('contrast').value) / 100;
        
        logMessage(`Applying filters: Brightness=${brightnessValue.toFixed(2)}, Contrast=${contrastValue.toFixed(2)}`, 'DEBUG');
        
        // Remove existing filters
        imgObject.filters = [];
        
        // Add brightness filter if value is not 0
        if (brightnessValue !== 0) {
            imgObject.filters.push(new fabric.Image.filters.Brightness({
                brightness: brightnessValue
            }));
        }
        
        // Add contrast filter if value is not 0
        if (contrastValue !== 0) {
            imgObject.filters.push(new fabric.Image.filters.Contrast({
                contrast: contrastValue
            }));
        }
        
        // Apply filters
        imgObject.applyFilters();
        
        // Redraw the canvas
        window.canvas.renderAll();
        
        logMessage('Image filters updated');
                } catch (error) {
        console.error('Error applying image filters:', error);
        logMessage('Error applying image filters: ' + error.message, 'ERROR');
    }
}

/**
 * Update cursor size based on slider value
 */
function updateCursorSize() {
    const cursorSizeSlider = document.getElementById('cursor-size');
    if (!cursorSizeSlider) {
        logMessage('Cursor size slider not found', 'ERROR');
        return;
    }
    
    // Get the current cursor size value
    const newSize = parseInt(cursorSizeSlider.value);
    
    // Update the global cursor size variable
    window.cursorSize = newSize;
    logMessage(`Cursor size updated to ${newSize}px`, 'DEBUG');
    
    // If we have a canvas with a trail, update it immediately
    if (window.canvas && window.showCursorTail) {
        // Force redraw of trail with new size
        renderCursorTrail();
    }
}

/**
 * Toggle cursor trail functionality
 * @param {boolean} enable - Whether to enable cursor trail
 */
function toggleCursorTrail(enable) {
    // Update the global settings, but the actual drawing still requires mouse down
    if (typeof window.setCursorTrailEnabled === 'function') {
        window.setCursorTrailEnabled(enable);
        
        // Update UI elements
        const statusEl = document.getElementById('cursor-trail-status');
        if (statusEl) {
            statusEl.textContent = enable ? 'READY' : 'INACTIVE';
            statusEl.className = enable ? 'ms-2 badge bg-warning' : 'ms-2 badge bg-secondary';
        }
        
        // Update cursor size slider state
        const cursorSizeSlider = document.getElementById('cursor-size');
        if (cursorSizeSlider) {
            cursorSizeSlider.disabled = !enable;
        }
        
        logMessage(`Cursor trail ${enable ? 'enabled' : 'disabled'} - will ${enable ? 'activate' : 'not activate'} on mouse down`);
    } else {
        logMessage('setCursorTrailEnabled function not available', 'ERROR');
    }
    }
    
console.log('=== app.js: LOADING COMPLETED ==='); 