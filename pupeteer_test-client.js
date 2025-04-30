// test-client.js
const fs = require('fs');
const path = require('path'); // Needed for path.join
const puppeteer = require('puppeteer'); // <-- Add Puppeteer

// --- Define log file path and clear it FIRST ---
const logFilePath = path.join(__dirname, 'pup.log');
// Clear the log file at the start of each run
try {
  fs.writeFileSync(logFilePath, '');
} catch (err) {
  console.error(`Failed to clear log file ${logFilePath}:`, err);
  // Decide if you want to exit or continue without file logging
  process.exit(1);
}
// ---------------------------------------------

// Central logging function
function logAndWrite(message, isError = false) {
  try {
      // This header is created for the file log
      header_string = `[PUP CLIENT] [${new Date().toLocaleString()}]`;
      // The header is prepended when writing to the file
      fs.appendFileSync(logFilePath, header_string + message + '\n');
  } catch (err) {
    // Log error about failing to write to the log file to stderr, 
    // but don't try to log it to the file itself to avoid potential loops.
      console.error(header_string + `Failed to write to log file ${logFilePath}:`, err);
  }
  
  // Log to the appropriate console stream
  if (isError) {
      // The original message (without the header) is logged to console error
      console.error(header_string + message);
  } else {
      // The original message (without the header) is logged to console log
      console.log(header_string + message);
  }
}

// Initial log message using the new function
const clientStartTime = Date.now();
  // Add immediate startup message
  logAndWrite(`Script execution started at ${clientStartTime.toString()}.`);
  logAndWrite(`Starting pupeteer_test-client.js...`);
  
  

const axios = require('axios');

// ANSI escape codes for colors
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
};

// Get URL from command line arguments
const targetUrl = process.argv[2];

// Define actions to perform on the page
const actionsToPerform = [
  // No actions needed, just load the page
];

// Check if URL argument is provided
if (!targetUrl) {
  logAndWrite(`[PUP CLIENT] ERROR: Missing URL argument.`, true);
  logAndWrite('Usage: node pupeteer_test-client.js <URL>', true);
  process.exit(1); // Exit with error code
}

// --- Helper Function: Log and Screenshot (Adapted from capture_dom.js) ---
// Takes screenshots relative to the client script's directory
async function log_and_shot(page, message, isError = false) {
    logAndWrite(message, isError); // Use existing logAndWrite
    if (!page || page.isClosed()) {
        logAndWrite('WARNING: Page is not available or closed, skipping screenshot.', true); // Log warning
        return;
    }
    try {
        // Use a timestamp for unique screenshot names if needed, or keep it simple
        const screenshotPath = path.join(__dirname, 'client_screenshot.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (screenshotError) {
        // Log screenshot error but continue script execution
        const errorMsg = `Error taking screenshot after message "${message}": ${screenshotError.message}`;
        logAndWrite(errorMsg, true); // Log as error
        // Optionally add to an error list if tracking errors this way
    }
}
// ----------------------------------------

// --- Helper Function: Wait for Signal (Adapted from capture_dom.js) ---
/**
 * Waits for a specific signal promise to resolve, with timeout handling.
 * @param {Page} page - The Puppeteer page object.
 * @param {string} signalName - Descriptive name for the signal (for logging).
 * @param {Promise} signalPromise - The promise that resolves when the signal occurs.
 * @param {number} timeoutMs - Timeout duration in milliseconds.
 * @param {Array<string>} errorList - Array to push errors into.
 * @returns {Promise<boolean>} - Resolves true if signal received, false if timed out or error.
 */
async function waitForSignal(page, signalName, signalPromise, timeoutMs, errorList) {
    await log_and_shot(page, `Starting wait for ${signalName} signal (timeout: ${timeoutMs / 1000}s)...`);
    try {
        await Promise.race([
            signalPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout waiting for ${signalName} signal (${timeoutMs / 1000}s)`)), timeoutMs))
        ]);
        await log_and_shot(page, `Completed wait for ${signalName} signal.`);
        return true; // Signal received
    } catch (error) {
        const errorMsg = `ERROR: ${error.message}.`;
        logAndWrite(errorMsg, true); // Log the specific error (likely timeout)
        errorList.push(`Signal error: ${error.message}`);
        if (error.message.includes('Timeout')) {
            logAndWrite(`Attempting to take screenshot specifically for ${signalName} timeout...`);
            try {
                const screenshotPath = path.join(__dirname, `${signalName.toLowerCase().replace(/\s+/g, '_')}_timeout_screenshot.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true });
                logAndWrite(`Timeout screenshot saved to ${screenshotPath}`);
            } catch (timeoutScreenshotError) {
                const timeoutScreenshotErrorMsg = `[ERROR]: Failed to take timeout-specific screenshot: ${timeoutScreenshotError.message}`;
                 logAndWrite(timeoutScreenshotErrorMsg, true);
                errorList.push(`Timeout screenshot error: ${timeoutScreenshotError.message}`);
            }
        }
         logAndWrite(`Warning: Proceeding after ${signalName} signal error/timeout. Subsequent steps might fail.`, true);
        return false; // Signal timed out or error occurred
    }
}
// -------------------------------------------

