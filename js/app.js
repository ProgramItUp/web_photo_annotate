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
    document.getElementById('load-url-btn').addEventListener('click', function() {
        logMessage('Loading image from URL');
        loadUrlImage();
    });
    
    // Image adjustments
    document.getElementById('brightness').addEventListener('input', updateImageFilters);
    document.getElementById('contrast').addEventListener('input', updateImageFilters);
    document.getElementById('cursor-size').addEventListener('input', updateCursorSize);
    document.getElementById('cursor-tail-toggle').addEventListener('change', function() {
        showCursorTail = this.checked;
        logMessage(`Cursor trail ${showCursorTail ? 'enabled' : 'disabled'}`);
    });
    
    // Drawing tools
    document.getElementById('tool-select').addEventListener('click', () => {
        logMessage('Selected tool: Select');
        setTool('select');
    });
    document.getElementById('tool-dot').addEventListener('click', () => {
        logMessage('Selected tool: Dot');
        setTool('dot');
    });
    document.getElementById('tool-box').addEventListener('click', () => {
        logMessage('Selected tool: Box');
        setTool('box');
    });
    document.getElementById('tool-circle').addEventListener('click', () => {
        logMessage('Selected tool: Circle');
        setTool('circle');
    });
    document.getElementById('tool-squiggle').addEventListener('click', () => {
        logMessage('Selected tool: Squiggle');
        setTool('squiggle');
    });
    document.getElementById('tool-arrow').addEventListener('click', () => {
        logMessage('Selected tool: Arrow');
        setTool('arrow');
    });
    document.getElementById('delete-selected').addEventListener('click', () => {
        logMessage('Deleting selected object');
        deleteSelected();
    });
    
    // Audio recording
    document.getElementById('record-btn').addEventListener('click', function() {
        console.log('Record button clicked - isRecording:', isRecording);
        logMessage(`Button click: ${isRecording ? 'Stop' : 'Start'} Recording`);
        toggleRecording();
    });
    document.getElementById('pause-btn').addEventListener('click', function() {
        console.log('Pause button clicked - isPaused:', isPaused);
        logMessage(`Button click: ${isPaused ? 'Resume' : 'Pause'} Recording`);
        pauseResumeRecording();
    });
    
    // File operations
    document.getElementById('save-btn').addEventListener('click', function() {
        logMessage('Button click: Save Annotation Data');
        saveAnnotationData();
    });
    document.getElementById('email-btn').addEventListener('click', function() {
        logMessage('Button click: Email Annotation Data');
        showEmailModal();
    });
    document.getElementById('load-btn').addEventListener('click', () => {
        logMessage('Button click: Load Annotation Data');
        document.getElementById('load-file').click();
    });
    document.getElementById('load-file').addEventListener('change', loadAnnotationData);
    document.getElementById('replay-btn').addEventListener('click', function() {
        logMessage('Button click: Replay Recording');
        replayRecording();
    });
    
    // Log area
    document.getElementById('clear-log').addEventListener('click', function() {
        document.getElementById('log-area').value = '';
        logMessage('Log cleared');
    });
} 