// test-client.js
console.log(`[PUP CLIENT] [${new Date().toLocaleString()}] Starting pupeteer_test-client.js...`);
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
  // Type the target URL into the input field
  { type: 'type', selector: '#url-image', text: targetUrl }, 
  // Click the Load URL button
  { type: 'click', selector: '#load-url-btn' } 
];

// Check if URL argument is provided
if (!targetUrl) {
  console.error(`[PUP CLIENT] [${new Date().toLocaleString()}] ERROR: Missing URL argument.`);
  console.error('[PUP CLIENT] Usage: node pupeteer_test-client.js <URL>');
  process.exit(1); // Exit with error code
}

async function testPage(urlToProcess, actions) {
  console.log('\n==================================================');
  console.log(`[PUP CLIENT] Test Run: ${new Date().toLocaleString()}`);
  console.log(`[PUP CLIENT] --------------------------------------------------`);
  console.log(`[PUP CLIENT] Target URL: ${urlToProcess}`);
  console.log(`[PUP CLIENT] Actions:`);
  actions.forEach((action, index) => {
    console.log(`[PUP CLIENT]    ${index + 1}. ${action.type} (${action.selector || 'N/A'}${action.text ? `: '${action.text}'` : ''})`);
  });
  console.log(`[PUP CLIENT] ==================================================\n`);
  
  const readyTime = Date.now();
  const readyDuration = ((readyTime - clientStartTime) / 1000).toFixed(1);
  console.log(`[PUP CLIENT] [${new Date().toLocaleString()}] Client ready, sending request... (Prep took ${readyDuration}s)`);
  
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
  console.log(`[PUP CLIENT] [${new Date().toLocaleString()}] Request finished. (Duration: ${requestDuration}s)`);

  let hasErrors = false;

  if (requestError) {
    console.error(`${colors.red}[PUP CLIENT REQUEST_ERROR] Failed to get response from server: ${requestError.message}${colors.reset}`);
    if (requestError.response) {
      console.error(`${colors.red}[PUP CLIENT REQUEST_ERROR] Server responded with status: ${requestError.response.status}${colors.reset}`);
      console.error(`${colors.red}[PUP CLIENT REQUEST_ERROR] Server response data: ${JSON.stringify(requestError.response.data)}${colors.reset}`);
    }
    hasErrors = true;
  } else if (response) {
    console.log('\n--- Test Results ---');
    console.log('[PUP CLIENT] Page title:', response.data.title);
    console.log('[PUP CLIENT] HTML length:', response.data.html.length);
    // console.log('\n--- Received HTML ---');
    // console.log(response.data.html);
    console.log('--------------------');

    // Print captured messages from the server, highlighting errors
    if (response.data.messages && response.data.messages.length > 0) {
      console.log('\n--- Captured Console Messages ---');
      response.data.messages.forEach(msg => {
        const errorTypes = ['ERROR', 'PAGE JS_ERROR', 'TESTER SERVER ACTION_ERROR'];
        const isErrorType = errorTypes.includes(msg.type);
        const containsErrorLoading = msg.text && msg.text.includes('Error loading'); 

        let prefix = 'UNKNOWN';
        if (msg.type.startsWith('TESTER SERVER')) {
            prefix = msg.type;
        } else if (['LOG', 'ERROR', 'WARN', 'INFO', 'DEBUG'].includes(msg.type)) {
            prefix = `PAGE ${msg.type}`;
        } else if (msg.type === 'PAGE JS_ERROR') {
            prefix = msg.type;
        } else {
             prefix = `PAGE ${msg.type}`;
        }

        if (isErrorType || containsErrorLoading) {
          console.error(`${colors.red}[${prefix}] ${msg.text}${colors.reset}`); 
          hasErrors = true;
        } else {
          console.log(`[${prefix}] ${msg.text}`);
        }
      });
      console.log('-------------------------------');
    }
  } else {
      console.error(`${colors.red}[PUP CLIENT INTERNAL_ERROR] No response and no request error captured.${colors.reset}`);
      hasErrors = true;
  }

  // Final Summary
  console.log('\n--- Test Summary ---');
  const endTime = Date.now();
  const totalDuration = ((endTime - clientStartTime) / 1000).toFixed(1);
  if (hasErrors) {
    console.log(`${colors.red}[PUP CLIENT] Test FAILED (Errors detected)${colors.reset}`);
  } else {
    console.log(`${colors.green}[PUP CLIENT] Test PASSED (No errors detected)${colors.reset}`);
  }
  console.log(`[PUP CLIENT] Total time: ${totalDuration}s`);
  console.log('====================');
}

testPage(targetUrl, actionsToPerform);
