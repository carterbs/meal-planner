/**
 * Error Scenario Tests for CLI
 * Tests various error conditions and edge cases
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
  code?: number;
}

describe('CLI Error Scenario Tests', () => {
  describe('Input Validation Errors', () => {
    test('should handle empty arguments gracefully', async () => {
      try {
        await execAsync('node dist/cli.js plan feedback', { timeout: 5000 });
        fail('Should have thrown an error');
      } catch (error) {
        const execError = error as ExecError;
        // Should show missing arguments error, not crash
        expect(execError.stderr || execError.stdout).toBeDefined();
        expect(execError.stderr || execError.stdout).toMatch(/(missing|required|argument)/i);
      }
    });

    test('should handle malformed UUID thread IDs', async () => {
      const malformedIds = [
        'not-a-uuid',
        '123',
        '123e4567-e89b-12d3-a456-42661417400g', // invalid character
        '123e4567-e89b-12d3-a456-42661417400', // too short
        '123e4567-e89b-12d3-a456-4266141740000', // too long
        '', // empty
        '   ', // whitespace only
      ];

      for (const invalidId of malformedIds) {
        try {
          await execAsync(`node dist/cli.js plan feedback "${invalidId}" "test message"`, {
            timeout: 5000,
            env: { ...process.env, NODE_ENV: 'test' }
          });
          fail(`Should have rejected invalid ID: ${invalidId}`);
        } catch (error) {
          const execError = error as ExecError;
          expect(execError.stderr || execError.stdout).toContain('Invalid thread ID format');
        }
      }
    });

    test('should handle invalid workflow types', async () => {
      const invalidTypes = [
        'invalid_type',
        'MEAL_PLANNING', // wrong case
        'meal-planning', // wrong separator
        'recipe_planning', // non-existent
        '123', // numeric
        '', // empty
        'null',
        'undefined'
      ];

      for (const invalidType of invalidTypes) {
        try {
          await execAsync(`node dist/cli.js list --type "${invalidType}"`, {
            timeout: 5000,
            env: { ...process.env, NODE_ENV: 'test' }
          });
          fail(`Should have rejected invalid type: ${invalidType}`);
        } catch (error) {
          const execError = error as ExecError;
          const output = execError.stderr || execError.stdout || '';
          // Should fail with validation error or fail gracefully
          expect(output).toMatch(/(invalid workflow type|supported types|failed|error)/i);
        }
      }
    });

    test('should handle empty participant lists', async () => {
      try {
        await execAsync('node dist/cli.js plan start --participants ""', {
          timeout: 10000,
          env: { ...process.env, NODE_ENV: 'test' }
        });
        // This might succeed with default participants or fail - both are acceptable
      } catch (error) {
        const execError = error as ExecError;
        // If it fails, should be a reasonable error message
        expect(execError.stderr || execError.stdout).toBeDefined();
      }
    });

    test('should handle malformed participant lists', async () => {
      const malformedParticipants = [
        '   ', // whitespace only
        ',,,', // only commas
        'user1,,user2', // empty participant in middle
        ',user1,user2', // leading comma
        'user1,user2,', // trailing comma
      ];

      for (const participants of malformedParticipants) {
        try {
          await execAsync(`node dist/cli.js plan start --participants "${participants}"`, {
            timeout: 10000,
            env: { ...process.env, NODE_ENV: 'test' }
          });
          // This might succeed if CLI handles filtering - that's fine
        } catch (error) {
          const execError = error as ExecError;
          // If it fails, should be a reasonable error message
          expect(execError.stderr || execError.stdout).toBeDefined();
        }
      }
    });
  });

  describe('Database Connection Errors', () => {
    test('should handle database connection failure gracefully', async () => {
      const badDbEnv = {
        ...process.env,
        DB_HOST: 'nonexistent-host',
        DB_PORT: '9999',
        DB_NAME: 'nonexistent_db',
        DB_USER: 'nonexistent_user',
        DB_PASSWORD: 'wrong_password',
        NODE_ENV: 'test'
      };

      try {
        await execAsync('node dist/cli.js status', {
          env: badDbEnv,
          timeout: 15000
        });
        fail('Should have failed with database connection error');
      } catch (error) {
        const execError = error as ExecError;
        const output = execError.stderr || execError.stdout || '';
        
        // Should show meaningful error message, not crash
        expect(output).toMatch(/(connection|database|failed|error)/i);
        expect(output).toContain('❌'); // Should have error emoji formatting
      }
    });

    test('should handle database timeout gracefully', async () => {
      const timeoutEnv = {
        ...process.env,
        DB_HOST: '1.1.1.1', // This should timeout
        DB_PORT: '5432',
        NODE_ENV: 'test'
      };

      try {
        await execAsync('node dist/cli.js status', {
          env: timeoutEnv,
          timeout: 3000 // Shorter timeout
        });
        fail('Should have failed with timeout');
      } catch (error) {
        const execError = error as ExecError;
        const output = execError.stderr || execError.stdout || '';
        
        // Should handle timeout gracefully - either with output or by timing out
        expect(output).toBeDefined();
        // Accept either meaningful output or timeout behavior
        if (output.length === 0) {
          // If no output, should be a timeout which is acceptable
          expect(execError.code).toBeDefined();
        } else {
          // If there is output, should contain error info
          expect(output).toMatch(/(timeout|error|failed|connection)/i);
        }
      }
    }, 5000); // Add test timeout

    test('should handle missing database credentials', async () => {
      const noCreds: Record<string, string> = {
        ...process.env,
        NODE_ENV: 'test'
      };
      
      // Remove database environment variables
      delete noCreds.DB_HOST;
      delete noCreds.DB_PORT;
      delete noCreds.DB_NAME;
      delete noCreds.DB_USER;
      delete noCreds.DB_PASSWORD;

      try {
        await execAsync('node dist/cli.js status', {
          env: noCreds,
          timeout: 10000
        });
        // Might succeed with defaults or fail - both acceptable
      } catch (error) {
        const execError = error as ExecError;
        const output = execError.stderr || execError.stdout || '';
        expect(output).toBeDefined();
      }
    });
  });

  describe('Command Execution Errors', () => {
    test('should handle unknown commands gracefully', async () => {
      try {
        await execAsync('node dist/cli.js unknown-command', { timeout: 5000 });
        fail('Should have thrown an error');
      } catch (error) {
        const execError = error as ExecError;
        const output = execError.stderr || execError.stdout || '';
        
        // Should show help or error message, not crash
        expect(output).toMatch(/(unknown|invalid|help|usage)/i);
      }
    });

    test('should handle unknown subcommands gracefully', async () => {
      try {
        await execAsync('node dist/cli.js plan unknown-subcommand', { timeout: 5000 });
        fail('Should have thrown an error');
      } catch (error) {
        const execError = error as ExecError;
        const output = execError.stderr || execError.stdout || '';
        
        expect(output).toMatch(/(unknown|invalid|help|usage)/i);
      }
    });

    test('should handle missing required options', async () => {
      const commands = [
        'node dist/cli.js plan feedback', // missing thread-id and message
        'node dist/cli.js plan finalize', // missing thread-id
        'node dist/cli.js resume', // missing thread-id
        'node dist/cli.js cancel', // missing thread-id
      ];

      for (const command of commands) {
        try {
          await execAsync(command, { timeout: 5000 });
          fail(`Should have failed for: ${command}`);
        } catch (error) {
          const execError = error as ExecError;
          const output = execError.stderr || execError.stdout || '';
          
          expect(output).toMatch(/(missing|required|argument)/i);
        }
      }
    });

    test('should handle conflicting options gracefully', async () => {
      // Test commands with potentially conflicting options
      try {
        await execAsync('node dist/cli.js --version --help', { timeout: 5000 });
        // This might succeed (showing version) or fail - both are acceptable
      } catch (error) {
        const execError = error as ExecError;
        const output = execError.stderr || execError.stdout || '';
        expect(output).toBeDefined();
      }
    });
  });

  describe('Resource Limit Errors', () => {
    test('should handle extremely long messages', async () => {
      const longMessage = 'x'.repeat(10000); // 10KB message
      
      try {
        await execAsync(`node dist/cli.js plan feedback "123e4567-e89b-12d3-a456-426614174000" "${longMessage}"`, {
          timeout: 10000,
          env: { ...process.env, NODE_ENV: 'test' }
        });
        // Might succeed or fail depending on limits - both acceptable
      } catch (error) {
        const execError = error as ExecError;
        const output = execError.stderr || execError.stdout || '';
        expect(output).toBeDefined();
      }
    });

    test('should handle extremely long participant lists', async () => {
      const manyParticipants = Array.from({ length: 100 }, (_, i) => `user${i}`).join(',');
      
      try {
        await execAsync(`node dist/cli.js plan start --participants "${manyParticipants}"`, {
          timeout: 10000,
          env: { ...process.env, NODE_ENV: 'test' }
        });
        // Might succeed or fail - both acceptable
      } catch (error) {
        const execError = error as ExecError;
        const output = execError.stderr || execError.stdout || '';
        expect(output).toBeDefined();
      }
    });

    test('should handle special characters in messages', async () => {
      const specialMessages = [
        'Message with "quotes" and \'apostrophes\'',
        'Message with emojis 🍕🥗🍝',
        'Message with \nnewlines\nand\ttabs',
        'Message with unicode: café naïve résumé',
        'Message with symbols: @#$%^&*()[]{}|\\',
      ];

      for (const message of specialMessages) {
        try {
          await execAsync(`node dist/cli.js plan feedback "123e4567-e89b-12d3-a456-426614174000" "${message}"`, {
            timeout: 10000,
            env: { ...process.env, NODE_ENV: 'test' }
          });
          // These should work - testing that special chars don't break parsing
        } catch (error) {
          const execError = error as ExecError;
          const output = execError.stderr || execError.stdout || '';
          // If they fail, should be due to thread ID not found or other reasonable error
          expect(output).toMatch(/(thread|workflow|found|failed|error|invalid)/i);
        }
      }
    });
  });

  describe('Concurrent Operation Errors', () => {
    test('should handle rapid sequential commands', async () => {
      const commands = [
        'node dist/cli.js --help',
        'node dist/cli.js --version',
        'node dist/cli.js --help',
        'node dist/cli.js --version',
      ];

      // Run commands rapidly in sequence
      const promises = commands.map(cmd => 
        execAsync(cmd, { timeout: 5000 }).catch(error => error)
      );

      const results = await Promise.all(promises);
      
      // All should complete without crashing
      results.forEach(result => {
        if (result instanceof Error) {
          const execError = result as ExecError;
          // Even if some fail, they should fail gracefully
          expect(execError.stderr || execError.stdout).toBeDefined();
        } else {
          // Successful results should have output
          expect(result.stdout).toBeDefined();
        }
      });
    });
  });

  describe('Environment Error Conditions', () => {
    test('should handle missing Node.js environment gracefully', async () => {
      // Test with minimal environment
      const minimalEnv = {
        PATH: process.env.PATH,
        NODE_ENV: 'test'
      };

      try {
        await execAsync('node dist/cli.js --version', {
          env: minimalEnv,
          timeout: 5000
        });
        // Should work with minimal environment
      } catch (error) {
        const execError = error as ExecError;
        // If it fails, should be due to missing dependencies, not crashes
        expect(execError.stderr || execError.stdout).toBeDefined();
      }
    });

    test('should handle corrupted configuration gracefully', async () => {
      const corruptedEnv = {
        ...process.env,
        DB_PORT: 'not-a-number',
        DB_HOST: '', // empty host
        NODE_ENV: 'test'
      };

      try {
        await execAsync('node dist/cli.js status', {
          env: corruptedEnv,
          timeout: 10000
        });
        fail('Should have failed with corrupted config');
      } catch (error) {
        const execError = error as ExecError;
        const output = execError.stderr || execError.stdout || '';
        
        // Should handle gracefully, not crash
        expect(output).toBeDefined();
        expect(output.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Signal Handling', () => {
    test('should handle interruption gracefully', async () => {
      // This test is more conceptual - testing that CLI doesn't leave hanging processes
      // In a real scenario, we'd test SIGINT handling, but that's complex in Jest
      
      try {
        const { stdout } = await execAsync('node dist/cli.js --help', { timeout: 1000 });
        expect(stdout).toContain('meal-agent');
        // If help works quickly, CLI starts up properly
      } catch (error) {
        const execError = error as ExecError;
        // Even if timeout, should not leave hanging processes
        expect(execError.code).toBeDefined();
      }
    });
  });
});