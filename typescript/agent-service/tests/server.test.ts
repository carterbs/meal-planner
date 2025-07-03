import { describe, it, expect } from '@jest/globals';
import '../server.js';

describe('agent service server', () => {
  it('should load without crashing', () => {
    expect(true).toBe(true);
  });
});
