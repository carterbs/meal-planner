#!/usr/bin/env node

/*
 * Utility script to terminate any running Meal-Planner backend or MCP servers.
 *
 * The script attempts to kill processes listening on the well-known ports used
 * by the application:
 *   - 8000  : Backend REST API when run via `yarn start`
 *   - 8080  : Backend REST API when run via `yarn start:mcp`
 *   - 5000  : (legacy) Backend port when invoked by older scripts
 *   - 3001  : MCP server (GraphQL/API gateway)
 *
 * NOTE: This script is **safe** to run multiple times. If a port is not in use
 * nothing happens. It relies on `lsof` which is available by default on macOS
 * and most Unix-like systems.
 */

const { execSync } = require('child_process');
const chalk = require('chalk');

const portsToKill = [
  8000,
  8090, // api-gateway
  5000, 
  3001, 
  3000,
  // logging service
  50052,
  // agent service
  50053,
  // grpc backend
  50051];

function killProcessOnPort(port) {
  try {
    const pids = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
    if (pids) {
      console.log(chalk.yellow(`⚠️  Found process(es) on port ${port}. Killing…`));
      // `kill -9` each pid. lsof may return multiple PIDs separated by \n
      execSync(`kill -9 ${pids.split('\n').join(' ')}`, { stdio: 'ignore' });
      console.log(chalk.green(`✅  Killed process(es) on port ${port}`));
    } else {
      console.log(chalk.gray(`ℹ️  No process found on port ${port}`));
    }
  } catch (error) {
    // lsof exits with non-zero if no processes use the port. Ignore.
    console.log(chalk.gray(`ℹ️  No process found on port ${port}`));
  }
}

console.log(chalk.blue('🔪  Attempting to kill backend and MCP servers…'));
portsToKill.forEach(killProcessOnPort);
console.log(chalk.blue('🏁  Finished cleaning up server processes.'));
