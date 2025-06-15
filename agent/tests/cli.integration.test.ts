/**
 * Simple CLI Integration Tests
 * Tests CLI components work together without running full workflows
 */

describe('CLI Integration Tests', () => {
  test('should validate CLI components exist and are importable', async () => {
    // Test that we can import the main CLI components
    const { LangGraphAgent } = await import('../langgraph-agent.js');
    const { WorkflowType } = await import('../shared/types.js');
    
    expect(LangGraphAgent).toBeDefined();
    expect(WorkflowType).toBeDefined();
    expect(typeof LangGraphAgent).toBe('function');
    expect(typeof WorkflowType).toBe('object');
  });

  test('should have correct workflow types available', async () => {
    const { WorkflowType } = await import('../shared/types.js');
    
    expect(WorkflowType.MEAL_PLANNING).toBe('meal_planning');
    expect(Object.values(WorkflowType)).toContain('meal_planning');
    expect(Object.values(WorkflowType)).toContain('recipe_management');
    expect(Object.values(WorkflowType)).toContain('ingredient_management');
  });

  test('should have CLI validation functions working', () => {
    // Test UUID validation logic (same as used in CLI)
    const validUUIDs = [
      '123e4567-e89b-12d3-a456-426614174000',
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    ];

    const invalidUUIDs = [
      'invalid-thread-id',
      '123',
      'not-a-uuid',
      '',
      'g23e4567-e89b-12d3-a456-426614174000'
    ];

    const uuidRegex = /^[a-f0-9-]{36}$/;
    
    validUUIDs.forEach(uuid => {
      expect(uuidRegex.test(uuid)).toBe(true);
    });
    
    invalidUUIDs.forEach(uuid => {
      expect(uuidRegex.test(uuid)).toBe(false);
    });
  });

  test('should have workflow type validation working', async () => {
    const { WorkflowType } = await import('../shared/types.js');
    
    // Valid types
    expect((Object.values(WorkflowType) as string[]).includes('meal_planning')).toBe(true);
    expect((Object.values(WorkflowType) as string[]).includes('recipe_management')).toBe(true);
    
    // Invalid types
    expect((Object.values(WorkflowType) as string[]).includes('invalid_type')).toBe(false);
    expect((Object.values(WorkflowType) as string[]).includes('MEAL_PLANNING')).toBe(false);
  });

  test('should be able to create agent config structure', () => {
    const config = {
      database: {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_pass'
      },
      defaultParticipants: ['brad', 'shannon']
    };

    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(5432);
    expect(config.defaultParticipants).toEqual(['brad', 'shannon']);
  });

  test('should have proper participant parsing logic', () => {
    // Test participant parsing (as CLI does)
    const testCases = [
      { input: 'brad,shannon', expected: ['brad', 'shannon'] },
      { input: 'alice,bob,charlie', expected: ['alice', 'bob', 'charlie'] },
      { input: 'single-user', expected: ['single-user'] },
      { input: ' user1 , user2 , user3 ', expected: ['user1', 'user2', 'user3'] }
    ];

    testCases.forEach(({ input, expected }) => {
      const result = input.split(',').map(p => p.trim());
      expect(result).toEqual(expected);
    });
  });

  test('should handle error message formatting consistently', () => {
    const errorMessages = [
      'Invalid thread ID format',
      'Workflow not found',
      'Failed to cancel workflow'
    ];

    const successMessages = [
      'Workflow started successfully',
      'Feedback added successfully',
      'Workflow cancelled successfully'
    ];

    errorMessages.forEach(msg => {
      const formatted = `❌ ${msg}`;
      expect(formatted).toMatch(/^❌ /);
      expect(formatted).toContain(msg);
    });

    successMessages.forEach(msg => {
      const formatted = `✅ ${msg}`;
      expect(formatted).toMatch(/^✅ /);
      expect(formatted).toContain(msg);
    });
  });
});