#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log(chalk.blue('🚀 Deploying Meal Planner to production...'));

// Ensure .env file exists
if (!fs.existsSync(path.join(PROJECT_ROOT, '.env'))) {
  console.log(chalk.yellow('⚠️ No .env file found, creating a default one...'));

  const defaultEnv = `
# Database Configuration
POSTGRES_USER=mealuser
POSTGRES_PASSWORD=secure_password_here
POSTGRES_DB=mealplanner

# Port Configuration
FRONTEND_PORT=80
NGINX_PORT=80
NGINX_SSL_PORT=443
  `.trim();

  fs.writeFileSync(path.join(PROJECT_ROOT, '.env'), defaultEnv);
  console.log(chalk.green('✅ Default .env file created. Please update it with secure credentials!'));
}

// Pull latest changes
try {
  console.log(chalk.blue('📥 Pulling latest changes...'));
  execSync('git pull', {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });
} catch (error) {
  console.error(chalk.red('❌ Failed to pull latest changes:'), error.message);
  console.log(chalk.yellow('🔄 Continuing with deployment...'));
}

// Build and deploy with docker-compose
try {
  console.log(chalk.blue('🏗️ Building and deploying containers...'));
  execSync('docker-compose -f docker-compose.prod.yml build', {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });

  console.log(chalk.blue('🚀 Starting production containers...'));
  execSync('docker-compose -f docker-compose.prod.yml up -d', {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });

  console.log(chalk.green('✅ Production deployment completed successfully!'));
  console.log(chalk.blue('ℹ️ Your application is now running in production mode.'));
} catch (error) {
  console.error(chalk.red('❌ Deployment failed:'), error.message);
  process.exit(1);
}

// Show running containers
try {
  console.log(chalk.blue('📊 Running containers:'));
  execSync('docker-compose -f docker-compose.prod.yml ps', {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });
} catch (error) {
  console.error(chalk.red('❌ Failed to show containers:'), error.message);
}

// Provide helpful commands
console.log(chalk.blue('\n📝 Helpful Commands:'));
console.log(chalk.yellow('  • View logs:'));
console.log('    docker-compose -f docker-compose.prod.yml logs -f');
console.log(chalk.yellow('  • Stop the application:'));
console.log('    docker-compose -f docker-compose.prod.yml down');
console.log(chalk.yellow('  • Restart a specific service:'));
console.log('    docker-compose -f docker-compose.prod.yml restart <service-name>');
