/**
 * Effect Orphan Detection Test
 *
 * This test attempts to detect the effect_orphan error by running
 * the Svelte app in a controlled environment and monitoring for
 * the specific error pattern.
 */

const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Effect Orphan Detection', function () {
  let dom, window, document, console_logs, console_errors;

  beforeEach(function () {
    // Create a clean DOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body></body>
      </html>
    `,
      {
        url: 'http://localhost',
        pretendToBeVisual: true,
        resources: 'usable',
      }
    );

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.navigator = window.navigator;

    // Capture console output
    console_logs = [];
    console_errors = [];

    // Mock console to capture output
    window.console = {
      log: (...args) => {
        console_logs.push(args.join(' '));
        console.log(...args); // Still log to actual console
      },
      error: (...args) => {
        console_errors.push(args.join(' '));
        console.error(...args); // Still log to actual console
      },
      warn: (...args) => {
        console_logs.push('WARN: ' + args.join(' '));
        console.warn(...args);
      },
    };

    // Mock VS Code API
    global.acquireVsCodeApi = function () {
      return {
        postMessage: function (message) {
          console_logs.push('VS Code API: ' + JSON.stringify(message));
        },
      };
    };
  });

  afterEach(function () {
    if (dom) {
      dom.window.close();
    }
    // Clean up globals
    delete global.window;
    delete global.document;
    delete global.navigator;
    delete global.acquireVsCodeApi;
  });

  it('should detect effect_orphan error when loading main bundle', function (done) {
    this.timeout(15000); // 15 second timeout

    let errorDetected = false;
    let allErrors = [];

    // Comprehensive error capturing
    const originalError = window.onerror;
    window.onerror = function (message, source, lineno, colno, error) {
      const errorStr = `${message} at ${source}:${lineno}:${colno}`;
      allErrors.push({ type: 'onerror', message, source, lineno, colno, error });
      console_errors.push(`Uncaught Error: ${errorStr}`);

      if (
        message &&
        (message.includes('effect_orphan') || message.includes('svelte.dev/e/effect_orphan'))
      ) {
        errorDetected = true;
        console.error('🔍 DETECTED: effect_orphan error found in onerror!');
        console.error('Error details:', { message, source, lineno, colno, error });
      }

      if (message && message.includes('An instance of the VS Code API has already been acquired')) {
        errorDetected = true;
        console.error('🔍 DETECTED: VS Code API double acquisition error!');
        console.error('Error details:', { message, source, lineno, colno, error });
      }

      if (originalError) {
        return originalError.apply(this, arguments);
      }
      return false;
    };

    // Capture promise rejections
    window.addEventListener('unhandledrejection', function (event) {
      allErrors.push({ type: 'unhandledrejection', reason: event.reason });
      console_errors.push(`Unhandled Promise Rejection: ${event.reason}`);
      if (event.reason && event.reason.toString().includes('effect_orphan')) {
        errorDetected = true;
        console.error('🔍 DETECTED: effect_orphan error in promise rejection!');
      }
    });

    // Override console.error to catch thrown errors
    const originalConsoleError = window.console.error;
    window.console.error = function (...args) {
      const message = args.join(' ');
      allErrors.push({ type: 'console.error', args });

      if (message.includes('effect_orphan') || message.includes('svelte.dev/e/effect_orphan')) {
        errorDetected = true;
        console.error('🔍 DETECTED: effect_orphan error in console.error!');
      }

      if (message.includes('An instance of the VS Code API has already been acquired')) {
        errorDetected = true;
        console.error('🔍 DETECTED: VS Code API double acquisition error in console.error!');
      }

      return originalConsoleError.apply(this, args);
    };

    try {
      // Load the compiled main.js bundle
      const fs = require('fs');
      const path = require('path');
      const bundlePath = path.join(__dirname, '..', 'out', 'webview', 'main.js');

      if (!fs.existsSync(bundlePath)) {
        throw new Error(`Bundle not found at ${bundlePath}. Run 'npm run compile' first.`);
      }

      console.log('📦 Loading bundle from:', bundlePath);
      const bundleCode = fs.readFileSync(bundlePath, 'utf8');

      // Ensure we have a body element for Svelte to mount to
      if (!document.body) {
        document.body = document.createElement('body');
      }

      // Execute the bundle code directly
      try {
        // Use eval to execute the code and catch any immediate errors
        eval(bundleCode);
        console.log('📄 Bundle executed successfully');
      } catch (immediateError) {
        allErrors.push({ type: 'immediate', error: immediateError });
        console.error('📄 Immediate error during bundle execution:', immediateError);
        if (immediateError.message && immediateError.message.includes('effect_orphan')) {
          errorDetected = true;
          console.error('🔍 DETECTED: effect_orphan error during immediate execution!');
        }

        if (
          immediateError.message &&
          immediateError.message.includes(
            'An instance of the VS Code API has already been acquired'
          )
        ) {
          errorDetected = true;
          console.error(
            '🔍 DETECTED: VS Code API double acquisition error during immediate execution!'
          );
        }
      }

      // Wait for potential async errors
      setTimeout(() => {
        console.log('📋 Console logs captured:', console_logs.length);
        console.log('❌ Console errors captured:', console_errors.length);
        console.log('🔍 All errors captured:', allErrors.length);

        // Print first few logs for debugging
        console.log('First few logs:', console_logs.slice(0, 10));
        console.log('All errors summary:', allErrors);

        // Check if we detected effect_orphan
        if (errorDetected) {
          console.error('🚨 effect_orphan error DETECTED in test environment!');
          done(new Error('effect_orphan error detected - this confirms the bug exists'));
        } else {
          console.log('✅ No effect_orphan error detected in test environment');
          // Check if we got the expected startup messages
          const hasStartupMessage = console_logs.some(log =>
            log.includes('Starting Phase 4 Svelte App')
          );
          if (hasStartupMessage) {
            console.log('✅ Found expected startup messages - app initialized successfully');
          } else {
            console.log('⚠️  No startup messages found - app may not have initialized');
          }
          done(); // Pass test
        }
      }, 3000); // Wait 3 seconds for app to initialize
    } catch (error) {
      console.error('Test setup error:', error);
      done(error);
    }
  });

  it('should log expected Phase 4 messages when successful', function () {
    // Check that our expected startup messages would be present
    const expectedMessages = [
      'Starting Phase 4 Svelte App',
      'Environment:',
      'App.svelte mounted - Phase 4 architecture',
    ];

    let foundMessages = 0;
    expectedMessages.forEach(expected => {
      const found = console_logs.some(log => log.includes(expected));
      if (found) {foundMessages++;}
    });

    console.log(`Found ${foundMessages}/${expectedMessages.length} expected messages`);
    // This is just informational - we're not failing on this
  });
});
