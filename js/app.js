/**
 * Main application file for the image annotation tool
 */

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the canvas
    initializeCanvas();
    
    // Initialize the email modal
    initializeEmailModal();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set window resize listener
    window.addEventListener('resize', resizeCanvas);
    
    // Load default image
    loadDefaultImage();
    
    logMessage('Application initialized');
});

/**
 * Set up all event listeners for the application
 */
function setupEventListeners() {
    // Image loading
    document.getElementById('local-image').addEventListener('change', loadLocalImage);
    document.getElementById('load-url-btn').addEventListener('click', loadUrlImage);
    
    // Image adjustments
    document.getElementById('brightness').addEventListener('input', updateImageFilters);
    document.getElementById('contrast').addEventListener('input', updateImageFilters);
    document.getElementById('cursor-size').addEventListener('input', updateCursorSize);
    document.getElementById('cursor-tail-toggle').addEventListener('change', function() {
        showCursorTail = this.checked;
        logMessage(`Cursor trail ${showCursorTail ? 'enabled' : 'disabled'}`);
    });
    
    // Drawing tools
    document.getElementById('tool-select').addEventListener('click', () => setTool('select'));
    document.getElementById('tool-dot').addEventListener('click', () => setTool('dot'));
    document.getElementById('tool-box').addEventListener('click', () => setTool('box'));
    document.getElementById('tool-circle').addEventListener('click', () => setTool('circle'));
    document.getElementById('tool-squiggle').addEventListener('click', () => setTool('squiggle'));
    document.getElementById('tool-arrow').addEventListener('click', () => setTool('arrow'));
    document.getElementById('delete-selected').addEventListener('click', deleteSelected);
    
    // Audio recording
    document.getElementById('record-btn').addEventListener('click', toggleRecording);
    document.getElementById('pause-btn').addEventListener('click', pauseResumeRecording);
    
    // File operations
    document.getElementById('save-btn').addEventListener('click', saveAnnotationData);
    document.getElementById('email-btn').addEventListener('click', showEmailModal);
    document.getElementById('load-btn').addEventListener('click', () => document.getElementById('load-file').click());
    document.getElementById('load-file').addEventListener('change', loadAnnotationData);
    document.getElementById('replay-btn').addEventListener('click', replayRecording);
    
    // Log area
    document.getElementById('clear-log').addEventListener('click', function() {
        document.getElementById('log-area').value = '';
        logMessage('Log cleared');
    });
} 