/**
 * Audio processing utilities for the annotation tool export feature.
 */

/**
 * Decodes an audio Blob (expected WebM) into an AudioBuffer.
 * @param {Blob} audioBlob - The audio Blob to decode.
 * @returns {Promise<AudioBuffer>} A promise that resolves with the decoded AudioBuffer.
 */
async function decodeAudioBlob(audioBlob) {
    logMessage('AudioTools: Starting audio blob decoding...', 'DEBUG');
    if (!audioBlob) {
        logMessage('AudioTools: decodeAudioBlob received null or undefined blob.', 'ERROR');
        throw new Error('Invalid audio blob provided for decoding.');
    }
    logMessage(`AudioTools: Decoding blob of size ${audioBlob.size} bytes, type ${audioBlob.type}`, 'DEBUG');

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();

    logMessage('AudioTools: ArrayBuffer obtained, decoding audio data...', 'DEBUG');
    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        logMessage(`AudioTools: Audio decoded successfully. Duration: ${audioBuffer.duration.toFixed(2)}s, Channels: ${audioBuffer.numberOfChannels}, SampleRate: ${audioBuffer.sampleRate}Hz`, 'INFO');
        // Close the context after decoding to free resources
        audioContext.close();
        return audioBuffer;
    } catch (error) {
        logMessage(`AudioTools: Error decoding audio data: ${error.message}`, 'ERROR');
        console.error('Audio Decoding Error:', error);
        // Attempt to close context even on error
        try { audioContext.close(); } catch (closeError) { /* Ignore */ }
        throw error; // Re-throw the error
    }
}

/**
 * Extracts a segment from a full AudioBuffer.
 * @param {AudioBuffer} fullAudioBuffer - The complete audio data.
 * @param {number} startTimeSeconds - The start time of the segment in seconds.
 * @param {number} endTimeSeconds - The end time of the segment in seconds.
 * @returns {AudioBuffer | null} A new AudioBuffer containing the extracted segment, or null if parameters are invalid.
 */
function extractAudioSegment(fullAudioBuffer, startTimeSeconds, endTimeSeconds) {
    logMessage(`AudioTools: Extracting segment from ${startTimeSeconds.toFixed(3)}s to ${endTimeSeconds.toFixed(3)}s`, 'DEBUG');
    if (!fullAudioBuffer || startTimeSeconds === undefined || endTimeSeconds === undefined) {
        logMessage('AudioTools: Invalid parameters for extractAudioSegment.', 'ERROR');
        return null;
    }
    if (startTimeSeconds < 0 || endTimeSeconds <= startTimeSeconds || endTimeSeconds > fullAudioBuffer.duration) {
        logMessage(`AudioTools: Invalid time range [${startTimeSeconds.toFixed(3)}, ${endTimeSeconds.toFixed(3)}] for buffer duration ${fullAudioBuffer.duration.toFixed(3)}s.`, 'WARN');
        // Clamp times if possible, or return null if completely invalid
        startTimeSeconds = Math.max(0, startTimeSeconds);
        endTimeSeconds = Math.min(fullAudioBuffer.duration, endTimeSeconds);
        if (endTimeSeconds <= startTimeSeconds) {
            logMessage('AudioTools: Adjusted time range is invalid or zero-length. Cannot extract.', 'ERROR');
            return null;
        }
        logMessage(`AudioTools: Clamped time range to [${startTimeSeconds.toFixed(3)}, ${endTimeSeconds.toFixed(3)}]`, 'DEBUG');
    }

    const sampleRate = fullAudioBuffer.sampleRate;
    const startFrame = Math.floor(startTimeSeconds * sampleRate);
    const endFrame = Math.floor(endTimeSeconds * sampleRate);
    const segmentLengthFrames = endFrame - startFrame;

    if (segmentLengthFrames <= 0) {
        logMessage('AudioTools: Calculated segment length is zero or negative frames.', 'WARN');
        return null;
    }

    const numChannels = fullAudioBuffer.numberOfChannels;
    // Use the same AudioContext temporarily if needed, or create a new offline one
    // Creating a new context per segment extraction is less efficient but safer isolation.
    const segmentContext = new (window.AudioContext || window.webkitAudioContext)();
    const segmentBuffer = segmentContext.createBuffer(
        numChannels,
        segmentLengthFrames,
        sampleRate
    );

    logMessage(`AudioTools: Created segment buffer: Channels=${numChannels}, Frames=${segmentLengthFrames}, Rate=${sampleRate}`, 'DEBUG');

    for (let channel = 0; channel < numChannels; channel++) {
        const fullChannelData = fullAudioBuffer.getChannelData(channel);
        const segmentChannelData = segmentBuffer.getChannelData(channel);
        // Copy the relevant portion of the data
        // Use subarray for potentially better performance/memory usage if available
        if (typeof fullChannelData.subarray === 'function') {
             segmentChannelData.set(fullChannelData.subarray(startFrame, endFrame));
        } else {
            // Fallback manual copy
            for (let i = 0; i < segmentLengthFrames; i++) {
                segmentChannelData[i] = fullChannelData[startFrame + i];
            }
        }
    }

    logMessage(`AudioTools: Segment extracted successfully. Duration: ${segmentBuffer.duration.toFixed(3)}s`, 'INFO');
    segmentContext.close(); // Close context after creation
    return segmentBuffer;
}

