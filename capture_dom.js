const scriptStartTime = Date.now();
console.log('\x1b[32m[PUPPETEER] capture_dom.js script starting execution at ' + new Date().toString() + '...\x1b[0m'); // Added startup message with local timezone in green


global.consoleErrorList = [];
// capture_dom.js
const puppeteer = require('puppeteer');
const fs = require('fs'); // File system module to save the output

// --- Helper Function: Log and Screenshot ---
async function log_and_shot(page, message) {
    console.log(message); // Log the message first
    if (!page || page.isClosed()) {
        console.warn('\x1b[33m[PUPPETEER] [WARNING]: Page is not available or closed, skipping screenshot.\x1b[0m');
        return;
    }
    try {
        await page.screenshot({ path: 'screenshot.png', fullPage: true });
    } catch (screenshotError) {
        // Log screenshot error but continue script execution
        console.error(`[PUPPETEER] Error taking screenshot after message "${message}":`, screenshotError.message);
        global.consoleErrorList.push(`Screenshot error: ${screenshotError.message}`);
    }
}
// ----------------------------------------

// --- NEW Helper Function: Wait for Signal ---
/**
 * Waits for a specific signal promise to resolve, with timeout handling.
 * @param {Page} page - The Puppeteer page object.
 * @param {string} signalName - Descriptive name for the signal (for logging).
 * @param {Promise} signalPromise - The promise that resolves when the signal occurs.
 * @param {number} timeoutMs - Timeout duration in milliseconds.
 * @returns {Promise<boolean>} - Resolves true if signal received, false if timed out.
 */
