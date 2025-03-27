/**
 * Utility functions for the image annotation application
 */

// Constants
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

let emailModal;
let currentLogLevel = LOG_LEVELS.DEBUG; // Set default log level

/**
 * Log a message with a timestamp and level
 * @param {string} message - The message to log
 * @param {string} level - The log level: DEBUG, INFO, WARN, ERROR
 */
function logMessage(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logArea = document.getElementById('log-area');
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(formattedMessage);
    
    // Only log messages above the current log level
    if (LOG_LEVELS[level] >= currentLogLevel && logArea) {
        logArea.value = logArea.value + formattedMessage + '\n';
        logArea.scrollTop = logArea.scrollHeight;
    }
    
    // If this is a cursor trail update message, handle it specially
    if (typeof message === 'string' && message.startsWith('Cursor trail updated:')) {
        handleCursorTrailUpdate(message);
    }
}

/**
 * Encode large JSON data to base64 safely handling Unicode characters
 * @param {Object} data - The data object to encode
 * @returns {string} - Base64 encoded string
 */
function encodeAnnotationData(data) {
    try {
        // Convert to JSON string
        const jsonString = JSON.stringify(data, null, 2);
        
        // Handle Unicode characters properly
        const encodedData = unescape(encodeURIComponent(jsonString));
        
        // Convert to base64
        return btoa(encodedData);
    } catch (error) {
        logMessage(`Error encoding data to base64: ${error.message}`, 'ERROR');
        
        // Try alternative encoding for large strings
        try {
            // Convert the data in chunks to avoid memory issues
            return encodeJsonInChunks(data);
        } catch (chunkError) {
            logMessage(`Chunked encoding failed: ${chunkError.message}`, 'ERROR');
            throw error; // Rethrow the original error if all attempts fail
        }
    }
}

/**
 * Encode large JSON data to base64 in chunks to handle memory limitations
 * @param {Object} data - The data object to encode
 * @returns {string} - Base64 encoded string
 */
function encodeJsonInChunks(data) {
    // Convert to JSON string
    const jsonString = JSON.stringify(data);
    
    // Process the string in chunks
    const chunkSize = 1024 * 100; // 100KB chunks
    let encodedResult = '';
    
    for (let i = 0; i < jsonString.length; i += chunkSize) {
        const chunk = jsonString.substring(i, i + chunkSize);
        const encodedChunk = btoa(unescape(encodeURIComponent(chunk)));
        encodedResult += encodedChunk;
    }
    
    return encodedResult;
}

/**
 * Download a file blob
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename to use
 */
function downloadFile(blob, filename) {
    try {
        // Use FileSaver.js if available
        if (typeof saveAs === 'function') {
            saveAs(blob, filename);
            logMessage(`File "${filename}" downloaded`, 'INFO');
            return;
        }
        
        // Fallback to manual download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        logMessage(`File "${filename}" downloaded`, 'INFO');
    } catch (error) {
        logMessage(`Error downloading file: ${error.message}`, 'ERROR');
    }
}

// Export utility functions to window object
window.logMessage = logMessage;
window.encodeAnnotationData = encodeAnnotationData;
window.encodeJsonInChunks = encodeJsonInChunks;
window.downloadFile = downloadFile;
window.handleCursorTrailUpdate = handleCursorTrailUpdate;
window.transformCoordinates = transformCoordinates;
window.showEmailModal = showEmailModal;
window.sendEmail = sendEmail;
window.initializeEmailModal = initializeEmailModal;

/**
 * Handle cursor trail update message
 * This is a placeholder for future functionality
 * @param {string} message - The cursor trail update message
 */
function handleCursorTrailUpdate(message) {
    // Extract X and Y coordinates from message
    const match = message.match(/X: (\d+), Y: (\d+)/);
    if (match && match.length >= 3) {
        const x = parseInt(match[1], 10);
        const y = parseInt(match[2], 10);
        
        // This is where we would handle the cursor trail update
        // e.g., update the cursor trail visualization
    }
}

/**
 * Transform canvas coordinates
 * @param {Object} pointer - The canvas pointer object
 * @returns {Object} The transformed coordinates
 */
function transformCoordinates(pointer) {
    // This function will be implemented for coordinate transformations
    return pointer;
}

/**
 * Show email modal
 * This function is only kept for compatibility
 */
function showEmailModal() {
    logMessage('Email modal functionality replaced with direct dialog', 'DEBUG');
}

/**
 * Send Email
 * This function is only kept for compatibility
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