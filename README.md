# Web Image Annotation Tool

A standalone web application for annotating images and recording mouse movements and audio.

## Features

- Load images from local storage or URL
- Pan the image with Ctrl+click and drag
- Zoom the image with mouse wheel
- Adjust image brightness and contrast
- Draw annotations (boxes, circles, squiggles, arrows)
- Track mouse position and state
- Optional cursor trail to show movement history
- Record audio from microphone with volume visualization
- Save/load annotation data
- Option to email annotation data
- Replay recorded mouse movements
- Load images directly via URL parameters

## Project Structure

The application is organized into multiple files for better maintainability:

```
/
├── index.html           # Main HTML structure
├── css/
│   └── styles.css       # CSS styles for the application
├── js/
│   ├── app.js           # Main application initialization
│   ├── canvas.js        # Canvas setup 
│   ├── config.js        # Configuration constants
│   ├── drawing-tools.js # Drawing tools (box, circle, arrow, etc.)
│   ├── image-tools.js   # Image loading and filtering
│   ├── recording.js     # Audio and mouse recording functionality
│   └── utils.js         # Utility functions and helpers
└── README.md            # Project documentation
```

## Usage

1. Open `index.html` in a web browser that supports HTML5 Canvas and the Web Audio API
2. Load an image using the file input or URL field
3. Navigate the image using Ctrl+click to pan and mouse wheel to zoom
4. Use the drawing tools to annotate the image
5. Adjust brightness, contrast, and cursor size as needed
6. Enable cursor trail for visual tracking (optional)
7. Record mouse movements and audio by clicking the "Start Recording" button
8. Save your annotation data using the "Save Annotation Data" button
9. Optionally replay your recording with the "Replay Recording" button

### Loading Images via URL Parameters

You can automatically load an image when opening the application by using one of the following URL formats:

1. Query parameter format:
   ```
   index.html?image=https://example.com/image.jpg
   ```

2. Hash fragment format:
   ```
   index.html#image=https://example.com/image.jpg
   ```

3. Plus sign separator format:
   ```
   index.html+https://example.com/image.jpg
   ```

All image loading is processed locally - no data is sent to external servers.

## Dependencies

This application uses several libraries, all loaded via CDN:

- fabric.js - Canvas manipulation and drawing tools
- RecordRTC - Audio recording
- FileSaver.js - File download functionality
- Bootstrap - UI components and styling
- EmailJS - Email functionality (requires configuration)

## Browser Compatibility

This tool works best in modern browsers such as:
- Google Chrome
- Mozilla Firefox
- Microsoft Edge
- Safari (latest versions)

## Notes

- The email functionality requires additional configuration with an email service
- All data is processed client-side; no server interaction is required
- Audio and image data are stored locally in the browser 