async function waitForSignal(page, signalName, signalPromise, timeoutMs) {
    await log_and_shot(page, `[PUPPETEER] Starting wait for ${signalName} signal (timeout: ${timeoutMs / 1000}s)...`);
    try {
        await Promise.race([
            signalPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout waiting for ${signalName} signal`)), timeoutMs))
        ]);
        await log_and_shot(page, `[PUPPETEER] Completed wait for ${signalName} signal.`);
        return true; // Signal received
    } catch (error) {
        console.error(`[PUPPETEER] ERROR: ${error.message}.`); // Log the specific error (likely timeout)
        global.consoleErrorList.push(`Signal error: ${error.message}`);
        if (error.message.includes('Timeout')) {
            console.log(`[PUPPETEER] Attempting to take screenshot specifically for ${signalName} timeout...`);
            try {
                const screenshotPath = `${signalName.toLowerCase().replace(/\s+/g, '_')}_timeout_screenshot.png`;
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`[PUPPETEER] Timeout screenshot saved to ${screenshotPath}`);
            } catch (timeoutScreenshotError) {
                console.error('\x1b[31m[PUPPETEER] [ERROR]: Failed to take timeout-specific screenshot:', timeoutScreenshotError.message, '\x1b[0m');
                global.consoleErrorList.push(`Timeout screenshot error: ${timeoutScreenshotError.message}`);
            }
        }
        console.warn(`[PUPPETEER] Warning: Proceeding after ${signalName} signal error/timeout. Subsequent steps might fail.`);
        return false; // Signal timed out or error occurred
    }
}
// -------------------------------------------

// --- Configuration ---
// Get port from command line argument, default to 8000
const args = process.argv.slice(2);
const portArg = args[0];
const port = (portArg && !isNaN(parseInt(portArg))) ? parseInt(portArg) : 8000;
console.log(`[PUPPETEER] Using port: ${port}`);

// The URL of your running application
const targetUrl = `http://localhost:${port}/`;

// The image URL to load via the input field (ensure it matches the default value or set it)
const imageUrlToLoad = 'https://prod-images-static.radiopaedia.org/images/157210/332aa0c67cb2e035e372c7cb3ceca2_big_gallery.jpg';

// The file path where you want to save the final DOM
const outputFile = 'chrome_dump_puppeteer.html'; 
// -------------------

function logToFileAndConsole(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    // Use string concatenation for file entry to avoid complex escapes in message
    const logEntry = '[' + timestamp + '] [' + level.padEnd(5) + '] ' + message + '\n';

    // Append to log file
    fs.appendFileSync('puppeteer_log.txt', logEntry);

    // Log to console with color - ensure template literals for color codes are correct
    switch (level.toUpperCase()) {
        case 'INFO':
            console.log(`\x1b[32m[${level}] ${message}\x1b[0m`); 
            break;
        case 'WARN':
            console.warn(`\x1b[33m[${level}] ${message}\x1b[0m`); 
            break;
        case 'ERROR':
        case 'FATAL':
            console.error(`\x1b[31m[${level}] ${message}\x1b[0m`); 
            break;
        case 'DEBUG':
            console.log(`\x1b[36m[${level}] ${message}\x1b[0m`); 
            break;
        default:
            console.log(`[${level}] ${message}`);
            break;
    }
}

(async () => {
  // Define page outside try block for finally access
  let page;
  let browser;
  let pageHasErrors = false; // Flag to track if errors occurred on the page

  try {
    
    const startupTime = (Date.now() - scriptStartTime) / 1000;
    await log_and_shot(null, `[PUPPETEER] It took ${startupTime.toFixed(2)} seconds to set things up. Now launching browser...`); // Page doesn't exist yet
    browser = await puppeteer.launch({ 
        headless: true, // Run in headless mode (no visible UI)
        args: ['--no-sandbox', '--disable-gpu'] // Arguments often needed in Linux/WSL environments
    });
    
    await log_and_shot(null, `[PUPPETEER] Opening new page and navigating to ${targetUrl}...`); // Page doesn't exist yet
    page = await browser.newPage();
    await log_and_shot(page, '[PUPPETEER] Page created.');

    // --- Listener for Page Errors ---
    // Initialize the console error list at the start
    
    
    page.on('pageerror', error => { //this will be thrown when 
      console.error('\x1b[31m[CONSOLE] PAGE RUNTIME ERROR:', error.message, '\x1b[0m'); 
      pageHasErrors = true; // Set flag on runtime error
      // Add error to the list of console errors
      global.consoleErrorList.push(error.message);
    });
    // ------------------------------

    // --- Setup Promises for Signals ---
    let appReadyResolve;
    const appReadyPromise = new Promise(resolve => { appReadyResolve = resolve; });
    let imageLoadedResolve;
    const imageLoadedPromise = new Promise(resolve => { imageLoadedResolve = resolve; });
    // ----------------------------------

    // Optional: Log console messages from the page to the Node script's console
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type().toUpperCase();
      
      // Log based on type for clarity
      if (type === 'ERROR') {
        // Extract stack trace and location information if available
        const location = msg.location();
        const stackTrace = msg.stackTrace ? msg.stackTrace() : [];
        const locationInfo = location ? 
          `at ${location.url}:${location.lineNumber}:${location.columnNumber}` : 
          'location unknown';
        
        // Format detailed error message with timestamp
        const timestamp = new Date().toISOString();
        const errorDetails = stackTrace.length > 0 ? 
          `\n    Stack: ${stackTrace.map(frame => 
            `${frame.functionName || '(anonymous)'} (${frame.url}:${frame.lineNumber}:${frame.columnNumber})`
          ).join('\n           ')}` : '';
          
        console.error('\x1b[31m[CONSOLE ERROR] [${timestamp}]:', text, `\n    Location: ${locationInfo}${errorDetails}`, '\x1b[0m'); // Log console errors in red with details
        pageHasErrors = true; // Set flag on console error
        global.consoleErrorList.push(`Console error: ${text}`);
      } else if (type === 'WARNING') {
        console.warn('\x1b[33m[CONSOLE WARNING]:', text, '\x1b[0m'); // Log warnings in yellow
      } else {
        console.log('[CONSOLE]:', text); // Standard logs
      }

      // Resolve App Ready Promise
      if (text.includes('Application initialized successfully')) {
        console.log('[PUPPETEER] App ready signal detected in console log.'); 
        if (appReadyResolve) { appReadyResolve(); appReadyResolve = null; }
      }
      // Resolve Image Loaded Promise
      if (text.includes('Image loaded successfully')) {
        console.log('[PUPPETEER] Image loaded signal detected in console log.');
        if (imageLoadedResolve) { imageLoadedResolve(); imageLoadedResolve = null; }
      }
    });
  
    // Go to the page
    await log_and_shot(page, '[PUPPETEER] Starting page.goto...');
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }); 
    await log_and_shot(page, '[PUPPETEER] Completed page.goto.');

    // --- Wait for App Ready Signal ---
    // Use the refactored waitForSignal function
    const appReadyTimeout = 30000; // Example timeout for app ready
    const appReady = await waitForSignal(page, 'App Ready', appReadyPromise, appReadyTimeout);
    if (!appReady) {
        throw new Error('App Ready signal timed out. Aborting script.'); 
    }
    // --------------------------------

    // --- Dismiss Microphone Prompt Start ---
    const dismissButtonSelector = '#dismiss-mic-prompt';
    const dismissTimeout = 5000;
    try {
        await log_and_shot(page, `[PUPPETEER] Starting wait for microphone dismiss button: ${dismissButtonSelector} (timeout: ${dismissTimeout/1000}s)`);
        await page.waitForSelector(dismissButtonSelector, { timeout: dismissTimeout, visible: true }); 
        await log_and_shot(page, `[PUPPETEER] Completed wait for microphone dismiss button.`);
        await log_and_shot(page, '[PUPPETEER] Starting click dismiss button...');
        await page.click(dismissButtonSelector);
        await log_and_shot(page, '[PUPPETEER] Completed click dismiss button.');
        await log_and_shot(page, '[PUPPETEER] Starting short pause after dismiss...');
        await page.waitForTimeout(500); // Brief pause to allow UI to settle
        await log_and_shot(page, '[PUPPETEER] Completed short pause after dismiss.');
    } catch (promptError) {
        await log_and_shot(page, '[PUPPETEER] Microphone prompt dismiss button not found or timed out. Continuing...');
        global.consoleErrorList.push(`Microphone prompt error: ${promptError.message}`);
    }
    // --- Dismiss Microphone Prompt End ---
    
    // Find and click the Load button
    const loadButtonSelector = '#load-url-btn';
    const loadBtnTimeout = 10000;
    await log_and_shot(page, `[PUPPETEER] Starting wait for load button: ${loadButtonSelector} (timeout: ${loadBtnTimeout/1000}s)`);
    await page.waitForSelector(loadButtonSelector, { timeout: loadBtnTimeout, visible: true }); 
    await log_and_shot(page, `[PUPPETEER] Completed wait for load button.`);
    
    await log_and_shot(page, `[PUPPETEER] Starting click load button: ${loadButtonSelector}`);
    await page.click(loadButtonSelector);
    await log_and_shot(page, `[PUPPETEER] Completed click load button.`);
    // --- Modification End ---

    // *** Wait for Fabric.js upper canvas to ensure DOM structure is ready ***
    const fabricCanvasSelector = '.upper-canvas'; 
    const fabricTimeout = 20000;
    await log_and_shot(page, `[PUPPETEER] Starting wait for Fabric canvas selector: ${fabricCanvasSelector} (timeout: ${fabricTimeout/1000}s)`);
    await page.waitForSelector(fabricCanvasSelector, { timeout: fabricTimeout, visible: true }); 
    await log_and_shot(page, '[PUPPETEER] Completed wait for Fabric canvas selector.');

    // *** NEW WAIT: Wait for the image loaded success message from the console ***
    const imageLoadTimeout = 20000;
    // Use the refactored waitForSignal function
    const imageLoaded = await waitForSignal(page, 'Image Loaded', imageLoadedPromise, imageLoadTimeout);
    // Note: We logged a warning inside waitForSignal if it timed out, but proceed anyway.
    // If image load is critical, we could add: if (!imageLoaded) throw new Error(...);

    // Now that we've waited, get the full HTML content of the page
    await log_and_shot(page, '[PUPPETEER] Starting page.content()...');
    const htmlContent = await page.content(); 
    await log_and_shot(page, '[PUPPETEER] Completed page.content().');
    
    // Save the content to the output file
    await log_and_shot(page, `[PUPPETEER] Starting save to file: ${outputFile}...`);
    fs.writeFileSync(outputFile, htmlContent);
    await log_and_shot(page, '[PUPPETEER] Completed save to file.');

    // *** NEW: Check if any errors occurred on the page ***
    if (pageHasErrors) {
        throw new Error('Errors were detected on the page console/runtime. Check logs.');
    }

    // --- Take Final Screenshot --- Already done by log_and_shot ---
    // const finalScreenshotPath = 'final_screenshot.png';
    // console.log(`[PUPPETEER] Starting final screenshot save to: ${finalScreenshotPath}`);
    // await page.screenshot({ path: finalScreenshotPath, fullPage: true });
    // console.log(`[PUPPETEER] Completed final screenshot save.`);
    // ---------------------------

  } catch (error) {
      console.error('\x1b[31m[PUPPETEER] [ERROR]: An error occurred:', error, '\x1b[0m');
      console.error('\x1b[31m[PUPPETEER] [ERROR DETAILS]: Message:', error.message, '\x1b[0m');
      console.error('\x1b[31m[PUPPETEER] [ERROR DETAILS]: Stack:', error.stack, '\x1b[0m');
      console.error('\x1b[31m[PUPPETEER] [ERROR DETAILS]: Type:', error.constructor.name, '\x1b[0m');
      if (error.cause) console.error('\x1b[31m[PUPPETEER] [ERROR DETAILS]: Cause:', error.cause, '\x1b[0m');
      global.consoleErrorList.push(`Script error: ${error.message}`);
      // Optionally, capture a screenshot on error for debugging
      try {
          await log_and_shot(page, '[PUPPETEER] Error occurred. Increasing log area size before taking screenshot...');
          // Increase the number of rows for the log textarea
          await page.evaluate(() => {
              const logArea = document.getElementById('log-area');
              if (logArea) {
                  logArea.rows = 40; // Increase rows from 4 to 40 (10x)
              }
          });
          await log_and_shot(page, '[PUPPETEER] Log area size modified.');
          
          // The error screenshot is already taken by the log_and_shot calls above
          // We can take an extra one if needed, maybe with a different name
          const errorScreenshotPath = 'error_screenshot_catch.png';
          await page.screenshot({ path: errorScreenshotPath, fullPage: true }); 
          console.log(`[PUPPETEER] Extra error screenshot saved to ${errorScreenshotPath}`);
          
      } catch (screenshotError) {
          console.error('\x1b[31m[PUPPETEER] [ERROR]: Failed to take error screenshot:', screenshotError, '\x1b[0m');
          global.consoleErrorList.push(`Error screenshot failure: ${screenshotError.message}`);
      }
  } finally {
      // Always close the browser
      await log_and_shot(page, '[PUPPETEER] Starting browser.close()...');
      if (browser) { // Check if browser was launched successfully
          await browser.close();
          console.log('[PUPPETEER] Completed browser.close().'); // Can't screenshot after close
      } else {
          console.log('[PUPPETEER] Browser was not launched, skipping close.');
      }
      
      // Provide execution status summary with color coding
      try {
          let warningMessage = null;
          const imageLoadTimedOut = (typeof imageLoaded !== 'undefined' && imageLoaded === false);

          if (global.consoleErrorList.length > 0 || pageHasErrors) {
              warningMessage = 'Execution completed with warnings: Page errors detected (check logs).';
          } else if (imageLoadTimedOut) {
              warningMessage = 'Execution completed with warnings: Image loading timed out.';
          }

          if (warningMessage) {
               console.warn(`\x1b[33m[PUPPETEER] ${warningMessage}\x1b[0m`);
          } else {
              console.log('\x1b[32m[PUPPETEER] Execution completed successfully.\x1b[0m');
          }
      } catch (summaryError) {
          console.error('\x1b[31m[PUPPETEER] Execution status summary error:', summaryError.message, '\x1b[0m');
          // Avoid pushing to consoleErrorList here as it might not exist if the script failed early
          // Consider adding to a separate script error list if needed.
      }
  }
})(); 