// --- NEW Function: Perform Puppeteer Steps (Based on capture_dom.js lines 142-259) ---
async function performPuppeteerSteps(browser, targetUrl, errorList) {
    let page;
    let htmlContent = '';
    let pageHasErrors = false; // Track errors specific to this page load

    try {
        await log_and_shot(null, `Opening new page and navigating to ${targetUrl}...`);
        page = await browser.newPage();
        await log_and_shot(page, 'Page created.');

        // --- Listener for Page Errors ---
        page.on('pageerror', error => {
          const errorMsg = `[CONSOLE] PAGE RUNTIME ERROR: ${error.message}`;
          logAndWrite(errorMsg, true);
          pageHasErrors = true;
          errorList.push(errorMsg);
        });
        // ------------------------------

        // --- Setup Promises for Signals ---
        let appReadyResolve;
        const appReadyPromise = new Promise(resolve => { appReadyResolve = resolve; });
        let imageLoadedResolve;
        const imageLoadedPromise = new Promise(resolve => { imageLoadedResolve = resolve; });
        // ----------------------------------

        // Log console messages from the page
        page.on('console', msg => {
          const text = msg.text();
          const type = msg.type().toUpperCase();
          const timestamp = new Date().toISOString();
          let logMsg = `[CONSOLE ${type}] [${timestamp}]: ${text}`;
          let isConsoleError = false;

          if (type === 'ERROR') {
            const location = msg.location();
            const locationInfo = location ? `at ${location.url}:${location.lineNumber}:${location.columnNumber}` : 'location unknown';
            logMsg += `\n    Location: ${locationInfo}`;
            logAndWrite(logMsg, true); // Log console errors as errors
            pageHasErrors = true;
            errorList.push(`Console error: ${text}`);
            isConsoleError = true;
          } else if (type === 'WARNING') {
             logAndWrite(logMsg, true); // Log warnings also as errors for visibility in client
             isConsoleError = true; // Treat warnings as errors for hasErrors flag
             pageHasErrors = true;
             errorList.push(`Console warning: ${text}`);
          } else {
             logAndWrite(logMsg); // Standard logs
          }

          // Resolve App Ready Promise
          if (text.includes('Application initialized successfully')) {
             logAndWrite('App ready signal detected in console log.');
             if (appReadyResolve) { appReadyResolve(); appReadyResolve = null; }
          }
          // Resolve Image Loaded Promise
          if (text.includes('Image loaded successfully')) {
             logAndWrite('Image loaded signal detected in console log.');
             if (imageLoadedResolve) { imageLoadedResolve(); imageLoadedResolve = null; }
          }
        });

        // Go to the page
        await log_and_shot(page, 'Starting page.goto...');
        // Increased timeout for goto
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await log_and_shot(page, 'Completed page.goto.');

        // --- Wait for App Ready Signal ---
        const appReadyTimeout = 30000;
        const appReady = await waitForSignal(page, 'App Ready', appReadyPromise, appReadyTimeout, errorList);
        if (!appReady) {
            // Error already logged by waitForSignal, potentially take screenshot
            await log_and_shot(page, 'App Ready signal timed out. Attempting to continue, but page might not be functional.', true);
            // Decide if you want to throw or just return with errors
            // throw new Error('App Ready signal timed out. Aborting page processing.');
            pageHasErrors = true;
        }
        // --------------------------------

        // --- Dismiss Microphone Prompt Start ---
        // Only attempt if the app ready signal was received (or if proceeding anyway)
        if (appReady) { // Or remove this condition if you always want to try
            const dismissButtonSelector = '#dismiss-mic-prompt';
            const dismissTimeout = 5000; // Short timeout
            try {
                await log_and_shot(page, `Starting wait for microphone dismiss button: ${dismissButtonSelector} (timeout: ${dismissTimeout/1000}s)`);
                // Wait for the element to be present, not necessarily visible, as it might appear briefly
                await page.waitForSelector(dismissButtonSelector, { timeout: dismissTimeout });
                await log_and_shot(page, `Microphone dismiss button found.`);
                await log_and_shot(page, 'Starting click dismiss button...');
                await page.click(dismissButtonSelector);
                await log_and_shot(page, 'Completed click dismiss button.');
                await log_and_shot(page, 'Starting short pause after dismiss...');
                await new Promise(resolve => setTimeout(resolve, 500)); // Use native timeout
                await log_and_shot(page, 'Completed short pause after dismiss.');
            } catch (promptError) {
                const errorMsg = `Microphone prompt dismiss button not found or timed out (${dismissButtonSelector}). Continuing... Error: ${promptError.message}`;
                 logAndWrite(errorMsg, true); // Log as warning/error
                // Don't push to errorList unless this is considered a fatal error for the test
                // errorList.push(`Microphone prompt error: ${promptError.message}`);
            }
        } else {
             logAndWrite('Skipping microphone prompt check as App Ready signal failed.', true);
        }
        // --- Dismiss Microphone Prompt End ---

        // Find and click the Load button - Conditional on App Ready
        if (appReady) { // Only try if app is ready
            const loadButtonSelector = '#load-url-btn';
            const loadBtnTimeout = 10000;
            try {
                await log_and_shot(page, `Starting wait for load button: ${loadButtonSelector} (timeout: ${loadBtnTimeout/1000}s)`);
                await page.waitForSelector(loadButtonSelector, { timeout: loadBtnTimeout, visible: true });
                await log_and_shot(page, `Completed wait for load button.`);
                await log_and_shot(page, `Starting click load button: ${loadButtonSelector}`);
                await page.click(loadButtonSelector);
                await log_and_shot(page, `Completed click load button.`);
            } catch (loadBtnError) {
                 const errorMsg = `Failed to find or click load button (${loadButtonSelector}). Error: ${loadBtnError.message}`;
                 logAndWrite(errorMsg, true);
                 errorList.push(errorMsg);
                 pageHasErrors = true; // Mark as error if button click fails
            }
        } else {
             logAndWrite('Skipping Load Button click as App Ready signal failed.', true);
        }


        // Wait for Fabric.js upper canvas - Conditional on load button click attempt
        if (appReady) { // Check appReady again, as load button click depends on it
             const fabricCanvasSelector = '.upper-canvas';
             const fabricTimeout = 20000;
             try {
                await log_and_shot(page, `Starting wait for Fabric canvas selector: ${fabricCanvasSelector} (timeout: ${fabricTimeout/1000}s)`);
                await page.waitForSelector(fabricCanvasSelector, { timeout: fabricTimeout, visible: true });
                await log_and_shot(page, 'Completed wait for Fabric canvas selector.');
             } catch (fabricError) {
                  const errorMsg = `Fabric canvas selector (${fabricCanvasSelector}) not found or timed out. Error: ${fabricError.message}`;
                  logAndWrite(errorMsg, true);
                  errorList.push(errorMsg);
                  pageHasErrors = true; // Canvas is likely essential
             }
        } else {
             logAndWrite('Skipping Fabric Canvas wait as App Ready signal failed.', true);
        }

        // Wait for the image loaded success message - Conditional on Fabric canvas wait success (implicitly via pageHasErrors)
        if (!pageHasErrors) { // Only wait for image if previous essential steps succeeded
            const imageLoadTimeout = 20000;
            const imageLoaded = await waitForSignal(page, 'Image Loaded', imageLoadedPromise, imageLoadTimeout, errorList);
            if (!imageLoaded) {
                // Warning/error already logged by waitForSignal
                 logAndWrite('Image Loaded signal timed out. Page content might be incomplete.', true);
                 pageHasErrors = true; // Consider this an error state
            }
        } else {
             logAndWrite('Skipping Image Loaded signal wait due to previous errors.', true);
        }

        // Now that we've waited, get the full HTML content of the page
        await log_and_shot(page, 'Starting page.content()...');
        htmlContent = await page.content();
        await log_and_shot(page, 'Completed page.content().');

        // Optional: Save the content to a file (like in capture_dom.js)
        // const outputFile = path.join(__dirname, 'client_chrome_dump.html');
        // await log_and_shot(page, `Starting save to file: ${outputFile}...`);
        // fs.writeFileSync(outputFile, htmlContent);
        // await log_and_shot(page, 'Completed save to file.');

        // Check if any errors occurred during the process
        if (pageHasErrors) {
            // Log a summary error message
            const finalErrorMsg = 'Errors were detected during page processing. Check logs.';
            logAndWrite(finalErrorMsg, true);
            // No need to throw here, let the calling function decide based on errorList/pageHasErrors
        }

    } catch (error) {
      const errorMsg = `[FATAL ERROR] in performPuppeteerSteps: ${error.message}`;
      logAndWrite(errorMsg, true);
      errorList.push(`Script fatal error: ${error.message}`);
      pageHasErrors = true; // Ensure error state is flagged
      // Capture screenshot on fatal error if page exists
       if (page && !page.isClosed()) {
           try {
               const errorScreenshotPath = path.join(__dirname, 'client_fatal_error_screenshot.png');
               await page.screenshot({ path: errorScreenshotPath, fullPage: true });
               logAndWrite(`Fatal error screenshot saved to ${errorScreenshotPath}`);
           } catch (screenshotError) {
               const ssErrorMsg = `[ERROR]: Failed to take fatal error screenshot: ${screenshotError.message}`;
                logAndWrite(ssErrorMsg, true);
                errorList.push(`Fatal error screenshot failure: ${screenshotError.message}`);
           }
       }
    } finally {
        if (page && !page.isClosed()) {
            await log_and_shot(page, 'Closing page...');
            await page.close();
             logAndWrite('Page closed.');
        }
    }

    return { htmlContent, pageHasErrors }; // Return content and error status
}
// ----------------------------------------------------------------------------------

