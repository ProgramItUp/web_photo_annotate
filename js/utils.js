/**
 * Utility functions for the image annotation application
 */

// State variables
let emailModal;

/**
 * Add a log message to the log area
 * @param {string} message - The message to log
 * @param {string} [level='INFO'] - Log level (INFO, WARN, ERROR, DEBUG)
 */
function logMessage(message, level = 'INFO') {
    const logArea = document.getElementById('log-area');
    if (!logArea) {
        console.log(`[${level}] ${message}`);
        return;
    }
    
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    let formattedMessage = `[${timestamp}] `;
    
    // Add log level prefix
    switch (level.toUpperCase()) {
        case 'ERROR':
            formattedMessage += `[ERROR] ${message}`;
            console.error(message);
            break;
        case 'WARN':
            formattedMessage += `[WARN] ${message}`;
            console.warn(message);
            break;
        case 'DEBUG':
            formattedMessage += `[DEBUG] ${message}`;
            console.debug(message);
            break;
        default:
            formattedMessage += message;
            console.log(message);
    }
    
    logArea.value += formattedMessage + '\n';
    logArea.scrollTop = logArea.scrollHeight;
}

// Export functions to window so they're globally accessible
window.logMessage = logMessage;
window.initializeEmailModal = initializeEmailModal;
window.showEmailModal = showEmailModal;
window.sendEmail = sendEmail;

/**
 * Transform canvas coordinates
 * @param {Object} pointer - The canvas pointer object
 * @returns {Object} The transformed coordinates
 */
function transformCoordinates(pointer) {
    // Get the current zoom level
    const zoom = canvas.getZoom();
    
    // Get viewport information
    const vpt = canvas.viewportTransform;
    
    // Calculate coordinates relative to the image, accounting for zoom and pan
    let adjustedX = pointer.x;
    let adjustedY = pointer.y;
    
    // If we have viewport transform, use it to adjust coordinates
    if (vpt) {
        // Reverse the viewport transform to get canvas coordinates
        adjustedX = (pointer.x - vpt[4]) / vpt[0];
        adjustedY = (pointer.y - vpt[5]) / vpt[3];
    }
    
    return {
        x: adjustedX,
        y: adjustedY
    };
}

/**
 * Show the email modal dialog
 * Event handling removed as requested
 */
function showEmailModal() {
    logMessage('Email modal event handling removed', 'DEBUG');
}

/**
 * Send annotation data via email
 * Event handling removed as requested
 */
function sendEmail() {
    logMessage('Email sending event handling removed', 'DEBUG');
}

/**
 * Initialize email modal
 * Event handling removed as requested
 */
function initializeEmailModal() {
    logMessage('Email modal initialization with event handling removed', 'DEBUG');
} 