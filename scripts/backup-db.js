#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const BACKUP_DIR = path.join(__dirname, '..', 'db-backups');
const MAX_BACKUPS = 7;
const CONTAINER_NAME = 'meal-planner-db-1'; // Adjust if your container name is different
const DB_NAME = 'mealplanner';
const DB_USER = 'mealuser';

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`Created backup directory: ${BACKUP_DIR}`);
}

// Generate backup filename with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.sql`);

try {
    // Verify the container is running
    try {
        execSync(`docker container inspect ${CONTAINER_NAME} > /dev/null 2>&1`);
    } catch (error) {
        throw new Error(`Docker container '${CONTAINER_NAME}' not found or not running.`);
    }

    console.log(`Starting database backup to ${backupFile}...`);

    // Execute pg_dump inside the container and save to local file
    execSync(
        `docker exec -t ${CONTAINER_NAME} pg_dump -U ${DB_USER} -d ${DB_NAME} > "${backupFile}"`,
        { stdio: 'inherit' }
    );

    console.log('Database backup completed successfully!');

    // Manage backup retention - keep only the last MAX_BACKUPS
    const backups = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.startsWith('backup-') && file.endsWith('.sql'))
        .map(file => ({
            name: file,
            path: path.join(BACKUP_DIR, file),
            time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Sort newest first

    // Remove older backups
    if (backups.length > MAX_BACKUPS) {
        console.log(`Maintaining maximum of ${MAX_BACKUPS} backups...`);
        backups.slice(MAX_BACKUPS).forEach(backup => {
            fs.unlinkSync(backup.path);
            console.log(`Removed old backup: ${backup.name}`);
        });
    }

    console.log(`Backups stored in: ${BACKUP_DIR}`);
    console.log(`Total backups: ${Math.min(backups.length, MAX_BACKUPS)}`);
} catch (error) {
    console.error('Backup failed:', error.message);
    process.exit(1);
} 