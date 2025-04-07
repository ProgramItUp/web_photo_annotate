# Web Photo Annotation Application Architecture

This document provides an overview of the JavaScript files in the project, their purpose, and key function calls.

## Core JavaScript Files

### js/app.js
**Purpose**: Main application file for the image annotation tool. Entry point that handles initialization and UI interactions.

Key Functions:
- `initializeApp()`: Main initialization function that sets up the application.
- `setupEventListeners()`: Sets up event listeners for the application.
- `loadLocalImage(event)`: Handles loading images from local file inputs.
- `loadUrlImage()`: Loads images from URLs entered by the user.
- `loadDefaultImage()`: Loads a default image.
- `loadImageFromUrl(url)`: Core function for loading images onto the canvas.
- `logMessage(message, level)`: Logs messages to the application's log area.
- `updateImageFilters()`: Updates image filters based on slider values.
- `updateCursorSize()`: Updates cursor size based on slider value.
- `toggleCursorTrail(enable)`: Toggles the cursor trail feature on/off.

### js/canvas.js
**Purpose**: Handles all canvas-related functionality for image annotation using Fabric.js.

Key Functions:
- `initializeCanvas()`: Creates and configures the Fabric.js canvas.
- `resizeCanvas()`: Resizes the canvas to match image aspect ratio and container size.
- `initCursorTrail()`: Initializes cursor trail functionality.
- `setupCursorTrailTracking(canvas)`: Sets up mouse tracking for cursor trail feature.
- `updateCursorTrail(pointer)`: Updates the cursor trail with new mouse positions.
- `renderCursorTrail()`: Renders the cursor trail on the canvas.
- `calculateDistance(p1, p2)`: Utility to calculate distance between two points.
- `cleanupCursorTrail()`: Removes old cursor trail points.
- `updateCursorTrailStatus(active, ready)`: Updates the status of cursor trail.

### js/utils.js
**Purpose**: Utility functions used throughout the application.

Key Functions:
- `logMessage(message, level)`: Logging function with timestamp and log level.
- `encodeAnnotationData(data)`: Encodes large JSON data to base64.
- `encodeJsonInChunks(data)`: Handles encoding large JSON data in chunks for memory efficiency.
- `downloadFile(blob, filename)`: Handles file downloading functionality.
- `handleCursorTrailUpdate(message)`: Handles cursor trail update messages.
- `transformCoordinates(pointer)`: Transforms canvas coordinates.

### js/config.js
**Purpose**: Configuration settings for the image annotation application.

Key Constants:
- `DEFAULT_CURSOR_SIZE`: Default cursor size.
- `DEFAULT_BRIGHTNESS`: Default brightness value.
- `DEFAULT_CONTRAST`: Default contrast value.

### js/image-tools.js
**Purpose**: Provides image manipulation tools and filters.

Key Functions:
- Functions related to image manipulation, brightness, contrast, and other adjustments.

### js/recording.js
**Purpose**: Handles recording functionality for the application, including cursor movements and annotations.

Key Functions:
- Functions for recording annotations, cursor movements, and playback.

## Supporting JavaScript Files
## Integration Points

The application integrates several key components:
1. **Image Annotation**: Canvas-based annotation tools using Fabric.js
2. **Audio Recording**: Capturing audio for transcription
3. **Cursor Tracking**: Tracking cursor movements for recording and playback
4. **Data Management**: Saving and loading annotation data

## Event Flow

1. User loads an image (`loadImageFromUrl`)
2. Canvas is initialized and resized (`initializeCanvas`, `resizeCanvas`)
3. User can modify the image with filters (`updateImageFilters`)
4. User can annotate the image with cursor trail (`updateCursorTrail`)
5. Recording can be started to capture annotations (`recording.js` functionality)
6. Data can be exported, shared, or saved (`downloadFile`, `sharing.js` functionality)
