/**
 * Utility functions for the image annotation application
 */

// State variables
let emailModal;

/**
 * Add a log message to the log area
 * @param {string} message - The message to log
 */
function logMessage(message) {
    const logArea = document.getElementById('log-area');
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    logArea.value += `[${timestamp}] ${message}\n`;
    logArea.scrollTop = logArea.scrollHeight;
}

/**
 * Transform canvas coordinates
 * @param {Object} pointer - The canvas pointer object
 * @returns {Object} The transformed coordinates
 */
function transformCoordinates(pointer) {
    // Transforms canvas coordinates to image coordinates accounting for zoom and pan
    // For simplicity, we'll just return the canvas coordinates
    return {
        x: pointer.x,
        y: pointer.y
    };
}

/**
 * Show the email modal dialog
 */
function showEmailModal() {
    emailModal.show();
}

/**
 * Send annotation data via email
 */
function sendEmail() {
    const email = document.getElementById('email-address').value;
    if (!email) {
        alert('Please enter an email address.');
        return;
    }
    
    // Save data first
    const canvasData = canvas.toJSON();
    const annotationData = {
        canvasData: canvasData,
        mouseData: mouseData,
        hasAudio: audioBlob !== null,
        timestamp: new Date().toISOString()
    };
    
    // Convert to JSON
    const jsonData = JSON.stringify(annotationData);
    
    // For demonstration, we'll use EmailJS
    // In a real application, you'd want to set up EmailJS with your service ID, template ID, and user ID
    alert('Email functionality would require server-side implementation or Email service configuration. The data has been prepared but not sent.');
    
    // Close modal
    emailModal.hide();
    
    logMessage(`Email prepared for ${email}`);
}

/**
 * Initialize email modal
 */
function initializeEmailModal() {
    emailModal = new bootstrap.Modal(document.getElementById('emailModal'));
    
    // Add email button event listener
    document.getElementById('send-email-btn').addEventListener('click', sendEmail);
} 