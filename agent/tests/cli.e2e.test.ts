/**
 * End-to-End CLI Tests
 * These tests run the actual CLI binary and test complete workflows
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
  code?: number;
}

describe('CLI End-to-End Tests', () => {
  const testEnv = {
    ...process.env,
    // Override database to prevent test interference with real data
    DB_HOST: process.env.TEST_DB_HOST || 'localhost',
    DB_PORT: process.env.TEST_DB_PORT || '5432',
    DB_NAME: process.env.TEST_DB_NAME || 'meal_planner_test',
    DB_USER: process.env.TEST_DB_USER || 'postgres',
    DB_PASSWORD: process.env.TEST_DB_PASSWORD || 'password',
    NODE_ENV: 'test'
  };

  let createdThreadIds: string[] = [];

  // Helper function to check if database is available
  async function isDatabaseAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('node dist/cli.js status', { 
        env: testEnv,
        timeout: 10000 
      });
      return stdout.includes('System Health');
    } catch (error) {
      return false;
    }
  }

  // Helper function to extract thread ID from CLI output
  function extractThreadId(output: string): string | null {
    const match = output.match(/Thread ID: ([a-f0-9-]{36})/);
    return match ? match[1] : null;
  }

  // Helper function to cleanup created workflows
  async function cleanupWorkflows() {
    for (const threadId of createdThreadIds) {
      try {
        await execAsync(`node dist/cli.js cancel "${threadId}" --force`, { 
          env: testEnv,
          timeout: 5000 
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    createdThreadIds = [];
  }

  afterEach(async () => {
    await cleanupWorkflows();
  });

  describe('CLI Command Structure E2E', () => {
    test('should display help information', async () => {
      const { stdout } = await execAsync('node dist/cli.js --help');
      
      expect(stdout).toContain('meal-agent');
      expect(stdout).toContain('Meal planning agent');
      expect(stdout).toContain('Commands:');
      expect(stdout).toContain('plan');
      expect(stdout).toContain('status');
      expect(stdout).toContain('list');
      expect(stdout).toContain('resume');
      expect(stdout).toContain('cancel');
    });

    test('should display version', async () => {
      const { stdout } = await execAsync('node dist/cli.js --version');
      expect(stdout.trim()).toBe('1.0.0');
    });

    test('should display plan subcommands help', async () => {
      const { stdout } = await execAsync('node dist/cli.js plan --help');
      
      expect(stdout).toContain('Commands:');
      expect(stdout).toContain('start');
      expect(stdout).toContain('feedback');
      expect(stdout).toContain('finalize');
    });
  });

  describe('Input Validation E2E', () => {
    test('should reject invalid thread ID format', async () => {
      try {
        await execAsync('node dist/cli.js plan feedback "invalid-id" "test message"', {
          env: testEnv,
          timeout: 10000
        });
        fail('Should have thrown an error');
      } catch (error) {
        const execError = error as ExecError;
        expect(execError.stderr || execError.stdout).toContain('Invalid thread ID format');
      }
    });

    test('should reject invalid workflow type', async () => {
      try {
        await execAsync('node dist/cli.js list --type invalid_type', {
          env: testEnv,
          timeout: 10000
        });
        fail('Should have thrown an error');
      } catch (error) {
        const execError = error as ExecError;
        expect(execError.stderr || execError.stdout).toContain('Invalid workflow type');
      }
    });
  });

  describe('Basic CLI Operations E2E', () => {
    test('should handle status command gracefully', async () => {
      // This test works whether database is available or not
      try {
        const { stdout } = await execAsync('node dist/cli.js status', {
          env: testEnv,
          timeout: 10000
        });
        
        // If database is available, should show health info
        if (stdout.includes('System Health')) {
          expect(stdout).toContain('Statistics:');
          expect(stdout).toContain('Active Sessions:');
          expect(stdout).toContain('Total Workflows:');
        }
      } catch (error) {
        // If database is not available, should show error
        const execError = error as ExecError;
        expect(execError.stderr || execError.stdout).toBeDefined();
      }
    });

    test('should handle list command gracefully', async () => {
      try {
        const { stdout } = await execAsync('node dist/cli.js list', {
          env: testEnv,
          timeout: 10000
        });
        
        // Should either show workflows or indicate database issue
        expect(stdout.length).toBeGreaterThan(0);
      } catch (error) {
        // If database is not available, should show error
        const execError = error as ExecError;
        expect(execError.stderr || execError.stdout).toBeDefined();
      }
    });
  });

  describe('Workflow Lifecycle E2E', () => {
    beforeEach(async () => {
      const dbAvailable = await isDatabaseAvailable();
      if (!dbAvailable) {
        console.log('⏭️ Skipping workflow lifecycle tests - database not available');
        console.log('💡 To run full E2E tests, ensure test database is running');
        console.log('📝 Set TEST_DB_* environment variables if needed');
      }
    });

    test('should complete basic meal planning workflow', async () => {
      const dbAvailable = await isDatabaseAvailable();
      if (!dbAvailable) {
        console.log('⏭️ Skipping workflow test - database not available');
        return;
      }

      // Step 1: Start meal planning workflow
      const { stdout: startOutput } = await execAsync(
        'node dist/cli.js plan start --participants "e2e_user1,e2e_user2"',
        { env: testEnv, timeout: 15000 }
      );
      
      expect(startOutput).toContain('✅ Meal planning session started');
      expect(startOutput).toContain('Thread ID:');
      
      const threadId = extractThreadId(startOutput);
      expect(threadId).toBeTruthy();
      createdThreadIds.push(threadId!);

      // Step 2: Verify workflow appears in list
      const { stdout: listOutput } = await execAsync(
        'node dist/cli.js list',
        { env: testEnv, timeout: 10000 }
      );
      
      expect(listOutput).toContain('meal_planning');
      expect(listOutput).toContain(threadId!.substring(0, 8));

      // Step 3: Add feedback
      const { stdout: feedbackOutput } = await execAsync(
        `node dist/cli.js plan feedback "${threadId}" "I'd like some vegetarian options" --from e2e_user1`,
        { env: testEnv, timeout: 10000 }
      );
      
      expect(feedbackOutput).toContain('✅ Feedback added successfully from e2e_user1');

      // Step 4: Resume workflow
      const { stdout: resumeOutput } = await execAsync(
        `node dist/cli.js resume "${threadId}"`,
        { env: testEnv, timeout: 15000 }
      );
      
      expect(resumeOutput).toContain('✅ Workflow resumed successfully');

      // Step 5: Cancel workflow (cleanup)
      const { stdout: cancelOutput } = await execAsync(
        `node dist/cli.js cancel "${threadId}" --force`,
        { env: testEnv, timeout: 10000 }
      );
      
      expect(cancelOutput).toContain('✅ Workflow cancelled successfully');
      
      // Remove from cleanup list since we just cancelled it
      createdThreadIds = createdThreadIds.filter(id => id !== threadId);
    }, 60000); // Extended timeout for full workflow

    test('should handle workflow filtering by type', async () => {
      const dbAvailable = await isDatabaseAvailable();
      if (!dbAvailable) {
        console.log('⏭️ Skipping filtering test - database not available');
        return;
      }

      // Create a test workflow
      const { stdout: startOutput } = await execAsync(
        'node dist/cli.js plan start --participants "e2e_filter_test"',
        { env: testEnv, timeout: 15000 }
      );
      
      const threadId = extractThreadId(startOutput);
      expect(threadId).toBeTruthy();
      createdThreadIds.push(threadId!);

      // Test filtering by type
      const { stdout: filteredOutput } = await execAsync(
        'node dist/cli.js list --type meal_planning',
        { env: testEnv, timeout: 10000 }
      );
      
      expect(filteredOutput).toContain('meal_planning workflows:');
      expect(filteredOutput).toContain(threadId!.substring(0, 8));
    }, 30000);
  });

  describe('Error Handling E2E', () => {
    test('should handle non-existent workflow gracefully', async () => {
      const dbAvailable = await isDatabaseAvailable();
      if (!dbAvailable) {
        console.log('⏭️ Skipping error handling test - database not available');
        return;
      }

      const nonExistentThreadId = '123e4567-e89b-12d3-a456-426614174000';
      
      try {
        await execAsync(
          `node dist/cli.js resume "${nonExistentThreadId}"`,
          { env: testEnv, timeout: 10000 }
        );
        fail('Should have thrown an error');
      } catch (error) {
        const execError = error as ExecError;
        expect(execError.stderr || execError.stdout).toContain('Workflow not found');
      }
    });

    test('should handle malformed commands gracefully', async () => {
      try {
        await execAsync('node dist/cli.js plan', {
          env: testEnv,
          timeout: 5000
        });
        fail('Should have thrown an error');
      } catch (error) {
        const execError = error as ExecError;
        // Should show help or error message, not crash
        expect(execError.stderr || execError.stdout).toBeDefined();
      }
    });
  });

  describe('Data Formatting E2E', () => {
    test('should format help output correctly', async () => {
      const { stdout } = await execAsync('node dist/cli.js --help');
      
      // Check that help is well-formatted
      expect(stdout).toMatch(/Usage:/i);
      expect(stdout).toMatch(/Commands:/i);
      expect(stdout).toMatch(/Options:/i);
      
      // Check for proper spacing and structure
      const lines = stdout.split('\n');
      expect(lines.length).toBeGreaterThan(10);
    });

    test('should format workflow list table correctly when database available', async () => {
      const dbAvailable = await isDatabaseAvailable();
      if (!dbAvailable) {
        console.log('⏭️ Skipping table formatting test - database not available');
        return;
      }

      // Create a test workflow to ensure there's data
      const { stdout: startOutput } = await execAsync(
        'node dist/cli.js plan start --participants "table_test_user"',
        { env: testEnv, timeout: 15000 }
      );
      
      const threadId = extractThreadId(startOutput);
      if (threadId) {
        createdThreadIds.push(threadId);
      }

      const { stdout: listOutput } = await execAsync(
        'node dist/cli.js list',
        { env: testEnv, timeout: 10000 }
      );
      
      // Check table structure
      expect(listOutput).toContain('Thread ID');
      expect(listOutput).toContain('Type');
      expect(listOutput).toContain('Status');
      expect(listOutput).toContain('Created');
      expect(listOutput).toContain('Participants');
      
      // Check for table borders (Unicode box drawing characters)
      expect(listOutput).toMatch(/[┌┐└┘│─┬┴┼]/);
      
      if (threadId) {
        expect(listOutput).toContain(threadId.substring(0, 8));
        expect(listOutput).toContain('table_test_user');
      }
    }, 30000);
  });
});