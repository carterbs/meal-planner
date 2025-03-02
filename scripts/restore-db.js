#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const BACKUP_DIR = path.join(__dirname, '..', 'db-backups');
const CONTAINER_NAME = 'meal-planner-db-1'; // Adjust if your container name is different
const DB_NAME = 'mealplanner';
const DB_USER = 'mealuser';

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`Backup directory does not exist: ${BACKUP_DIR}`);
    process.exit(1);
}

// Get list of available backups
const backups = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.startsWith('backup-') && file.endsWith('.sql'))
    .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time); // Sort newest first

if (backups.length === 0) {
    console.error('No backups found!');
    process.exit(1);
}

// Check if a specific backup file was specified
const specifiedBackup = process.argv[2];
let backupToRestore;

if (specifiedBackup) {
    // Try to find the specified backup
    backupToRestore = backups.find(b => b.name === specifiedBackup || b.path === specifiedBackup);

    if (!backupToRestore) {
        console.error(`Specified backup not found: ${specifiedBackup}`);
        console.log('Available backups:');
        backups.forEach((b, i) => {
            console.log(`${i + 1}. ${b.name}`);
        });
        process.exit(1);
    }

    restoreBackup(backupToRestore);
} else {
    // No backup specified, show a list and let the user choose
    console.log('Available backups:');
    backups.forEach((b, i) => {
        const date = new Date(b.time);
        console.log(`${i + 1}. ${b.name} (${date.toLocaleString()})`);
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter the number of the backup to restore (or "q" to quit): ', (answer) => {
        rl.close();

        if (answer.toLowerCase() === 'q') {
            console.log('Restore cancelled.');
            process.exit(0);
        }

        const index = parseInt(answer) - 1;
        if (isNaN(index) || index < 0 || index >= backups.length) {
            console.error('Invalid selection!');
            process.exit(1);
        }

        restoreBackup(backups[index]);
    });
}

function restoreBackup(backup) {
    try {
        // Verify the container is running
        try {
            execSync(`docker container inspect ${CONTAINER_NAME} > /dev/null 2>&1`);
        } catch (error) {
            throw new Error(`Docker container '${CONTAINER_NAME}' not found or not running.`);
        }

        console.log(`\nRestoring database from backup: ${backup.name}`);
        console.log('WARNING: This will overwrite the current database!');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('Are you sure you want to continue? (y/n): ', (answer) => {
            rl.close();

            if (answer.toLowerCase() !== 'y') {
                console.log('Restore cancelled.');
                process.exit(0);
            }

            console.log('Restoring database...');

            try {
                // Execute psql to restore the database
                execSync(
                    `cat "${backup.path}" | docker exec -i ${CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME}`,
                    { stdio: 'inherit' }
                );

                console.log('Database restore completed successfully!');
            } catch (error) {
                console.error('Restore failed:', error.message);
                process.exit(1);
            }
        });
    } catch (error) {
        console.error('Restore failed:', error.message);
        process.exit(1);
    }
} 