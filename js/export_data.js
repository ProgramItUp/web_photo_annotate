/**
 * Main logic for the "Export data for Analysis" feature.
 */

// Ensure JSZip is loaded before this script
if (typeof JSZip === 'undefined') {
    console.error('JSZip library not found! Ensure it is loaded before export_data.js');
    logMessage('ExportData: JSZip library not found. Export functionality will be disabled.', 'ERROR');
    // Optionally disable the button permanently if JSZip fails to load
}

// Ensure audio_tools.js is loaded before this script
if (typeof decodeAudioBlob === 'undefined' || typeof extractAudioSegment === 'undefined' || typeof encodeAudioBufferToWebm === 'undefined') {
    console.error('Audio tools script (audio_tools.js) not fully loaded! Essential functions missing.');
    logMessage('ExportData: Required functions from audio_tools.js not found. Export functionality may fail.', 'ERROR');
}

// Export categories to process
const EXPORT_CATEGORIES = ['laser_pointer', 'bounding_box']; // Add other drawing tool categories as needed

/**
 * Main function to orchestrate the export process.
 */
async function exportForAnalysis() {
    logMessage('ExportData: Export process started by user.', 'INFO');
    const exportButton = document.getElementById('export-analysis-btn');
    const originalButtonText = exportButton ? exportButton.innerHTML : 'Export Data for Analysis';

    // --- 1. Validation --- 
    if (!window.recordedEvents || Object.keys(window.recordedEvents).length === 0) {
        logMessage('ExportData: No recorded events found to export.', 'WARN');
        alert('No annotation data available to export.');
        return;
    }
    if (!window.audioBlob) {
        logMessage('ExportData: Audio blob not found. Exporting without audio segments.', 'WARN');
        // Allow proceeding without audio, but log warning.
    }
    if (!window.canvas || !window.canvas.backgroundImage) {
        logMessage('ExportData: Canvas or background image not available. Cannot export image snippets.', 'ERROR');
        alert('Cannot export: Background image is missing.');
        return;
    }
    if (typeof JSZip === 'undefined') {
        logMessage('ExportData: JSZip is not loaded. Cannot create zip file.', 'ERROR');
        alert('Cannot export: Zip library failed to load.');
        return;
    }

    // --- 2. Setup & User Feedback --- 
    if (exportButton) {
        exportButton.disabled = true;
        exportButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Preparing...';
    }

    const baseFilename = window.currentImageBaseName || 'annotation';
    const originalImageObject = window.canvas.backgroundImage;
    const zip = new JSZip();
    let fullAudioBuffer = null;
    let eventCounter = 0;
    let exportErrors = 0;

    logMessage(`ExportData: Using base filename: ${baseFilename}`, 'DEBUG');

    // --- 3. Decode Full Audio --- 
    logMessage(`ExportData: Checking for window.audioBlob. Exists: ${!!window.audioBlob}, Size: ${window.audioBlob ? window.audioBlob.size : 'N/A'}`, 'DEBUG');
    if (window.audioBlob) {
        try {
            logMessage('ExportData: Decoding full audio blob...', 'DEBUG');
            fullAudioBuffer = await decodeAudioBlob(window.audioBlob);
            logMessage(`ExportData: Full audio blob decoded successfully. Duration: ${fullAudioBuffer ? fullAudioBuffer.duration.toFixed(3) + 's' : 'ERROR'}`, 'INFO');
        } catch (error) {
            logMessage(`ExportData: Failed to decode audio blob: ${error.message}. Proceeding without audio segments.`, 'ERROR');
            fullAudioBuffer = null; // Ensure it's null if decoding fails
        }
    } else {
        logMessage('ExportData: window.audioBlob not found. No audio will be processed.', 'WARN');
    }

    // --- 4. Iterate Through Events and Process --- 
    logMessage('ExportData: Starting event processing loop.', 'DEBUG');
    const processingPromises = []; // Store promises for async operations within the loop

    for (const category of EXPORT_CATEGORIES) {
        if (window.recordedEvents[category] && Array.isArray(window.recordedEvents[category])) {
            logMessage(`ExportData: Processing category: ${category}`, 'TRACE');
            for (const event of window.recordedEvents[category]) {
                eventCounter++;
                const eventId = event.event_id || `event_${category}_${eventCounter}`;
                logMessage(`ExportData: Processing event ${eventId} (Category: ${category})...`, 'DEBUG');

                // Create a promise for each event's processing
                const processEventPromise = (async () => {
                    try {
                        // --- Calculate Bounding Box (Canvas Coords) ---
                        const canvasBbox = calculateEventBoundingBox(event);
                        if (!canvasBbox) {
                            logMessage(`ExportData: Skipping event ${eventId} - Failed to calculate canvas bounding box.`, 'WARN');
                            return; // Skip this event
                        }
                        logMessage(`ExportData: Event ${eventId} Canvas BBox calculated: ${JSON.stringify(canvasBbox)}`, 'TRACE');

                        // --- Scale BBox to Original Image Coordinates ---
                        const originalImageObject = window.canvas.backgroundImage;
                        if (!originalImageObject) {
                             logMessage(`ExportData: Skipping event ${eventId} - Background image object not found for scaling.`, 'ERROR');
                             exportErrors++;
                             return;
                        }
                        const scaleX = originalImageObject.width / originalImageObject.getScaledWidth();
                        const scaleY = originalImageObject.height / originalImageObject.getScaledHeight();

                        // Check for invalid scale factors (e.g., if getScaledWidth/Height is 0)
                         if (!isFinite(scaleX) || !isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
                             logMessage(`ExportData: Skipping event ${eventId} - Invalid scale factor detected (scaleX: ${scaleX}, scaleY: ${scaleY}). Check if image is loaded and has dimensions.`, 'ERROR');
                             exportErrors++;
                             return; // Skip this event if scaling is invalid
                         }

                        const imageBbox = {
                            x: Math.floor(canvasBbox.x * scaleX),
                            y: Math.floor(canvasBbox.y * scaleY),
                            width: Math.ceil(canvasBbox.width * scaleX),
                            height: Math.ceil(canvasBbox.height * scaleY)
                        };
                        logMessage(`ExportData: Event ${eventId} Image BBox calculated (ScaleX: ${scaleX.toFixed(3)}, ScaleY: ${scaleY.toFixed(3)}): ${JSON.stringify(imageBbox)}`, 'TRACE');


                        // --- Extract Image Snippet ---
                        let imageBlob = null;
                        try {
                            // Pass the SCALED bbox to the extraction function
                            imageBlob = await extractImageSnippet(originalImageObject, imageBbox);
                            if (imageBlob) {
                                zip.file(`${baseFilename}_${eventId}.png`, imageBlob);
                                logMessage(`ExportData: Event ${eventId} image snippet added to zip (${imageBlob.size} bytes).`, 'TRACE');
                            } else {
                                logMessage(`ExportData: Event ${eventId} image snippet extraction returned null.`, 'WARN');
                            }
                        } catch (imgError) {
                            logMessage(`ExportData: Error extracting image snippet for event ${eventId}: ${imgError.message}`, 'ERROR');
                            exportErrors++;
                            // Continue without image for this event
                        }

                        // --- Extract and Encode Audio Segment ---
                        if (fullAudioBuffer && event.start_time_offset !== undefined && event.end_time_offset !== undefined) {
                            const startTimeSec = event.start_time_offset / 1000;
                            const endTimeSec = event.end_time_offset / 1000;
                            logMessage(`ExportData: Event ${eventId} - Attempting audio segment extraction [${startTimeSec.toFixed(3)}s - ${endTimeSec.toFixed(3)}s]...`, 'TRACE');
                            let audioSegmentBlob = null;
                            try {
                                const audioSegmentBuffer = extractAudioSegment(fullAudioBuffer, startTimeSec, endTimeSec);
                                if (audioSegmentBuffer) {
                                    logMessage(`ExportData: Event ${eventId} - Audio segment extracted successfully (Buffer duration: ${audioSegmentBuffer.duration.toFixed(3)}s). Encoding...`, 'TRACE');
                                    audioSegmentBlob = await encodeAudioBufferToWebm(audioSegmentBuffer);
                                    if (audioSegmentBlob) {
                                        logMessage(`ExportData: Event ${eventId} - Audio segment encoded successfully (Blob size: ${audioSegmentBlob.size}, type: ${audioSegmentBlob.type}). Adding to zip...`, 'TRACE');
                                        zip.file(`${baseFilename}_${eventId}.webm`, audioSegmentBlob);
                                        logMessage(`ExportData: Event ${eventId} audio segment added to zip (${audioSegmentBlob.size} bytes).`, 'TRACE');
                                    } else {
                                        logMessage(`ExportData: Event ${eventId} audio segment encoding returned null.`, 'WARN');
                                    }
                                } else {
                                     logMessage(`ExportData: Event ${eventId} audio segment extraction returned null.`, 'WARN');
                                }
                            } catch (audioError) {
                                logMessage(`ExportData: Error processing audio segment for event ${eventId}: ${audioError.message}`, 'ERROR');
                                exportErrors++;
                                // Continue without audio for this event
                            }
                        } else if (!fullAudioBuffer) {
                             logMessage(`ExportData: Skipping audio for event ${eventId} as full audio buffer is not available.`, 'DEBUG');
                        } else {
                            logMessage(`ExportData: Skipping audio for event ${eventId} due to missing time offsets.`, 'WARN');
                            // Log details if time offsets are the issue
                            if (fullAudioBuffer) { // Only log if buffer exists but offsets are missing
                                logMessage(`ExportData: Event ${eventId} Details - start_time_offset: ${event.start_time_offset}, end_time_offset: ${event.end_time_offset}`, 'TRACE');
                            }
                        }

                        // --- Prepare Metadata JSON ---
                        try {
                            // Pass the ORIGINAL canvas bbox to metadata
                            const metadataJson = prepareMetadataJson(event, canvasBbox);
                            if (metadataJson) {
                                const metadataBlob = new Blob([metadataJson], { type: 'application/json' });
                                zip.file(`${baseFilename}_${eventId}.json`, metadataBlob);
                                logMessage(`ExportData: Event ${eventId} metadata added to zip (${metadataBlob.size} bytes).`, 'TRACE');
                            } else {
                                logMessage(`ExportData: Failed to prepare metadata for event ${eventId}.`, 'WARN');
                            }
                        } catch (metaError) {
                             logMessage(`ExportData: Error preparing metadata for event ${eventId}: ${metaError.message}`, 'ERROR');
                             exportErrors++;
                             // Continue without metadata for this event
                        }
                    } catch (processError) {
                        logMessage(`ExportData: Unexpected error processing event ${eventId}: ${processError.message}`, 'ERROR');
                        console.error(`Error processing event ${eventId}:`, processError);
                        exportErrors++; // Increment general error count
                    }
                })(); // Immediately invoke the async function
                processingPromises.push(processEventPromise);
            } // End loop through events in category
        } else {
            logMessage(`ExportData: Skipping category ${category} - No events found or not an array.`, 'TRACE');
        }
    } // End loop through categories

    // --- 5. Wait for all event processing to complete --- 
    logMessage(`ExportData: Waiting for ${processingPromises.length} event processing operations to complete...`, 'DEBUG');
    await Promise.all(processingPromises);
    logMessage('ExportData: All event processing finished.', 'INFO');

    // --- 6. Generate Zip File --- 
    if (eventCounter === 0) {
        logMessage('ExportData: No eligible events found in specified categories. Nothing to zip.', 'WARN');
        alert('No drawing events were found to export.');
        if (exportButton) {
            exportButton.disabled = false;
            exportButton.innerHTML = originalButtonText;
        }
        return;
    }

    if (exportButton) {
        exportButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Zipping...';
    }
    logMessage('ExportData: Generating zip file...', 'DEBUG');

    try {
        const zipBlob = await zip.generateAsync({ 
            type:"blob",
            compression: "DEFLATE", // Standard zip compression
            compressionOptions: {
                level: 6 // Balance between speed and compression (1=fastest, 9=best)
            }
         });
        logMessage(`ExportData: Zip file generated successfully (${zipBlob.size} bytes).`, 'INFO');

        // --- 7. Trigger Download --- 
        const zipFilename = `${baseFilename}_analysis_export.zip`;
        // Use FileSaver.js via utils.js
        if (typeof window.downloadFile === 'function') {
            window.downloadFile(zipBlob, zipFilename);
            logMessage(`ExportData: Download triggered for ${zipFilename}`, 'INFO');
            if (exportErrors > 0) {
                alert(`Export complete, but ${exportErrors} error(s) occurred during processing. Check the console log for details.`);
            } else {
                // Optional: Show success alert
                // alert('Export complete!');
            }
        } else {
            logMessage('ExportData: downloadFile function not found. Cannot trigger download.', 'ERROR');
            alert('Export failed: Download function is missing.');
        }

    } catch (zipError) {
        logMessage(`ExportData: Error generating zip file: ${zipError.message}`, 'ERROR');
        console.error('Zip Generation Error:', zipError);
        alert(`Failed to generate the zip file: ${zipError.message}`);
    } finally {
        // --- 8. Reset UI --- 
        if (exportButton) {
            exportButton.disabled = false;
            exportButton.innerHTML = originalButtonText;
        }
        logMessage('ExportData: Export process finished.', 'INFO');
    }
}

