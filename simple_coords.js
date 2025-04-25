// DOM Elements
const img = document.getElementById('main-image');
const coords = document.getElementById('coordinates');
const imageInfo = document.getElementById('image-info');
const logArea = document.getElementById('log-area');
const localImageInput = document.getElementById('local-image');
const zoomRange = document.getElementById('zoom-range');
const brightnessRange = document.getElementById('brightness-range');
const contrastRange = document.getElementById('contrast-range');
const copyLogBtn = document.getElementById('copy-log');
const clearLogBtn = document.getElementById('clear-log');
const toolDotBtn = document.getElementById('tool-dot');
const toolClearBtn = document.getElementById('tool-clear');
const imageContainer = document.getElementById('image-container');

// State
let activeTool = null;
let zoomFactor = 1;
let dots = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    
    // Set up initial zoom state
    zoomFactor = 1;
    window.zoomFactor = zoomFactor;
    window.zoomLevel = zoomFactor;
    console.log('Initial zoom factor:', zoomFactor);
    
    updateImageInfo();
    setupEventListeners();
    // Set initial tool
    setActiveTool('dot');
});

// Update image information
function updateImageInfo() {
    console.log('Updating image info');
    if (img.complete) {
        imageInfo.textContent = `Width: ${img.naturalWidth}px, Height: ${img.naturalHeight}px`;
    } else {
        img.onload = () => {
            imageInfo.textContent = `Width: ${img.naturalWidth}px, Height: ${img.naturalHeight}px`;
        };
    }
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Image loading
    localImageInput.addEventListener('change', loadLocalImage);
    
    // Mouse tracking
    img.addEventListener('mousemove', handleMouseMove);
    img.addEventListener('click', handleMouseClick);
    img.addEventListener('mouseleave', () => {
        coords.textContent = 'Mouse: X: -, Y: -';
    });
    
    // Log console event for debugging
    img.addEventListener('mouseover', () => {
        console.log('Mouse entered image');
    });
    
    // Tool buttons
    toolDotBtn.addEventListener('click', () => setActiveTool('dot'));
    toolClearBtn.addEventListener('click', clearAllDots);
    
    // Image adjustments
    zoomRange.addEventListener('input', updateZoom);
    brightnessRange.addEventListener('input', updateFilters);
    contrastRange.addEventListener('input', updateFilters);
    
    // Log management
    copyLogBtn.addEventListener('click', copyLog);
    clearLogBtn.addEventListener('click', clearLog);
}

// Handle mouse movement over image
function handleMouseMove(event) {
    const pixelCoords = getImagePixelCoordinates(event);
    coords.textContent = `Mouse: X: ${pixelCoords.x}, Y: ${pixelCoords.y}`;
    console.log(`Mouse: X: ${pixelCoords.x}, Y: ${pixelCoords.y}`);
}

// Handle mouse click on image
function handleMouseClick(event) {
    const pixelCoords = getImagePixelCoordinates(event);
    console.log(`Click: X: ${pixelCoords.x}, Y: ${pixelCoords.y}`);
    
    if (activeTool === 'dot') {
        addDot(pixelCoords.x, pixelCoords.y);
        logCoordinates(pixelCoords.x, pixelCoords.y);
    }
}

// Get image pixel coordinates from mouse event
function getImagePixelCoordinates(event) {
    // Get the bounding rectangle of the image
    const rect = img.getBoundingClientRect();
    
    // Calculate mouse position relative to the image
    const x = Math.floor((event.clientX - rect.left) / zoomFactor);
    const y = Math.floor((event.clientY - rect.top) / zoomFactor);
    
    // Clamp to image bounds
    const px = Math.max(0, Math.min(x, img.naturalWidth - 1));
    const py = Math.max(0, Math.min(y, img.naturalHeight - 1));
    
    return { x: px, y: py };
}

// Set active tool
function setActiveTool(tool) {
    console.log('Setting active tool:', tool);
    activeTool = tool;
    
    // Update UI to reflect active tool
    document.querySelectorAll('.btn-outline-primary').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (tool === 'dot') {
        toolDotBtn.classList.add('active');
    }
}

// Add a dot at the specified coordinates
function addDot(x, y) {
    // Create dot element
    const dot = document.createElement('div');
    dot.className = 'annotation-dot';
    dot.style.position = 'absolute';
    dot.style.left = `${x * zoomFactor}px`;
    dot.style.top = `${y * zoomFactor}px`;
    
    // Add to container and track
    imageContainer.appendChild(dot);
    dots.push(dot);
    
    console.log(`Added dot at: ${x}, ${y}`);
}

// Update zoom
function updateZoom() {
    zoomFactor = parseFloat(zoomRange.value);
    
    // Make sure zoomFactor is also available globally for our utils.js functions
    window.zoomFactor = zoomFactor;
    
    // Also set window.zoomLevel for backward compatibility
    window.zoomLevel = zoomFactor;
    
    console.log(`Zoom updated: ${zoomFactor} (exposed globally as window.zoomLevel and window.zoomFactor)`);
    
    img.style.transform = `scale(${zoomFactor})`;
    img.style.transformOrigin = 'top left';
    
    // Adjust dot positions
    dots.forEach(dot => {
        // Extract the original coordinates
        const left = parseInt(dot.style.left) / (zoomFactor / parseFloat(zoomRange.value));
        const top = parseInt(dot.style.top) / (zoomFactor / parseFloat(zoomRange.value));
        
        // Update with new zoom
        dot.style.left = `${left * zoomFactor}px`;
        dot.style.top = `${top * zoomFactor}px`;
    });
}

// Update brightness/contrast
function updateFilters() {
    const brightness = parseInt(brightnessRange.value);
    const contrast = parseInt(contrastRange.value);
    img.style.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`;
    console.log(`Filters updated: brightness=${brightness}, contrast=${contrast}`);
}

// Clear all dots
function clearAllDots() {
    console.log('Clearing all dots');
    dots.forEach(dot => dot.remove());
    dots = [];
}

// Log coordinates
function logCoordinates(x, y) {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const message = `[${timestamp}] Dot added at X: ${x}, Y: ${y}`;
    logArea.value += message + '\n';
    logArea.scrollTop = logArea.scrollHeight; // Scroll to bottom
}

// Copy log to clipboard
function copyLog() {
    logArea.select();
    document.execCommand('copy');
    window.getSelection().removeAllRanges();
}

// Clear log
function clearLog() {
    logArea.value = '';
}

// Load local image
function loadLocalImage(event) {
    console.log('Loading local image');
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        img.src = e.target.result;
        img.onload = function() {
            updateImageInfo();
            clearAllDots();
            // Reset zoom
            zoomFactor = 1;
            zoomRange.value = 1;
            window.zoomFactor = 1;
            window.zoomLevel = 1;
            img.style.transform = '';
            // Reset filters
            brightnessRange.value = 0;
            contrastRange.value = 0;
            img.style.filter = '';
            
            console.log('Image loaded, zoom reset to 1.0');
        };
    };
    reader.readAsDataURL(file);
} 