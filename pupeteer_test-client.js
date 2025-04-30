// test-client.js
const fs = require('fs');
const path = require('path'); // Needed for path.join

// Define log file path
const logFilePath = path.join(__dirname, 'pup.log');

// Clear the log file at the start of each run
try {
  fs.writeFileSync(logFilePath, '');
} catch (err) {
  console.error(`[PUP CLIENT] Failed to clear log file ${logFilePath}:`, err);
  // Decide if you want to exit or continue without file logging
  process.exit(1);
}

// Central logging function
function logAndWrite(message, isError = false) {
  try {
    fs.appendFileSync(logFilePath, message + '\n');
  } catch (err) {
    // Log error about failing to write to the log file to stderr, 
    // but don't try to log it to the file itself to avoid potential loops.
    console.error(`[PUP CLIENT] Failed to write to log file ${logFilePath}:`, err);
  }
  
  // Log to the appropriate console stream
  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
}

// Initial log message using the new function
logAndWrite(`[PUP CLIENT] [${new Date().toLocaleString()}] Starting pupeteer_test-client.js...`);
const clientStartTime = Date.now();

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
  logAndWrite(`[PUP CLIENT] [${new Date().toLocaleString()}] ERROR: Missing URL argument.`, true);
  logAndWrite('[PUP CLIENT] Usage: node pupeteer_test-client.js <URL>', true);
  process.exit(1); // Exit with error code
}

async function testPage(urlToProcess, actions) {
  logAndWrite('\n==================================================');
  logAndWrite(`[PUP CLIENT] Test Run: ${new Date().toLocaleString()}`);
  logAndWrite(`[PUP CLIENT] --------------------------------------------------`);
  logAndWrite(`[PUP CLIENT] Target URL: ${urlToProcess}`);
  logAndWrite(`[PUP CLIENT] Actions:`);
  actions.forEach((action, index) => {
    logAndWrite(`[PUP CLIENT]    ${index + 1}. ${action.type} (${action.selector || 'N/A'}${action.text ? `: '${action.text}'` : ''})`);
  });
  logAndWrite(`[PUP CLIENT] ==================================================\n`);
  
  const readyTime = Date.now();
  const readyDuration = ((readyTime - clientStartTime) / 1000).toFixed(1);
  logAndWrite(`[PUP CLIENT] [${new Date().toLocaleString()}] Client ready, sending request... (Prep took ${readyDuration}s)`);
  
  let response = null; // Initialize response to null
  let requestError = null;
  try {
    response = await axios.post('http://localhost:3000/process', {
      url: urlToProcess,
      actions: actions
    });
  } catch (error) {
    requestError = error; // Capture axios errors
  }

  const responseTime = Date.now();
  const requestDuration = ((responseTime - readyTime) / 1000).toFixed(1);
  logAndWrite(`[PUP CLIENT] [${new Date().toLocaleString()}] Request finished. (Duration: ${requestDuration}s)`);

  let hasErrors = false;

  if (requestError) {
    const errorMsg1 = `${colors.red}[PUP CLIENT REQUEST_ERROR] Failed to get response from server: ${requestError.message}${colors.reset}`;
    logAndWrite(errorMsg1, true);
    if (requestError.response) {
      const errorMsg2 = `${colors.red}[PUP CLIENT REQUEST_ERROR] Server responded with status: ${requestError.response.status}${colors.reset}`;
      const errorMsg3 = `${colors.red}[PUP CLIENT REQUEST_ERROR] Server response data: ${JSON.stringify(requestError.response.data)}${colors.reset}`;
      logAndWrite(errorMsg2, true);
      logAndWrite(errorMsg3, true);
    }
    hasErrors = true;
  } else if (response) {
    logAndWrite('\n--- Test Results ---');
    logAndWrite('[PUP CLIENT] Page title:' + response.data.title);
    logAndWrite('[PUP CLIENT] HTML length:' + response.data.html.length);
    // logAndWrite('\n--- Received HTML ---');
    // logAndWrite(response.data.html);
    logAndWrite('--------------------');

    // Print captured messages from the server, highlighting errors
    if (response.data.messages && response.data.messages.length > 0) {
      logAndWrite('\n--- Captured Console Messages ---');
      response.data.messages.forEach(msg => {
        const errorTypes = ['ERROR', 'PAGE JS_ERROR', 'TESTER SERVER ACTION_ERROR'];
        const isErrorType = errorTypes.includes(msg.type);
        const containsErrorLoading = msg.text && msg.text.includes('Error loading'); 

        let prefix = 'UNKNOWN';
        if (msg.type.startsWith('TESTER SERVER')) {
            prefix = msg.type;
        } else if (['LOG', 'ERROR', 'WARN', 'INFO', 'DEBUG'].includes(msg.type)) {
            prefix = `FROM JS ${msg.type}`;
        } else if (msg.type === 'PAGE JS_ERROR') {
            prefix = `FROM JS ${msg.type}`;
        } else {
             prefix = `FROM JS ${msg.type}`;
        }

        const isError = isErrorType || containsErrorLoading;
        let logString = `[${prefix}] ${msg.text}`;
        if (isError) {
          logString = `${colors.red}${logString}${colors.reset}`;
          hasErrors = true;
        }
        logAndWrite(logString, isError); // Pass the error flag to logAndWrite
      });
      logAndWrite('-------------------------------');
    }
  } else {
      const errorMsg = `${colors.red}[PUP CLIENT INTERNAL_ERROR] No response and no request error captured.${colors.reset}`;
      logAndWrite(errorMsg, true);
      hasErrors = true;
  }

  // Final Summary
  logAndWrite('\n--- Test Summary ---');
  const endTime = Date.now();
  const totalDuration = ((endTime - clientStartTime) / 1000).toFixed(1);
  if (hasErrors) {
    const failMsg = `${colors.red}[PUP CLIENT] Test FAILED (Errors detected)${colors.reset}`;
    logAndWrite(failMsg, true);
  } else {
    const passMsg = `${colors.green}[PUP CLIENT] Test PASSED (No errors detected)${colors.reset}`;
    logAndWrite(passMsg);
  }
  logAndWrite(`[PUP CLIENT] Total time: ${totalDuration}s (Completed at ${new Date().toLocaleString()})`);
  logAndWrite('====================');
}

testPage(targetUrl, actionsToPerform);