/**
 * Calculates the bounding box of the tool's movement within an event.
 * @param {object} event - The recorded event object.
 * @returns {object | null} Bounding box {x, y, width, height} in *canvas pixel coordinates*, or null if no points/coords found.
 */
function calculateEventBoundingBox(event) {
    logMessage(`ExportData: Calculating Canvas BBox for event ${event.event_id || 'unknown'} (Category: ${event.category})...`, 'TRACE');
    let bbox = null;

    if (event.category === 'laser_pointer' && event.points && event.points.length > 0) {
        let points = event.points.map(p => ({ x: p.x, y: p.y })); // Extract x,y from laser points
        // Filter out invalid points first
        points = points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
        if (points.length === 0) {
             logMessage(`ExportData: No valid points found for laser_pointer event ${event.event_id || 'unknown'}.`, 'WARN');
             return null;
        }

        let minX = points[0].x;
        let minY = points[0].y;
        let maxX = points[0].x;
        let maxY = points[0].y;

        for (let i = 1; i < points.length; i++) {
            minX = Math.min(minX, points[i].x);
            minY = Math.min(minY, points[i].y);
            maxX = Math.max(maxX, points[i].x);
            maxY = Math.max(maxY, points[i].y);
        }
        bbox = {
            x: Math.floor(minX),
            y: Math.floor(minY),
            width: Math.ceil(maxX - minX),
            height: Math.ceil(maxY - minY)
        };

    } else if (event.category === 'bounding_box') {
        // *** USE FINAL_COORDS for Bounding Box Export Snippet ***
        if (event.final_coords &&
            typeof event.final_coords.left === 'number' &&
            typeof event.final_coords.top === 'number' &&
            typeof event.final_coords.width === 'number' &&
            typeof event.final_coords.height === 'number')
        {
            logMessage(`ExportData: Using final_coords for bounding_box event ${event.event_id || 'unknown'}.`, 'TRACE');
            bbox = {
                x: Math.floor(event.final_coords.left),
                y: Math.floor(event.final_coords.top),
                width: Math.ceil(event.final_coords.width),
                height: Math.ceil(event.final_coords.height)
            };
        } else {
             logMessage(`ExportData: Missing or invalid final_coords for bounding_box event ${event.event_id || 'unknown'}. Cannot calculate bbox.`, 'WARN');
             return null;
        }
    }
    // Add other event category handlers here if needed
    // else if (event.points && Array.isArray(event.points)) { ... }

    if (!bbox) {
        logMessage(`ExportData: No logic to calculate bbox for event category '${event.category}' (event ${event.event_id || 'unknown'}).`, 'WARN');
        return null;
    }

    // Handle cases where width/height might be 0 or negative (e.g., single click)
    // Ensure minimum size of 1x1
    bbox.width = Math.max(1, bbox.width);
    bbox.height = Math.max(1, bbox.height);

    logMessage(`ExportData: Canvas BBox calculated for event ${event.event_id || 'unknown'}: x=${bbox.x}, y=${bbox.y}, w=${bbox.width}, h=${bbox.height}`, 'TRACE');
    return bbox;
}

