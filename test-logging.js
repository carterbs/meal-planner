// Quick test script to trigger agent logging
const { initLogging, infoLog, errorLog, debugLog } = require('./typescript/agent/logging.ts');

console.log('Testing agent logging...');

// Initialize logging
initLogging('test-agent');

// Send some test logs
setTimeout(() => {
  console.log('Sending test logs...');
  infoLog('Test info message from agent');
  errorLog('Test error message from agent');
  debugLog('Test debug message from agent', { testField: 'testValue' });
}, 2000);

setTimeout(() => {
  console.log('Test complete');
  process.exit(0);
}, 5000);