#!/usr/bin/env node

/**
 * Test Summary Script
 * 
 * This script runs the tests and provides a concise summary of passing and failing tests
 * for both backend and frontend components.
 */

const { spawn } = require('child_process');
const chalk = require('chalk');

// Tracks backend test results
const backendResults = {
    pass: 0,
    fail: 0,
    packages: {},
};

// Tracks frontend test results
const frontendResults = {
    suites: { pass: 0, fail: 0, total: 0 },
    tests: { pass: 0, fail: 0, total: 0 },
};

// Helper to format time
function formatTime(timeInMs) {
    return timeInMs < 1000
        ? `${timeInMs}ms`
        : `${(timeInMs / 1000).toFixed(2)}s`;
}

// Track execution time
const startTime = Date.now();

// Run the tests and capture output
console.log(chalk.blue('🧪 Running tests and analyzing results...\n'));

const testProcess = spawn('yarn', ['test'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
});

// Process backend test output
testProcess.stdout.on('data', (data) => {
    const output = data.toString();
    const lines = output.split('\n');

    lines.forEach(line => {
        // Capture individual test results
        const testPassMatch = line.match(/--- PASS: (\w+)/);
        if (testPassMatch) {
            backendResults.pass++;
        }

        // Capture individual test failures
        const testFailMatch = line.match(/--- FAIL: (\w+)/);
        if (testFailMatch) {
            backendResults.fail++;
        }

        // Capture package results
        const packageMatch = line.match(/ok\s+(\S+)\s+(\d+\.\d+)s/);
        if (packageMatch) {
            const [, packageName, time] = packageMatch;
            backendResults.packages[packageName] = {
                status: 'pass',
                time: parseFloat(time)
            };
        }

        const packageFailMatch = line.match(/FAIL\s+(\S+)\s+(\d+\.\d+)s/);
        if (packageFailMatch) {
            const [, packageName, time] = packageFailMatch;
            backendResults.packages[packageName] = {
                status: 'fail',
                time: parseFloat(time)
            };
        }

        // Capture frontend test summary
        const suitesMatch = line.match(/Test Suites:\s+(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+total/);
        if (suitesMatch) {
            const [, pass, fail, total] = suitesMatch;
            frontendResults.suites = {
                pass: parseInt(pass, 10),
                fail: parseInt(fail, 10),
                total: parseInt(total, 10)
            };
        }

        const testsMatch = line.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+total/);
        if (testsMatch) {
            const [, pass, fail, total] = testsMatch;
            frontendResults.tests = {
                pass: parseInt(pass, 10),
                fail: parseInt(fail, 10),
                total: parseInt(total, 10)
            };
        }
    });
});

// Handle errors
testProcess.stderr.on('data', (data) => {
    // Just logging errors to detect any issues with test execution
    // Not processing these for the summary unless needed
    // console.error(data.toString());
});

// Print summary when done
testProcess.on('close', (code) => {
    const endTime = Date.now();
    const executionTime = endTime - startTime;

    console.log(chalk.yellow('\n============================================'));
    console.log(chalk.yellow('             TEST SUMMARY'));
    console.log(chalk.yellow('============================================\n'));

    // Backend summary
    console.log(chalk.cyan('🔹 BACKEND TESTS'));
    console.log(chalk.cyan('----------------'));

    const backendPackages = Object.keys(backendResults.packages);
    if (backendPackages.length > 0) {
        backendPackages.forEach(pkg => {
            const result = backendResults.packages[pkg];
            const statusColor = result.status === 'pass' ? chalk.green : chalk.red;
            console.log(`${statusColor('■')} ${pkg.padEnd(30)} ${formatTime(result.time * 1000)}`);
        });
    } else {
        // If no packages were detected, show test counts
        const backendTotal = backendResults.pass + backendResults.fail;
        const statusColor = backendResults.fail === 0 ? chalk.green : chalk.red;
        console.log(`${statusColor('■')} Total Tests: ${backendTotal} (${backendResults.pass} passed, ${backendResults.fail} failed)`);
    }

    // Frontend summary
    console.log(chalk.cyan('\n🔹 FRONTEND TESTS'));
    console.log(chalk.cyan('----------------'));
    const frontendStatus = frontendResults.tests.fail === 0 ? 'PASS' : 'FAIL';
    const frontendColor = frontendResults.tests.fail === 0 ? chalk.green : chalk.red;

    console.log(`${frontendColor('■')} Test Suites: ${frontendResults.suites.pass} passed, ${frontendResults.suites.fail} failed, ${frontendResults.suites.total} total`);
    console.log(`${frontendColor('■')} Tests:       ${frontendResults.tests.pass} passed, ${frontendResults.tests.fail} failed, ${frontendResults.tests.total} total`);

    // Overall summary
    const totalFailed = backendResults.fail + frontendResults.tests.fail;
    const overallStatus = totalFailed === 0 ? 'PASS' : 'FAIL';
    const overallColor = totalFailed === 0 ? chalk.green : chalk.red;

    console.log(chalk.yellow('\n============================================'));
    console.log(`${overallColor('OVERALL: ' + overallStatus)} (${formatTime(executionTime)})`);
    console.log(chalk.yellow('============================================\n'));

    process.exit(code);
}); 