/**
 * Extracts a specific region from the original Fabric.js background image object.
 * @param {fabric.Image} originalImageObject - The Fabric image object set as canvas background.
 * @param {object} bbox - The bounding box {x, y, width, height} in *original image pixel coordinates*.
 * @returns {Promise<Blob | null>} A Promise resolving with the PNG Blob of the snippet, or null on error.
 */
async function extractImageSnippet(originalImageObject, bbox) {
    logMessage(`ExportData: Extracting image snippet for imageBbox: ${JSON.stringify(bbox)}`, 'TRACE');
    if (!originalImageObject || !bbox || bbox.width <= 0 || bbox.height <= 0) {
        logMessage('ExportData: Invalid parameters for image snippet extraction.', 'ERROR');
        return null;
    }

    try {
        // Get the underlying HTML <image> element from the Fabric object
        const imgElement = originalImageObject.getElement();
        if (!imgElement) {
            logMessage('ExportData: Could not get underlying image element from Fabric object.', 'ERROR');
            return null;
        }

        // Ensure the bounding box coordinates are within the image dimensions
        const imgWidth = originalImageObject.width;
        const imgHeight = originalImageObject.height;

        // --- Removed Border ---
        // const BORDER_WIDTH = 1; // Width of the border to draw

        // Clamp and adjust bbox coordinates to stay within image bounds
        // sx, sy are the top-left corner in the *source* image
        const sx = Math.max(0, bbox.x);
        const sy = Math.max(0, bbox.y);
        // sWidth, sHeight are the dimensions to extract from the *source* image
        // Ensure extracted area doesn't go beyond image boundaries
        const sWidth = Math.min(bbox.width, imgWidth - sx);
        const sHeight = Math.min(bbox.height, imgHeight - sy);

        if (sWidth <= 0 || sHeight <= 0) {
            logMessage(`ExportData: Calculated snippet dimensions are invalid after clamping: w=${sWidth}, h=${sHeight}. Original bbox: ${JSON.stringify(bbox)}, Image: ${imgWidth}x${imgHeight}`, 'WARN');
            return null;
        }
        logMessage(`ExportData: Clamped source rect: sx=${sx}, sy=${sy}, sWidth=${sWidth}, sHeight=${sHeight}`, 'TRACE');

        // Create a temporary canvas to draw the snippet
        const tempCanvas = document.createElement('canvas');
        // Size the canvas to the exact snippet size (no border)
        tempCanvas.width = sWidth;
        tempCanvas.height = sHeight;
        const ctx = tempCanvas.getContext('2d');

        if (!ctx) {
            logMessage('ExportData: Could not get 2D context from temporary canvas.', 'ERROR');
            return null;
        }

        // --- Draw the snippet WITHOUT a border ---
        // Draw the extracted image portion directly onto the temp canvas at position (0,0)
        logMessage(`ExportData: Drawing image portion: src(x:${sx}, y:${sy}, w:${sWidth}, h:${sHeight}) -> dest(x:0, y:0, w:${sWidth}, h:${sHeight})`, 'TRACE');
        ctx.drawImage(
            imgElement,
            sx, sy, sWidth, sHeight, // Source rectangle (from original image)
            0, 0, sWidth, sHeight   // Destination rectangle (on temp canvas, top-left corner)
        );

        // --- Border drawing removed ---
        // // 3. Draw the border around the snippet
        // ctx.strokeStyle = 'red'; // Border color
        // ctx.lineWidth = BORDER_WIDTH;
        // ctx.strokeRect(BORDER_WIDTH / 2, BORDER_WIDTH / 2, sWidth + BORDER_WIDTH, sHeight + BORDER_WIDTH);

        // Export the temporary canvas to a PNG Blob
        logMessage('ExportData: Exporting snippet canvas to Blob...', 'TRACE');
        return new Promise((resolve, reject) => {
            tempCanvas.toBlob((blob) => {
                if (blob) {
                    logMessage('ExportData: Snippet Blob created successfully.', 'TRACE');
                    resolve(blob);
                } else {
                    logMessage('ExportData: tempCanvas.toBlob() returned null.', 'ERROR');
                    reject(new Error('Canvas toBlob failed to produce a Blob.'));
                }
            }, 'image/png');
        });

    } catch (error) {
        logMessage(`ExportData: Error during image snippet extraction: ${error.message}`, 'ERROR');
        console.error('Image Snippet Extraction Error:', error);
        return null;
    }
}


