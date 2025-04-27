const scriptStartTime = Date.now();
console.log('[PUPPETEER] capture_dom.js script starting execution at ' + new Date().toString() + '...'); // Added startup message with local timezone


// capture_dom.js
const puppeteer = require('puppeteer');
const fs = require('fs'); // File system module to save the output

// --- Helper Function: Log and Screenshot ---
async function log_and_shot(page, message) {
    console.log(message); // Log the message first
    if (!page || page.isClosed()) {
        console.warn('[PUPPETEER] Warning: Page is not available or closed, skipping screenshot.');
        return;
    }
    try {
        await page.screenshot({ path: 'screenshot.png', fullPage: true });
    } catch (screenshotError) {
        // Log screenshot error but continue script execution
        console.error(`[PUPPETEER] Error taking screenshot after message "${message}":`, screenshotError.message);
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
        if (error.message.includes('Timeout')) {
            console.log(`[PUPPETEER] Attempting to take screenshot specifically for ${signalName} timeout...`);
            try {
                const screenshotPath = `${signalName.toLowerCase().replace(/\s+/g, '_')}_timeout_screenshot.png`;
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`[PUPPETEER] Timeout screenshot saved to ${screenshotPath}`);
            } catch (timeoutScreenshotError) {
                console.error('[PUPPETEER] Failed to take timeout-specific screenshot:', timeoutScreenshotError.message);
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

(async () => {
  // Define page outside try block for finally access
  let page;
  let browser;

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
    page.on('pageerror', error => {
      console.error('PAGE ERROR:', error.message); 
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
      console.log('PAGE LOG:', text); // Keep page logs as is
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

    // --- Take Final Screenshot --- Already done by log_and_shot ---
    // const finalScreenshotPath = 'final_screenshot.png';
    // console.log(`[PUPPETEER] Starting final screenshot save to: ${finalScreenshotPath}`);
    // await page.screenshot({ path: finalScreenshotPath, fullPage: true });
    // console.log(`[PUPPETEER] Completed final screenshot save.`);
    // ---------------------------

  } catch (error) {
      console.error('[PUPPETEER] An error occurred:', error);
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
          console.error('[PUPPETEER] Failed to take error screenshot:', screenshotError);
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
  }
})(); 