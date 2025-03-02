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
let backendStartTime, backendEndTime, frontendStartTime, frontendEndTime;

// Run the tests and capture output
console.log(chalk.blue('🧪 Running tests and analyzing results...\n'));

// First run backend tests
console.log(chalk.blue('Running backend tests...'));
backendStartTime = Date.now();
const backendTestProcess = spawn('yarn', ['test:backend'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
});

// Process test output
backendTestProcess.stdout.on('data', (data) => {
    const output = data.toString();
    const lines = output.split('\n');

    lines.forEach(line => {
        // Capture individual test results for backend
        const testPassMatch = line.match(/--- PASS: (\w+)/);
        if (testPassMatch) {
            backendResults.pass++;
        }

        // Capture individual test failures for backend
        const testFailMatch = line.match(/--- FAIL: (\w+)/);
        if (testFailMatch) {
            backendResults.fail++;
        }

        // Capture package results for backend
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
    });
});

// Process stderr as well for backend
backendTestProcess.stderr.on('data', (data) => {
    // Just logging to console for now
    process.stderr.write(data);
});

// When backend tests are done, run frontend tests
backendTestProcess.on('close', (backendCode) => {
    backendEndTime = Date.now();

    console.log(chalk.blue('\nRunning frontend tests...'));
    frontendStartTime = Date.now();

    const frontendTestProcess = spawn('yarn', ['test:frontend'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
    });

    // Process frontend test output
    frontendTestProcess.stdout.on('data', (data) => {
        const output = data.toString();
        // Suppress output by not writing to stdout
        // process.stdout.write(data); // Echo output to console

        const lines = output.split('\n');
        lines.forEach(line => {
            // Capture frontend test summary with proper regex that handles both pass/fail formats
            const suitesMatch = line.match(/Test Suites:\s+(\d+)\s+passed,(?:\s+(\d+)\s+failed,)?\s+(\d+)\s+total/);
            if (suitesMatch) {
                const [, pass, fail = '0', total] = suitesMatch;
                frontendResults.suites = {
                    pass: parseInt(pass, 10),
                    fail: parseInt(fail, 10),
                    total: parseInt(total, 10)
                };
            }

            const testsMatch = line.match(/Tests:\s+(\d+)\s+passed,(?:\s+(\d+)\s+failed,)?\s+(\d+)\s+total/);
            if (testsMatch) {
                const [, pass, fail = '0', total] = testsMatch;
                frontendResults.tests = {
                    pass: parseInt(pass, 10),
                    fail: parseInt(fail, 10),
                    total: parseInt(total, 10)
                };
            }
        });
    });

    // Process stderr for frontend tests
    frontendTestProcess.stderr.on('data', (data) => {
        const output = data.toString();
        // Suppress stderr output too
        // process.stderr.write(data); // Echo output to console

        const lines = output.split('\n');
        lines.forEach(line => {
            // Some Jest output might be in stderr, particularly if there are warnings
            const suitesMatch = line.match(/Test Suites:\s+(\d+)\s+passed,(?:\s+(\d+)\s+failed,)?\s+(\d+)\s+total/);
            if (suitesMatch) {
                const [, pass, fail = '0', total] = suitesMatch;
                frontendResults.suites = {
                    pass: parseInt(pass, 10),
                    fail: parseInt(fail, 10),
                    total: parseInt(total, 10)
                };
            }

            const testsMatch = line.match(/Tests:\s+(\d+)\s+passed,(?:\s+(\d+)\s+failed,)?\s+(\d+)\s+total/);
            if (testsMatch) {
                const [, pass, fail = '0', total] = testsMatch;
                frontendResults.tests = {
                    pass: parseInt(pass, 10),
                    fail: parseInt(fail, 10),
                    total: parseInt(total, 10)
                };
            }
        });
    });

    // Print summary when frontend tests are done
    frontendTestProcess.on('close', (frontendCode) => {
        frontendEndTime = Date.now();
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        const backendExecutionTime = backendEndTime - backendStartTime;
        const frontendExecutionTime = frontendEndTime - frontendStartTime;

        console.log(chalk.yellow('\n============================================'));
        console.log(chalk.yellow('             TEST SUMMARY'));
        console.log(chalk.yellow('============================================\n'));

        // Backend summary
        const backendFailed = backendResults.fail > 0 || backendCode !== 0;
        console.log(chalk.cyan('🔹 BACKEND TESTS ') + chalk.gray(`(${formatTime(backendExecutionTime)})`));
        console.log(chalk.cyan('----------------'));

        const backendPackages = Object.keys(backendResults.packages);
        if (backendPackages.length > 0) {
            backendPackages.forEach(pkg => {
                const result = backendResults.packages[pkg];
                const statusColor = result.status === 'pass' ? chalk.green : chalk.red;
                console.log(`${statusColor('■')} ${pkg.padEnd(30)} ${formatTime(result.time * 1000)}`);
            });
        }

        // Also show test counts for backend
        const backendTotal = backendResults.pass + backendResults.fail;
        const statusColor = backendResults.fail === 0 ? chalk.green : chalk.red;
        console.log(`${statusColor('■')} Total Tests: ${backendTotal} (${backendResults.pass} passed, ${backendResults.fail} failed)`);

        // Print command to run backend tests if they failed
        if (backendFailed) {
            console.log(chalk.red('\n❗ Backend tests failed. Run the following command to see details:'));
            console.log(chalk.yellow('   yarn test:backend'));
        }

        // Frontend summary
        const frontendFailed = frontendResults.tests.fail > 0 || frontendCode !== 0;
        console.log(chalk.cyan('\n🔹 FRONTEND TESTS ') + chalk.gray(`(${formatTime(frontendExecutionTime)})`));
        console.log(chalk.cyan('----------------'));
        const frontendStatus = frontendFailed ? 'FAIL' : 'PASS';
        const frontendColor = frontendFailed ? chalk.red : chalk.green;

        console.log(`${frontendColor('■')} Test Suites: ${frontendResults.suites.pass} passed, ${frontendResults.suites.fail} failed, ${frontendResults.suites.total} total`);
        console.log(`${frontendColor('■')} Tests:       ${frontendResults.tests.pass} passed, ${frontendResults.tests.fail} failed, ${frontendResults.tests.total} total`);

        // Print command to run frontend tests if they failed
        if (frontendFailed) {
            console.log(chalk.red('\n❗ Frontend tests failed. Run the following command to see details:'));
            console.log(chalk.yellow('   yarn test:frontend'));
        }

        // Overall summary
        const totalFailed = backendResults.fail + frontendResults.tests.fail;
        const overallStatus = totalFailed === 0 && backendCode === 0 && frontendCode === 0 ? 'PASS' : 'FAIL';
        const overallColor = totalFailed === 0 && backendCode === 0 && frontendCode === 0 ? chalk.green : chalk.red;

        console.log(chalk.yellow('\n============================================'));
        console.log(`${overallColor('OVERALL: ' + overallStatus)} (${formatTime(executionTime)})`);
        console.log(chalk.yellow('============================================\n'));

        process.exit(frontendCode || backendCode);
    });
}); 