// --- MODIFIED testPage Function ---
async function testPage(urlToProcess) {
  logAndWrite('\n==================================================');
  logAndWrite(`Test Run: ${new Date().toLocaleString()}`);
  logAndWrite(`--------------------------------------------------`);
  logAndWrite(`Target URL: ${urlToProcess}`);
  // Removed actions logging as we aren't sending them anymore
  logAndWrite(`==================================================\n`);
  
  const readyTime = Date.now();
  const readyDuration = ((readyTime - clientStartTime) / 1000).toFixed(1);
  logAndWrite(`[${new Date().toLocaleString()}] Client ready, launching Puppeteer... (Prep took ${readyDuration}s)`);

  let browser = null;
  let overallErrors = []; // Collect errors from signals and page
  let result = null;

  try {
      browser = await puppeteer.launch({
          headless: true, // Or false for debugging
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'], // Common args
          defaultViewport: { width: 1920, height: 1080 } // Set viewport to 1080p
      });
      logAndWrite('Browser launched.');

      // Call the new function to perform the steps
      result = await performPuppeteerSteps(browser, urlToProcess, overallErrors);

  } catch (launchError) {
      const errorMsg = `[FATAL ERROR] Failed to launch Puppeteer: ${launchError.message}`;
      logAndWrite(errorMsg, true);
      overallErrors.push(errorMsg);
      result = { htmlContent: '', pageHasErrors: true }; // Ensure result object exists for finally block
  } finally {
      if (browser) {
          logAndWrite('Closing browser...');
          await browser.close();
          logAndWrite('Browser closed.');
      }
  }

  const processEndTime = Date.now();
  const processDuration = ((processEndTime - readyTime) / 1000).toFixed(1);
  logAndWrite(`[${new Date().toLocaleString()}] Puppeteer process finished. (Duration: ${processDuration}s)`);

  // --- Process Results ---
    logAndWrite('\n--- Test Results ---');
  if (result && result.htmlContent) {
      // Try to extract title (basic example)
      const titleMatch = result.htmlContent.match(/<title>(.*?)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1] : 'Title not found';
      logAndWrite('Page title: ' + pageTitle);
      logAndWrite('HTML length: ' + result.htmlContent.length);
    // logAndWrite('\n--- Received HTML ---');
      // logAndWrite(result.htmlContent); // Usually too verbose
  } else {
      logAndWrite('No HTML content captured.', true);
  }
    logAndWrite('--------------------');

  // Report captured errors/warnings
  if (overallErrors.length > 0) {
      logAndWrite('\n--- Captured Errors/Warnings ---');
      overallErrors.forEach(err => {
          // Ensure error messages are logged with the error flag
          logAndWrite(`${colors.red}[ERROR DETECTED] ${err}${colors.reset}`, true);
      });
      logAndWrite('-------------------------------');
  } else {
      logAndWrite('No specific errors captured by the script.');
  }

  // --- Final Summary ---
  logAndWrite('\n--- Test Summary ---');
  const endTime = Date.now();
  const totalDuration = ((endTime - clientStartTime) / 1000).toFixed(1);
  // Determine pass/fail based on pageHasErrors flag from result and overallErrors array
  const hasErrors = (result && result.pageHasErrors) || overallErrors.length > 0;

  if (hasErrors) {
    const failMsg = `${colors.red}Test FAILED (Errors detected during execution or on page)${colors.reset}`;
    logAndWrite(failMsg, true);
  } else {
    const passMsg = `${colors.green}Test PASSED (No errors detected)${colors.reset}`;
    logAndWrite(passMsg);
  }
  logAndWrite(`Total time: ${totalDuration}s (Completed at ${new Date().toLocaleString()})`);
  logAndWrite('====================');
}

// Call testPage without the actions array
testPage(targetUrl);
