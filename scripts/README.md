# Database Management Scripts

This directory contains scripts for database backup and restoration.

## Backup Script

The backup script creates a SQL dump of your PostgreSQL database running in Docker and saves it to the `db-backups` directory. It automatically manages backup retention, keeping only the 7 most recent backups.

### Usage

```bash
# Using npm scripts
yarn db:backup

# Or directly
node scripts/backup-db.js
```

## Restore Script

The restore script allows you to restore the database from a previous backup. It provides an interactive menu to select which backup to restore, or you can specify a backup file name as an argument.

### Usage

```bash
# Using npm scripts (interactive mode)
yarn db:restore

# Specifying a backup file
yarn db:restore backup-2023-04-15T12-34-56-789Z.sql

# Or directly
node scripts/restore-db.js
```

## Configuration

Both scripts use the following configuration, which you may need to adjust:

- Container name: `meal-planner-db-1`
- Database name: `mealplanner`
- Database user: `mealuser`

If your Docker container has a different name, you'll need to update the `CONTAINER_NAME` variable in both scripts.

## Backup Retention

The backup script automatically maintains only the 7 most recent backups. Older backups are deleted when new ones are created. If you need to keep more or fewer backups, modify the `MAX_BACKUPS` constant in the backup script. 