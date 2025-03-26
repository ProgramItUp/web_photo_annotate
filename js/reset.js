/**
 * Force refresh JavaScript resources
 */
console.log('Reset script loaded - forcing refresh of resources');

// Add timestamp to script URLs to force refresh
document.querySelectorAll('script').forEach(script => {
    if (script.src && !script.src.includes('reset.js')) {
        const timestamp = Date.now();
        script.src = script.src.split('?')[0] + '?v=' + timestamp;
    }
}); 