/**
 * Prepares the metadata JSON string for a single event.
 * Adds the calculated bounding box and moves points/coords to the end.
 * @param {object} event - The original recorded event object.
 * @param {object} bbox - The calculated bounding box {x, y, width, height} in *canvas coordinates*.
 * @returns {string | null} The formatted JSON string, or null on error.
 */
function prepareMetadataJson(event, bbox) {
    logMessage(`ExportData: Preparing metadata for event ${event.event_id || 'unknown'} with canvasBbox: ${JSON.stringify(bbox)}...`, 'TRACE');
    if (!event || !bbox) {
        logMessage('ExportData: Invalid event or bbox for metadata preparation.', 'ERROR');
        return null;
    }

    try {
        // Create a deep copy to avoid modifying the original event object in recordedEvents
        const eventCopy = JSON.parse(JSON.stringify(event));

        // Add the bounding box
        eventCopy.bounding_box = bbox;

        // Identify and temporarily store the points/coordinates array
        let pointsKey = null;
        let pointsData = null;
        if (eventCopy.points !== undefined) {
            pointsKey = 'points';
            pointsData = eventCopy.points;
            delete eventCopy.points;
        } else if (eventCopy.intermediate_coords !== undefined) {
             // Handle bounding box events which might use different keys
             // Decide which key is most representative or store all?
             // For simplicity, let's assume we prioritize 'intermediate_coords' if 'points' isn't there.
             pointsKey = 'intermediate_coords';
             pointsData = eventCopy.intermediate_coords;
             delete eventCopy.intermediate_coords;
             // Maybe also remove start/final coords if they exist to avoid confusion?
             // delete eventCopy.start_coords;
             // delete eventCopy.final_coords;
         } else {
             logMessage(`ExportData: No standard points/coords key found for event ${event.event_id} to move to end.`, 'WARN');
         }

        // Re-add the points/coordinates data at the end
        if (pointsKey && pointsData) {
            eventCopy[pointsKey] = pointsData;
            logMessage(`ExportData: Moved key '${pointsKey}' to the end for event ${event.event_id}.`, 'TRACE');
        }

        // Stringify with pretty printing
        const jsonString = JSON.stringify(eventCopy, null, 2);
        logMessage(`ExportData: Metadata JSON prepared for event ${event.event_id}.`, 'TRACE');
        return jsonString;

    } catch (error) {
        logMessage(`ExportData: Error preparing metadata JSON for event ${event.event_id}: ${error.message}`, 'ERROR');
        console.error('Metadata Preparation Error:', error);
        return null;
    }
}

// Expose the main function to the window object
window.exportForAnalysis = exportForAnalysis;

logMessage('js/export_data.js loaded', 'INFO'); 