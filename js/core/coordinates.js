/**
 * Core module for image coordinate calculations
 * Provides accurate mapping between browser and image pixel coordinates
 */

/**
 * Converts a mouse event's coordinates to actual image pixel coordinates
 * @param {MouseEvent} event - The mouse event
 * @param {HTMLImageElement} imageElement - The image element
 * @param {number} zoomFactor - Current zoom level (default: 1)
 * @returns {Object} Object containing x, y coordinates in image pixel space
 */
export function getImagePixelCoordinates(event, imageElement, zoomFactor = 1) {
    // Get the bounding rectangle of the image
    const rect = imageElement.getBoundingClientRect();
    
    // Calculate mouse position relative to the image
    const x = Math.floor((event.clientX - rect.left) / zoomFactor);
    const y = Math.floor((event.clientY - rect.top) / zoomFactor);
    
    // Clamp to image bounds
    const px = Math.max(0, Math.min(x, imageElement.naturalWidth - 1));
    const py = Math.max(0, Math.min(y, imageElement.naturalHeight - 1));
    
    return { x: px, y: py };
}

/**
 * Converts canvas coordinates to image pixel coordinates
 * @param {number} canvasX - X coordinate in canvas space
 * @param {number} canvasY - Y coordinate in canvas space
 * @param {HTMLImageElement} imageElement - The image element
 * @param {number} zoomFactor - Current zoom level (default: 1)
 * @returns {Object} Object containing x, y coordinates in image pixel space
 */
export function canvasToImageCoordinates(canvasX, canvasY, imageElement, zoomFactor = 1) {
    return {
        x: Math.floor(canvasX / zoomFactor),
        y: Math.floor(canvasY / zoomFactor)
    };
}

/**
 * Converts image pixel coordinates to canvas coordinates
 * @param {number} imageX - X coordinate in image pixel space
 * @param {number} imageY - Y coordinate in image pixel space
 * @param {number} zoomFactor - Current zoom level (default: 1)
 * @returns {Object} Object containing x, y coordinates in canvas space
 */
export function imageToCanvasCoordinates(imageX, imageY, zoomFactor = 1) {
    return {
        x: imageX * zoomFactor,
        y: imageY * zoomFactor
    };
} 