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
 * Retained function signature but removed implementation
 */
function loadUrlImage() {
    logMessage('URL image loading event handling removed', 'DEBUG');
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
    
    fabric.Image.fromURL(url, function(img) {
        try {
            // Clear the canvas
            window.canvas.clear();
            
            // Calculate scale to fit the canvas
            const containerWidth = document.getElementById('image-container').offsetWidth;
            const scale = containerWidth / img.width;
            
            // Apply the scale and add the image
            img.scale(scale);
            window.canvas.add(img);
            window.canvas.centerObject(img);
            
            // Store the original image for potential reset
            window.canvas.setBackgroundImage(img, window.canvas.renderAll.bind(window.canvas));
            
            // Resize the canvas to match the image aspect ratio
            if (typeof window.resizeCanvas === 'function') {
                window.resizeCanvas();
            }
            
            // Reset image adjustments
            document.getElementById('brightness').value = 0;
            document.getElementById('contrast').value = 0;
            
            logMessage(`Image loaded: ${img.width}x${img.height} pixels`, 'DEBUG');
        } catch (error) {
            console.error('Error loading image:', error);
            logMessage('Error loading image: ' + error.message, 'ERROR');
        }
    }, { crossOrigin: 'Anonymous' });
}

/**
 * Log a message to the log area
 * @param {string} message - The message to log
 * @param {string} level - The log level (DEBUG, INFO, WARN, ERROR)
 */
function logMessage(message, level = 'INFO') {
    const logArea = document.getElementById('log-area');
    if (!logArea) return;
    
    // Format the message with timestamp and level
    const now = new Date();
    const timestamp = now.toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;
    
    // Add message to log area
    logArea.value += formattedMessage + '\n';
    
    // Auto-scroll to bottom
    logArea.scrollTop = logArea.scrollHeight;
    
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
 * Retained function signature but removed implementation
 */
function updateImageFilters() {
    logMessage('Image filter update event handling removed', 'DEBUG');
}

/**
 * Update cursor size based on slider value
 * Retained function signature but removed implementation
 */
function updateCursorSize() {
    logMessage('Cursor size update event handling removed', 'DEBUG');
}

console.log('=== app.js: LOADING COMPLETED ==='); 