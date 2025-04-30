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
    const timestamp = getFormattedTimestamp();
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
 * Decode base64 encoded annotation data back to JSON object
 * @param {string} encodedData - The base64 encoded data string
 * @returns {Object} - The decoded data object
 */
function decodeAnnotationData(encodedData) {
    try {
        // Decode base64 to string
        const decodedString = atob(encodedData);
        
        // Handle Unicode characters properly
        const jsonString = decodeURIComponent(escape(decodedString));
        
        // Parse JSON
        return JSON.parse(jsonString);
    } catch (error) {
        logMessage(`Error decoding base64 data: ${error.message}`, 'ERROR');
        
        // Try alternative decoding for large strings
        try {
            return decodeBase64InChunks(encodedData);
        } catch (chunkError) {
            logMessage(`Chunked decoding failed: ${chunkError.message}`, 'ERROR');
            throw error; // Rethrow the original error if all attempts fail
        }
    }
}

/**
 * Decode large base64 encoded data in chunks to handle memory limitations
 * @param {string} encodedData - The base64 encoded data string
 * @returns {Object} - The decoded data object
 */
function decodeBase64InChunks(encodedData) {
    // Process the string in chunks
    const chunkSize = 1024 * 100; // 100KB chunks
    let decodedResult = '';
    
    for (let i = 0; i < encodedData.length; i += chunkSize) {
        const chunk = encodedData.substring(i, i + chunkSize);
        try {
            const decodedChunk = atob(chunk);
            decodedResult += decodedChunk;
        } catch (error) {
            logMessage(`Error decoding chunk at position ${i}: ${error.message}`, 'ERROR');
            // Continue with other chunks
        }
    }
    
    // Handle Unicode characters
    const jsonString = decodeURIComponent(escape(decodedResult));
    
    // Parse JSON
    return JSON.parse(jsonString);
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
window.decodeAnnotationData = decodeAnnotationData;
window.decodeBase64InChunks = decodeBase64InChunks;
window.downloadFile = downloadFile;
window.handleCursorTrailUpdate = handleCursorTrailUpdate;
window.transformCoordinates = transformCoordinates;
window.showEmailModal = showEmailModal;
window.sendEmail = sendEmail;
window.initializeEmailModal = initializeEmailModal;
window.getFilenameBase = getFilenameBase;

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

/**
 * Extracts the base filename (without extension) from a URL or path string.
 * Handles URLs, simple paths, and returns a default for data URLs or empty inputs.
 * @param {string | null | undefined} urlOrPath - The URL or path string.
 * @returns {string} The base filename or a default name.
 */
function getFilenameBase(urlOrPath) {
    if (!urlOrPath) {
        return 'annotation';
    }

    // Handle data URLs - No longer needed here, name is captured on load.
    // Return a generic name if somehow a data URL is passed directly.
    if (urlOrPath.startsWith('data:')) {
        return 'image_data'; 
    }

    try {
        // Use URL parsing for robustness
        const url = new URL(urlOrPath);
        let pathname = url.pathname;

        // Get the part after the last slash
        const lastSlashIndex = pathname.lastIndexOf('/');
        let filename = (lastSlashIndex >= 0) ? pathname.substring(lastSlashIndex + 1) : pathname;

        // Remove extension
        const dotIndex = filename.lastIndexOf('.');
        if (dotIndex > 0) { // Ensure dot is not the first character
            return filename.substring(0, dotIndex);
        }
        return filename || 'image'; // Return filename or a default if empty after processing

    } catch (e) {
        // Fallback for simple paths that aren't valid URLs
        let filename = urlOrPath;
        const lastSlashIndex = filename.lastIndexOf('/');
        if (lastSlashIndex >= 0) {
            filename = filename.substring(lastSlashIndex + 1);
        }
        const lastBackslashIndex = filename.lastIndexOf('\\\\'); // Handle Windows paths
        if (lastBackslashIndex >= 0) {
            filename = filename.substring(lastBackslashIndex + 1);
        }

        const dotIndex = filename.lastIndexOf('.');
        if (dotIndex > 0) {
            return filename.substring(0, dotIndex);
        }
        return filename || 'annotation'; // Default fallback
    }
}

function getFormattedTimestamp() {
    const now = new Date();
    const options = {
        timeZone: 'America/New_York',
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // Use 24-hour format internally for consistency
    };

    // Format the date and time parts according to the locale and timezone
    // We'll manually reconstruct the MM/DD/YY HH:MM:SS part
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    // Construct the date/time string in the desired format
    const dateStr = `${parts.month}/${parts.day}/${parts.year}`;
    const timeStr = `${parts.hour}:${parts.minute}:${parts.second}`;
    
    // Get milliseconds separately as Intl.DateTimeFormat doesn't handle them reliably across all browsers/versions in this way
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0'); 

    return `${dateStr} ${timeStr}.${milliseconds}`;
} 