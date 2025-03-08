# Testing Production Deployment

This guide outlines the process for testing your Meal Planner application's production setup before deploying to an actual production environment.

## Table of Contents

1. [Setting Up a Staging Environment](#setting-up-a-staging-environment)
2. [Testing the Full Container Stack](#testing-the-full-container-stack)
3. [Database Migration Testing](#database-migration-testing)
4. [Performance Testing](#performance-testing)
5. [Security Testing](#security-testing)
6. [Pre-Deployment Checklist](#pre-deployment-checklist)

## Setting Up a Staging Environment

Before deploying to production, always test your changes in a staging environment that mirrors production.

### Local Staging

```bash
# Create a staging-specific .env file
cp .env.example .env.staging

# Edit the staging environment variables
nano .env.staging

# Run the production stack with staging configuration
docker-compose -f docker-compose.prod.yml --env-file .env.staging up -d
```

### Testing with Production Builds

```bash
# Use the production Dockerfiles to build the images
docker-compose -f docker-compose.prod.yml build

# Start the stack with debug output
docker-compose -f docker-compose.prod.yml up
```

## Testing the Full Container Stack

### Verifying Container Health

```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# Review logs for errors
docker-compose -f docker-compose.prod.yml logs

# Check specific service logs
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend
docker-compose -f docker-compose.prod.yml logs db
```

### Testing Inter-Service Communication

1. **Database to Backend Connection**
   - Access the backend container and verify DB connection:
   ```bash
   docker-compose -f docker-compose.prod.yml exec backend sh
   # Inside the container, try connecting to the database:
   # For example, if your app has a health endpoint:
   curl http://localhost:8080/api/health
   ```

2. **Backend to Frontend Communication**
   - Open your browser and navigate to `http://localhost` (or whichever port you mapped)
   - Test API endpoints through the frontend interface
   - Verify that API calls from the frontend properly reach the backend

3. **Nginx Routing**
   - Test direct access to frontend static assets
   - Test API routing through the nginx proxy
   - Verify proper handling of SPA routes (page refreshes should work)

## Database Migration Testing

### Testing Migrations in Staging

```bash
# Apply migrations in staging environment
docker-compose -f docker-compose.prod.yml exec backend ./mealplanner --migrate

# Verify schema is correct
docker-compose -f docker-compose.prod.yml exec db psql -U mealuser -d mealplanner -c "\dt"
```

### Data Migration Verification

1. Create a backup of your development database
   ```bash
   yarn db:backup
   ```

2. Restore to the staging database
   ```bash
   # Change parameters as needed for your environment
   docker-compose -f docker-compose.prod.yml exec -T db psql -U mealuser -d mealplanner < backup.sql
   ```

3. Verify data integrity through the application

## Performance Testing

### Backend API Performance

```bash
# Install hey for HTTP load testing if needed
# On macOS: brew install hey

# Test API endpoints with load
hey -n 1000 -c 100 http://localhost/api/health
hey -n 1000 -c 100 http://localhost/api/meals
```

### Frontend Performance

1. Open Chrome DevTools (F12)
2. Go to the Lighthouse tab
3. Run a performance audit for Mobile and Desktop
4. Ensure scores meet your criteria (recommended: 80+ for all categories)

## Security Testing

### Container Security

```bash
# Install Docker security scanner
# Example: Trivy
# On macOS: brew install aquasecurity/trivy/trivy

# Scan your containers
trivy image mealplanner-backend
trivy image mealplanner-frontend
```

### Network Security

1. Verify that only the necessary ports are exposed
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   ```

2. Check for proper HTTPS configuration (if enabled)
   - Verify certificate validity
   - Check SSL configuration using SSL Labs: https://www.ssllabs.com/ssltest/

3. Test API endpoint authorization
   - Ensure unauthenticated users can't access protected routes
   - Verify proper role-based access control

## Pre-Deployment Checklist

Before deploying to production, verify the following:

- [ ] All containers build successfully
- [ ] All containers start and remain healthy
- [ ] Database migrations run without errors
- [ ] Frontend assets load properly
- [ ] API endpoints respond with correct data
- [ ] Error handling works as expected
- [ ] Security headers are properly configured
- [ ] Environment variables are properly set
- [ ] Logs are properly captured
- [ ] Backups are configured and tested
- [ ] Performance meets expectations under load
- [ ] All secrets and credentials are properly secured

### Rollback Plan

Always have a rollback plan in case something goes wrong:

```bash
# Return to previous version
git checkout <previous-tag-or-commit>

# Rebuild and restart with previous version
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# If database rollback is needed:
# Restore from the most recent backup
yarn db:restore
```

## Automated Testing

Consider setting up automated tests that run in a CI/CD pipeline before deployment:

```yaml
# Example GitHub Actions workflow
name: Test Production Build

on:
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build production containers
        run: docker-compose -f docker-compose.prod.yml build
      
      - name: Start containers
        run: docker-compose -f docker-compose.prod.yml up -d
      
      - name: Wait for services to be ready
        run: sleep 30
      
      - name: Run API tests
        run: |
          curl -f http://localhost/api/health
          # Add more API tests here
      
      - name: Check frontend
        run: |
          curl -f http://localhost
          # Add more frontend tests here
```

---

Remember that thorough testing in a staging environment that closely resembles production is the best way to catch issues before they affect your users.
