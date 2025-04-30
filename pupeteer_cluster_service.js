console.log(`[PUP SERVER] [${new Date().toLocaleString()}] Starting cluster-service.js... wait for the service to complete intialization before sending requests`);
const startTime = Date.now();

const { Cluster } = require('puppeteer-cluster');
const express = require('express');
const app = express();
app.use(express.json());

// ANSI escape codes for colors
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
};

(async () => {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 4,
    puppeteerOptions: {
      headless: true,
      args: ['--no-sandbox']
    }
  });

  app.post('/process', async (req, res) => {
    try {
      const result = await cluster.execute({ url: req.body.url, actions: req.body.actions || [] }, 
        async ({ page, data }) => {
        const { url, actions } = data;
        const capturedMessages = [];
        
        page.on('console', msg => {
          const type = msg.type().toUpperCase();
          const text = msg.text();
          capturedMessages.push({ type, text });
        });
        page.on('pageerror', error => {
          capturedMessages.push({ 
            type: 'PAGE JS_ERROR', 
            text: `${error.message}\nStack: ${error.stack || 'N/A'}` 
          });
        });

        console.log(`${colors.green}[PUP SERVER] [${new Date().toLocaleString()}] Navigating to: ${url}${colors.reset}`);
        await page.goto(url, { waitUntil: 'networkidle2' });
        console.log(`[PUP SERVER] [${new Date().toLocaleString()}] Navigation complete for: ${url}`);

        console.log(`${colors.green}[PUP SERVER] [${new Date().toLocaleString()}] Performing ${actions.length} actions for: ${url}${colors.reset}`);
        for (const action of actions) {
          console.log(`${colors.green}[PUP SERVER] [${new Date().toLocaleString()}] Action: ${action.type} on selector '${action.selector || 'N/A'}'${colors.reset}`);
          try {
            switch (action.type) {
              case 'click':
                if (!action.selector) throw new Error('Click action requires a selector.');
                await page.waitForSelector(action.selector, { visible: true, timeout: 5000 });
                await page.click(action.selector);
                console.log(`[PUP SERVER] [${new Date().toLocaleString()}] Clicked '${action.selector}'`);
                await page.waitForTimeout(100);
                break;
              case 'type':
                if (!action.selector || !action.text) throw new Error('Type action requires both selector and text.');
                await page.waitForSelector(action.selector, { visible: true, timeout: 5000 });
                await page.type(action.selector, action.text);
                console.log(`[PUP SERVER] [${new Date().toLocaleString()}] Typed '${action.text}' into '${action.selector}'`);
                break;
              default:
                console.warn(`${colors.yellow}[PUP SERVER] [${new Date().toLocaleString()}] Unsupported action type: ${action.type}${colors.reset}`);
                capturedMessages.push({ type: 'PUP SERVER ACTION_WARN', text: `Unsupported action type: ${action.type}` });
            }
          } catch (err) {
            const errorMsg = `Failed action '${action.type}' on selector '${action.selector || 'N/A'}': ${err.message}`;
            console.error(`${colors.red}[PUP SERVER] [${new Date().toLocaleString()}] ${errorMsg}${colors.reset}`); 
            capturedMessages.push({ type: 'PUP SERVER ACTION_ERROR', text: errorMsg });
          }
        }
        console.log(`[PUP SERVER] [${new Date().toLocaleString()}] Actions complete for: ${url}`);

        const finalHtml = await page.content();
        const finalTitle = await page.title();
        
        return {
          html: finalHtml,
          title: finalTitle,
          messages: capturedMessages
        };
      });
      
      res.json(result);
    } catch (error) {
      console.error(`${colors.red}[PUP SERVER] [${new Date().toLocaleString()}] Error processing request: ${error.message}${colors.reset}`);
      console.error(`[PUP SERVER] Stack trace:`, error.stack);
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(3000, () => {
    const duration = Date.now() - startTime;
    const durationSeconds = (duration / 1000).toFixed(1);
    console.log(`[PUP SERVER] [${new Date().toLocaleString()}] Cluster service running on port 3000. Startup took ${durationSeconds}s.`);
  });
})();
