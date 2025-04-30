/**
 * Main application file for the image annotation tool
 */

console.log('=== app.js: LOADING STARTED ===');

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded fired');
    console.log('initializeCanvas available =', typeof window.initializeCanvas);
    
    // NUCLEAR SOLUTION: Override createElement to catch the culprit creating the popup
    const originalCreateElement = document.createElement;
    document.createElement = function(tag) {
        const element = originalCreateElement.call(document, tag);
        
        // For divs, add special tracking
        if (tag.toLowerCase() === 'div') {
            // Add listeners to catch when text is set
            const originalInnerTextSetter = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText').set;
            const originalTextContentSetter = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent').set;
            const originalInnerHTMLSetter = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
            
            // Override innerText setter
            Object.defineProperty(element, 'innerText', {
                set: function(value) {
                    if (value && value.includes('Bounding Box Mode Active')) {
                        console.error('CAUGHT CULPRIT setting innerText with "Bounding Box Mode Active":', new Error().stack);
                        // Immediately prevent it from showing up
                        element.style.display = 'none';
                    }
                    return originalInnerTextSetter.call(this, value);
                },
                get: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText').get
            });
            
            // Override textContent setter
            Object.defineProperty(element, 'textContent', {
                set: function(value) {
                    if (value && value.includes('Bounding Box Mode Active')) {
                        console.error('CAUGHT CULPRIT setting textContent with "Bounding Box Mode Active":', new Error().stack);
                        // Immediately prevent it from showing up
                        element.style.display = 'none';
                    }
                    return originalTextContentSetter.call(this, value);
                },
                get: Object.getOwnPropertyDescriptor(Node.prototype, 'textContent').get
            });
            
            // Override innerHTML setter
            Object.defineProperty(element, 'innerHTML', {
                set: function(value) {
                    if (value && value.includes('Bounding Box Mode Active')) {
                        console.error('CAUGHT CULPRIT setting innerHTML with "Bounding Box Mode Active":', new Error().stack);
                        // Immediately prevent it from showing up
                        element.style.display = 'none';
                    }
                    return originalInnerHTMLSetter.call(this, value);
                },
                get: Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').get
            });
        }
        
        return element;
    };
    
    // NUCLEAR SOLUTION PART 2: Poll for any popups every 100ms as a fallback
    setInterval(() => {
        const elements = document.querySelectorAll('div');
        elements.forEach(el => {
            if (el.innerText && el.innerText.includes('Bounding Box Mode Active') && el.style.display !== 'none') {
                console.error('CAUGHT POPUP VIA POLLING:', el);
                console.log('PARENT ELEMENT:', el.parentNode);
                el.style.display = 'none';
            }
        });
    }, 100);
    
    // Add MutationObserver to instantly catch and remove any popup with "Bounding Box Mode Active" text
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    const node = mutation.addedNodes[i];
                    // Check if it's an element node and has innerText
                    if (node.nodeType === 1) {
                        // Check the node itself
                        if (node.innerText && node.innerText.includes('Bounding Box Mode Active')) {
                            node.parentNode.removeChild(node);
                            console.log('Popup notification removed by observer');
                        }
                        
                        // Also check child nodes (using querySelectorAll for deeper traversal)
                        if (node.querySelectorAll) {
                            const childElements = node.querySelectorAll('*');
                            childElements.forEach(function(el) {
                                if (el.innerText && el.innerText.includes('Bounding Box Mode Active')) {
                                    el.parentNode.removeChild(el);
                                    console.log('Nested popup notification removed by observer');
                                }
                            });
                        }
                    }
                }
            }
        });
    });
    
    // Start observing the entire document with all its child nodes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Initialize the application without delay since canvas.js is loaded synchronously now
    initializeApp();
    
    // Initialize cursor trail
    if (typeof initCursorTrail === 'function') {
        initCursorTrail();
        logMessage('Cursor trail initialized', 'DEBUG');
    } else {
        logMessage('initCursorTrail function not available', 'WARN');
    }
    
    // Initialize Bootstrap tooltips
    initializeTooltips();
    
    // Parse URL parameters to check for an image URL to load automatically
    parseUrlForImage();
    
    // Add event listeners for log buttons
    const copyLogBtn = document.getElementById('copy-log');
    const clearLogBtn = document.getElementById('clear-log');
    
    if (copyLogBtn) {
        copyLogBtn.addEventListener('click', function() {
            const logArea = document.getElementById('log-area');
            if (logArea) {
                const logText = logArea.value;
                navigator.clipboard.writeText(logText)
                    .then(() => {
                        logMessage('Log messages copied to clipboard', 'INFO');
                    })
                    .catch(err => {
                        logMessage('Failed to copy log messages: ' + err, 'ERROR');
                        // Fallback method
                        fallbackCopyToClipboard(logText);
                    });
            }
        });
        logMessage('Copy log button enabled', 'DEBUG');
    }
    
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', function() {
            const logArea = document.getElementById('log-area');
            if (logArea) {
                logArea.value = '';
                logMessage('Log messages cleared', 'INFO');
            }
        });
        logMessage('Clear log button enabled', 'DEBUG');
    }
    
    // Add event listener for share button
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', function() {
            const urlInput = document.getElementById('url-image');
            if (urlInput && urlInput.value) {
                const imageUrl = encodeURIComponent(urlInput.value.trim());
                // Create a shareable URL that includes the current page URL and the image URL as a parameter
                const currentURL = new URL(window.location.href);
                // Remove any existing query parameters and hash
                currentURL.search = '';
                currentURL.hash = '';
                const shareableURL = `${currentURL.toString()}?image=${imageUrl}`;
                
                // Copy to clipboard
                navigator.clipboard.writeText(shareableURL)
                    .then(() => {
                        logMessage('Shareable link copied to clipboard', 'INFO');
                        // Show a temporary success message on the button
                        const originalText = shareBtn.innerHTML;
                        shareBtn.innerHTML = '<i class="bi bi-check"></i> Copied!';
                        shareBtn.classList.add('btn-success');
                        shareBtn.classList.remove('btn-outline-secondary');
                        
                        setTimeout(() => {
                            shareBtn.innerHTML = originalText;
                            shareBtn.classList.remove('btn-success');
                            shareBtn.classList.add('btn-outline-secondary');
                        }, 2000);
                    })
                    .catch(err => {
                        logMessage('Failed to copy shareable link: ' + err, 'ERROR');
                        // Fallback method
                        fallbackCopyToClipboard(shareableURL);
                    });
            } else {
                logMessage('No image URL to share', 'WARN');
            }
        });
        logMessage('Share button enabled', 'DEBUG');
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
    
    // Add event listener for local image input
    const localImageInput = document.getElementById('local-image');
    if (localImageInput) {
        localImageInput.addEventListener('change', function(event) {
            logMessage('Local image file selected');
            loadLocalImage(event);
        });
        logMessage('Local image input enabled', 'DEBUG');
    } else {
        logMessage('Could not find local image input', 'ERROR');
    }
    
    // Enable image adjustment tools
    const brightnessSlider = document.getElementById('brightness');
    const contrastSlider = document.getElementById('contrast');
    
    if (brightnessSlider && contrastSlider) {
        brightnessSlider.addEventListener('input', function() {
            const newValue = parseInt(this.value);
            logMessage(`Brightness adjusted to: ${newValue}`);
            updateImageFilters();
            recordImageAdjustment('brightness', newValue);
        });
        
        contrastSlider.addEventListener('input', function() {
            const newValue = parseInt(this.value);
            logMessage(`Contrast adjusted to: ${newValue}`);
            updateImageFilters();
            recordImageAdjustment('contrast', newValue);
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
    
    // Add event listener for the Laser Pointer button
    const laserPointerButton = document.getElementById('tool-laser');
    if (laserPointerButton) {
        laserPointerButton.addEventListener('click', function() {
            logMessage('Laser Pointer tool selected', 'INFO');
            recordToolChange('laserPointer');
            
            // Deactivate bounding box if it's active
            if (window.DrawingTools && typeof window.DrawingTools.deactivateBoundingBox === 'function') {
                window.DrawingTools.deactivateBoundingBox();
            }
            
            // Note: We DON'T remove the existing bounding box when switching tools,
            // allowing it to remain visible but no longer editable
            
            // Show laser pointer notification
            if (window.DrawingTools && typeof window.DrawingTools.showLaserPointerNotification === 'function') {
                window.DrawingTools.showLaserPointerNotification();
            }
            
            // Update UI to show selected tool
            const allToolButtons = document.querySelectorAll('.btn-group-vertical .btn');
            allToolButtons.forEach(button => {
                button.classList.remove('active');
                button.classList.remove('btn-primary');
                button.classList.add('btn-outline-primary');
            });
            
            // Highlight this button
            laserPointerButton.classList.add('active');
            laserPointerButton.classList.remove('btn-outline-primary');
            laserPointerButton.classList.add('btn-primary');
        });
        
        logMessage('Laser Pointer button enabled', 'DEBUG');
    } else {
        logMessage('Could not find Laser Pointer button', 'WARN');
    }
    
    // ADDED: Make Laser Pointer the default active tool on startup
    if (laserPointerButton) {
        laserPointerButton.click();
        logMessage('Set Laser Pointer as default tool', 'INFO');
    }
    
    // Add event listeners for the Pointer and Draw mode buttons
    const pointerButton = document.getElementById('mode-pointer');
    const cornersButton = document.getElementById('mode-corners');
    
    if (pointerButton && cornersButton) {
        // Pointer mode button
        pointerButton.addEventListener('click', function() {
            if (window.DrawingTools && typeof window.DrawingTools.setBoundingBoxMode === 'function') {
                window.DrawingTools.setBoundingBoxMode('pointer');
                
                // Update UI
                pointerButton.classList.remove('btn-outline-primary');
                pointerButton.classList.add('btn-primary');
                cornersButton.classList.remove('btn-primary');
                cornersButton.classList.add('btn-outline-primary');
                
                // Remove notification call to avoid popup
                // if (window.DrawingTools && typeof window.DrawingTools.showBoundingBoxNotification === 'function') {
                //    window.DrawingTools.showBoundingBoxNotification();
                // }
                
                // ADDED: Remove any "Bounding Box Mode Active" notifications 
                setTimeout(() => {
                    // Find and remove any elements containing "Bounding Box Mode Active" text
                    const elements = document.querySelectorAll('div');
                    elements.forEach(el => {
                        if (el.innerText && el.innerText.includes('Bounding Box Mode Active')) {
                            logMessage('Removing popup notification about bounding box', 'DEBUG');
                            el.parentNode.removeChild(el);
                        }
                    });
                }, 0);
                
                logMessage('Pointer mode activated for bounding box', 'INFO');
            } else {
                logMessage('Pointer mode function not available', 'ERROR');
            }
        });
        
        // Draw mode button
        cornersButton.addEventListener('click', function() {
            if (window.DrawingTools && typeof window.DrawingTools.setBoundingBoxMode === 'function') {
                window.DrawingTools.setBoundingBoxMode('corners');
                
                // Update UI
                cornersButton.classList.remove('btn-outline-primary');
                cornersButton.classList.add('btn-primary');
                pointerButton.classList.remove('btn-primary');
                pointerButton.classList.add('btn-outline-primary');
                
                // Remove notification call to avoid popup
                // if (window.DrawingTools && typeof window.DrawingTools.showBoundingBoxNotification === 'function') {
                //    window.DrawingTools.showBoundingBoxNotification();
                // }
                
                // ADDED: Remove any "Bounding Box Mode Active" notifications 
                setTimeout(() => {
                    // Find and remove any elements containing "Bounding Box Mode Active" text
                    const elements = document.querySelectorAll('div');
                    elements.forEach(el => {
                        if (el.innerText && el.innerText.includes('Bounding Box Mode Active')) {
                            logMessage('Removing popup notification about bounding box', 'DEBUG');
                            el.parentNode.removeChild(el);
                        }
                    });
                }, 0);
                
                logMessage('Corners mode activated for bounding box', 'INFO');
            } else {
                logMessage('Corners mode function not available', 'ERROR');
            }
        });
        
        logMessage('Pointer and Draw mode buttons enabled', 'DEBUG');
    } else {
        logMessage('Could not find Pointer or Draw mode buttons', 'WARN');
    }

    // --- NEW: Zoom Controls --- 
    const zoomNaturalBtn = document.getElementById('zoom-natural-btn');
    if (zoomNaturalBtn) {
        zoomNaturalBtn.addEventListener('click', () => {
            if (typeof window.resizeCanvas === 'function') {
                logMessage('Resetting zoom to Natural Size 1:1', 'INFO');
                window.resizeCanvas(); 
            } else {
                logMessage('Error: resizeCanvas function not found.', 'ERROR');
            }
        });
    }

    const zoomMaxDimBtn = document.getElementById('zoom-max-dim-btn');
    if (zoomMaxDimBtn) {
        zoomMaxDimBtn.addEventListener('click', () => {
            if (typeof window.resizeCanvasToFit === 'function') {
                logMessage('Resizing image to fit max dimensions 1400x1400', 'INFO');
                window.resizeCanvasToFit(1400, 1400);
            } else {
                logMessage('Error: resizeCanvasToFit function not found.', 'ERROR');
            }
        });
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
        
        // Setup event listeners
        setupEventListeners();
        
        // Email handling is now done programmatically without a modal
        logMessage('Email handling now uses copy/download approach instead of modal', 'DEBUG');
        
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
    
    // Add event listener for the Bounding Box button
    const boundingBoxButton = document.getElementById('tool-bounding-box');
    if (boundingBoxButton) {
        boundingBoxButton.addEventListener('click', function() {
            logMessage('Bounding Box tool selected', 'INFO');
            recordToolChange('boundingBox');
            
            if (window.DrawingTools && typeof window.DrawingTools.initBoundingBox === 'function') {
                // Deactivate other tools first if needed
                if (typeof window.DrawingTools.deactivateBoundingBox === 'function') {
                    window.DrawingTools.deactivateBoundingBox();
                }
                
                // Activate bounding box mode
                window.DrawingTools.initBoundingBox();
                
                // ADDED: Remove any "Bounding Box Mode Active" notifications 
                setTimeout(() => {
                    // Find and remove any elements containing "Bounding Box Mode Active" text
                    const elements = document.querySelectorAll('div');
                    elements.forEach(el => {
                        if (el.innerText && el.innerText.includes('Bounding Box Mode Active')) {
                            logMessage('Removing popup notification about bounding box', 'DEBUG');
                            el.parentNode.removeChild(el);
                        }
                    });
                }, 0);
                
                // Update UI to show selected tool
                const allToolButtons = document.querySelectorAll('.btn-group-vertical .btn');
                allToolButtons.forEach(button => {
                    button.classList.remove('active');
                    button.classList.remove('btn-primary');
                    button.classList.add('btn-outline-primary');
                });
                
                // Highlight this button
                boundingBoxButton.classList.add('active');
                boundingBoxButton.classList.remove('btn-outline-primary');
                boundingBoxButton.classList.add('btn-primary');
                
                // Ensure the Draw mode button is active by default
                const cornersButton = document.getElementById('mode-corners');
                const pointerButton = document.getElementById('mode-pointer');
                if (cornersButton && pointerButton) {
                    // Set mode to 'corners' explicitly
                    if (typeof window.DrawingTools.setBoundingBoxMode === 'function') {
                        window.DrawingTools.setBoundingBoxMode('corners');
                    }
                    
                    // Update UI for mode buttons
                    cornersButton.classList.remove('btn-outline-primary');
                    cornersButton.classList.add('btn-primary');
                    pointerButton.classList.remove('btn-primary');
                    pointerButton.classList.add('btn-outline-primary');
                    
                    logMessage('Corners mode activated by default for bounding box', 'DEBUG');
                }
            } else {
                logMessage('Bounding Box functionality not available', 'ERROR');
            }
        });
        
        logMessage('Bounding Box button enabled', 'DEBUG');
    } else {
        logMessage('Could not find Bounding Box button', 'WARN');
    }
    
    // Add event listener for the Laser Pointer button
    const laserPointerButton = document.getElementById('tool-laser');
    if (laserPointerButton) {
        laserPointerButton.addEventListener('click', function() {
            logMessage('Laser Pointer tool selected', 'INFO');
            recordToolChange('laserPointer');
            
            // Deactivate bounding box if it's active
            if (window.DrawingTools && typeof window.DrawingTools.deactivateBoundingBox === 'function') {
                window.DrawingTools.deactivateBoundingBox();
            }
            
            // Note: We DON'T remove the existing bounding box when switching tools,
            // allowing it to remain visible but no longer editable
            
            // Show laser pointer notification
            if (window.DrawingTools && typeof window.DrawingTools.showLaserPointerNotification === 'function') {
                window.DrawingTools.showLaserPointerNotification();
            }
            
            // Update UI to show selected tool
            const allToolButtons = document.querySelectorAll('.btn-group-vertical .btn');
            allToolButtons.forEach(button => {
                button.classList.remove('active');
                button.classList.remove('btn-primary');
                button.classList.add('btn-outline-primary');
            });
            
            // Highlight this button
            laserPointerButton.classList.add('active');
            laserPointerButton.classList.remove('btn-outline-primary');
            laserPointerButton.classList.add('btn-primary');
        });
        
        logMessage('Laser Pointer button enabled', 'DEBUG');
    } else {
        logMessage('Could not find Laser Pointer button', 'WARN');
    }
}

/**
 * Load image from local file input
 * Retained function signature but removed implementation
 */
function loadLocalImage() {
    logMessage('Image loading event handling removed', 'DEBUG');
}

/**
 * Load image from local file input
 * @param {Event} event - The file input change event
 */
function loadLocalImage(event) {
    if (!event || !event.target || !event.target.files || !event.target.files[0]) {
        logMessage('No file selected', 'WARN');
        return;
    }
    
    const file = event.target.files[0];
    logMessage(`Loading local image: ${file.name} (${Math.round(file.size/1024)} KB)`, 'INFO');
    
    // Create a FileReader to read the image file
    const reader = new FileReader();
    
    // Set up the onload handler
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        logMessage('File loaded, processing image...', 'INFO');
        
        // Use the same function that handles URL images
        loadImageFromUrl(dataUrl);
    };
    
    // Set up error handler
    reader.onerror = function() {
        logMessage('Error reading local file', 'ERROR');
    };
    
    // Read the file as a data URL
    reader.readAsDataURL(file);
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

/**
 * Initialize Bootstrap tooltips
 */
function initializeTooltips() {
    try {
        // Check if Bootstrap tooltip is available
        if (typeof bootstrap !== 'undefined' && typeof bootstrap.Tooltip !== 'undefined') {
            // Initialize all tooltips
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
            logMessage('Bootstrap tooltips initialized', 'DEBUG');
        } else {
            logMessage('Bootstrap Tooltip not available', 'WARN');
        }
    } catch (error) {
        console.error('Error initializing tooltips:', error);
        logMessage('Failed to initialize tooltips: ' + error.message, 'ERROR');
    }
}

/**
 * Fallback method to copy text to clipboard
 * @param {string} text - Text to copy
 */
function fallbackCopyToClipboard(text) {
    try {
        // Create textarea element
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Make the textarea out of viewport
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        
        // Select and copy
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            logMessage('Log content copied to clipboard using fallback method', 'INFO');
        } else {
            logMessage('Unable to copy log to clipboard using fallback method', 'WARN');
            alert('Could not copy log to clipboard. Please select the text manually and copy it.');
        }
    } catch (err) {
        logMessage(`Error in fallback copy: ${err.message}`, 'ERROR');
        alert('Could not copy log to clipboard. Please select the text manually and copy it.');
    }
}

/**
 * Parse URL parameters to check for an image URL to load automatically
 */
function parseUrlForImage() {
    try {
        // First try the standard query parameter approach
        const urlParams = new URLSearchParams(window.location.search);
        const imageUrl = urlParams.get('image');
        
        if (imageUrl) {
            // Image found in query parameter
            logMessage(`Image URL found in query parameters: ${imageUrl}`, 'INFO');
            
            // Update the URL input field
            const urlInput = document.getElementById('url-image');
            if (urlInput) urlInput.value = imageUrl;
            
            // Load the image
            loadImageFromUrl(imageUrl);
            return;
        }
        
        // Check for hash fragment parameters (format: #image=URL)
        const hash = window.location.hash;
        if (hash && hash.includes('image=')) {
            const hashImageUrl = hash.substring(hash.indexOf('image=') + 6);
            // Handle any additional hash parameters by cutting at the first &
            const cleanImageUrl = hashImageUrl.split('&')[0];
            
            if (cleanImageUrl) {
                logMessage(`Image URL found in hash fragment: ${cleanImageUrl}`, 'INFO');
                
                // Update the URL input field
                const urlInput = document.getElementById('url-image');
                if (urlInput) urlInput.value = cleanImageUrl;
                
                // Load the image
                loadImageFromUrl(cleanImageUrl);
                return;
            }
        }
        
        // Alternative format: Check if URL contains a plus (+) sign to separate base URL from image URL
        // Format: http://github.com/ProgramItUp/web_photo_annotate+myURL.com/myimage.jpg
        const fullUrl = window.location.href;
        const plusIndex = fullUrl.indexOf('+');
        
        if (plusIndex !== -1) {
            // Extract everything after the + sign
            const extractedImageUrl = fullUrl.substring(plusIndex + 1);
            
            if (extractedImageUrl) {
                logMessage(`Image URL found using + separator: ${extractedImageUrl}`, 'INFO');
                
                // Update the URL input field
                const urlInput = document.getElementById('url-image');
                if (urlInput) urlInput.value = extractedImageUrl;
                
                // Load the image
                loadImageFromUrl(extractedImageUrl);
                return;
            }
        }
        
        // If we reach here, no image URL was found
        logMessage('No image URL found in URL parameters', 'DEBUG');
    } catch (error) {
        logMessage(`Error parsing URL for image: ${error.message}`, 'ERROR');
    }
}

console.log('=== app.js: LOADING COMPLETED ===');

// *** NEW FUNCTION: Record Image Adjustment ***
/**
 * Records an image adjustment event if recording is active.
 * @param {string} adjustmentType - 'brightness' or 'contrast'
 * @param {number} value - The new value
 */
function recordImageAdjustment(adjustmentType, value) {
    if (typeof window.isRecording === 'function' && window.isRecording() && !window.isPaused()) {
        const now = Date.now();
        const timeOffset = typeof window.getCurrentRecordingTime === 'function' ? window.getCurrentRecordingTime() : now;

        const adjustmentEvent = {
            event_id: `adjust_${adjustmentType}_${now}`,
            time_offset: timeOffset,
            adjustment_type: adjustmentType,
            value: value
        };

        // Ensure category exists
        if (!window.recordedEvents.image_adjustments) {
            window.recordedEvents.image_adjustments = [];
        }
        window.recordedEvents.image_adjustments.push(adjustmentEvent);
        logMessage(`Recorded image adjustment: ${adjustmentType}=${value} at offset ${timeOffset}ms`, 'DEBUG');
    } else {
        logMessage(`Image adjustment event ignored: ${adjustmentType}=${value} (not recording)`, 'DEBUG');
    }
}

// *** NEW FUNCTION: Record Tool Change ***
/**
 * Records a tool change event if recording is active.
 * @param {string} toolName - The name of the newly selected tool
 */
function recordToolChange(toolName) {
    if (typeof window.isRecording === 'function' && window.isRecording() && !window.isPaused()) {
        const now = Date.now();
        const timeOffset = typeof window.getCurrentRecordingTime === 'function' ? window.getCurrentRecordingTime() : now;

        const toolChangeEvent = {
            event_id: `tool_${toolName}_${now}`,
            time_offset: timeOffset,
            tool_name: toolName
        };

        // Ensure category exists
        if (!window.recordedEvents.tool_change) {
            window.recordedEvents.tool_change = [];
        }
        window.recordedEvents.tool_change.push(toolChangeEvent);
        logMessage(`Recorded tool change: ${toolName} at offset ${timeOffset}ms`, 'DEBUG');
    } else {
        logMessage(`Tool change event ignored: ${toolName} (not recording)`, 'DEBUG');
    }
} 