/**
 * Encodes an AudioBuffer segment back into a WebM Blob using MediaRecorder.
 * @param {AudioBuffer} audioBuffer - The AudioBuffer segment to encode.
 * @returns {Promise<Blob>} A promise that resolves with the encoded WebM Blob.
 */
function encodeAudioBufferToWebm(audioBuffer) {
    return new Promise((resolve, reject) => {
        logMessage(`AudioTools: Encoding segment buffer (Duration: ${audioBuffer.duration.toFixed(3)}s) to WebM...`, 'DEBUG');

        // MP3 Encoding Placeholder:
        // If MP3 output is desired, this is where you would use a library like lamejs:
        // 1. Convert the AudioBuffer channels to interleaved PCM data.
        // 2. Initialize the LAME MP3 encoder with appropriate settings (sample rate, bitrate, channels).
        // 3. Feed the PCM data chunks to the encoder.
        // 4. Flush the encoder to get the final MP3 data blocks.
        // 5. Combine the blocks into an MP3 Blob.
        // Example structure (requires lamejs library):
        /*
        if (typeof lamejs === 'undefined') {
            logMessage('AudioTools: lamejs library not found for MP3 encoding.', 'ERROR');
            // Fallback to WebM or reject
        }
        const mp3encoder = new lamejs.Mp3Encoder(audioBuffer.numberOfChannels, audioBuffer.sampleRate, 128); // 128kbps bitrate
        const samplesLeft = audioBuffer.getChannelData(0); // Assuming mono or taking left channel
        const samplesRight = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : samplesLeft; // Use left if mono
        const sampleBlockSize = 1152; // Standard MP3 frame size
        let mp3Data = [];

        for (let i = 0; i < samplesLeft.length; i += sampleBlockSize) {
            const leftChunk = samplesLeft.subarray(i, i + sampleBlockSize);
            const rightChunk = samplesRight.subarray(i, i + sampleBlockSize);
            const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk); // Pass L/R buffers
            if (mp3buf.length > 0) {
                mp3Data.push(new Int8Array(mp3buf));
            }
        }
        const mp3buf = mp3encoder.flush(); // Get remaining data
        if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
        }

        const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
        logMessage(`AudioTools: Encoded segment to MP3. Size: ${mp3Blob.size} bytes`, 'INFO');
        resolve(mp3Blob);
        return; // End execution here if MP3 is successful
        */

        // --- WebM Encoding using MediaRecorder ---
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);

        const chunks = [];
        // Prioritize 'audio/webm;codecs=opus' if available for better quality/compression
        const mimeTypes = [
             'audio/webm;codecs=opus',
             'audio/webm',
             'audio/ogg;codecs=opus', // Fallback ogg opus
             'audio/ogg', // Fallback ogg vorbis
             'audio/mp4' // Fallback mp4 aac
        ];
        let selectedMimeType = 'audio/webm'; // Default

        for (const type of mimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                selectedMimeType = type;
                logMessage(`AudioTools: Using MIME type ${selectedMimeType} for MediaRecorder`, 'DEBUG');
                break;
            }
        }
        if (!MediaRecorder.isTypeSupported(selectedMimeType)) {
            logMessage(`AudioTools: Default MIME type ${selectedMimeType} not supported by MediaRecorder.`, 'ERROR');
            audioContext.close();
            reject(new Error(`MediaRecorder does not support ${selectedMimeType}`));
            return;
        }

        const mediaRecorder = new MediaRecorder(destination.stream, { mimeType: selectedMimeType });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
                logMessage(`AudioTools: MediaRecorder data available, chunk size: ${event.data.size}`, 'TRACE');
            }
        };

        mediaRecorder.onstop = () => {
            logMessage('AudioTools: MediaRecorder stopped.', 'DEBUG');
            const webmBlob = new Blob(chunks, { type: selectedMimeType });
            logMessage(`AudioTools: Encoded segment to ${selectedMimeType}. Size: ${webmBlob.size} bytes`, 'INFO');
            audioContext.close(); // Clean up context
            resolve(webmBlob);
        };

        mediaRecorder.onerror = (event) => {
            logMessage(`AudioTools: MediaRecorder error: ${event.error}`, 'ERROR');
            console.error("MediaRecorder Error:", event.error);
            audioContext.close(); // Clean up context
            reject(event.error || new Error('MediaRecorder encountered an unknown error.'));
        };

        // Start the process
        source.start();
        mediaRecorder.start();
        logMessage('AudioTools: MediaRecorder started.', 'DEBUG');

        // Stop recording shortly after the buffer duration
        // Add a small buffer (e.g., 100ms) to ensure everything is captured
        const stopDelay = (audioBuffer.duration * 1000) + 100;
        setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
                logMessage('AudioTools: Stopping MediaRecorder via timeout.', 'DEBUG');
                mediaRecorder.stop();
            }
        }, stopDelay);

        // Additionally handle the 'ended' event of the buffer source as a primary stop trigger
        source.onended = () => {
            logMessage('AudioTools: AudioBufferSource ended, stopping MediaRecorder.', 'DEBUG');
             // Short delay before stopping recorder to ensure all data flows through
            setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                     mediaRecorder.stop();
                }
            }, 50); // 50ms delay
        };
    });
}

// Expose functions to the window object if they need to be called directly
// For now, they will likely be called only from export_data.js
// window.decodeAudioBlob = decodeAudioBlob;
// window.extractAudioSegment = extractAudioSegment;
// window.encodeAudioBufferToWebm = encodeAudioBufferToWebm;

logMessage('js/audio_tools.js loaded', 'INFO'); 