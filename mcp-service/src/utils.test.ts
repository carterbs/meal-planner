import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { retryFetch, API } from './utils.js';

describe('utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('API constant', () => {
    it('should use environment variable when set', async () => {
      const originalEnv = process.env.BACKEND_BASE_URL;
      process.env.BACKEND_BASE_URL = 'http://custom-backend:9000';
      
      // Re-import to get updated value
      jest.resetModules();
      const { API: updatedAPI } = await import('./utils.js');
      expect(updatedAPI).toBe('http://custom-backend:9000');
      
      process.env.BACKEND_BASE_URL = originalEnv;
    });

    it('should use default value when environment variable not set', () => {
      expect(API).toBe('http://127.0.0.1:8090');
    });
  });

  describe('retryFetch', () => {
    const mockUrl = 'http://test.com/api';

    it('should return response on first successful attempt', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' })
      };
      
      global.fetch = jest.fn().mockResolvedValue(mockResponse);
      console.log = jest.fn();

      const result = await retryFetch(mockUrl);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(mockUrl, {
        signal: expect.any(AbortSignal)
      });
      expect(result).toBe(mockResponse);
      expect(console.log).toHaveBeenCalledWith(`[MCP] Attempting to fetch ${mockUrl} (attempt 1/30)...`);
      expect(console.log).toHaveBeenCalledWith(`[MCP] Successfully fetched ${mockUrl}`);
    });

    it('should retry on non-ok response and eventually succeed', async () => {
      const failResponse = { ok: false, status: 500 };
      const successResponse = { ok: true, status: 200 };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(failResponse)
        .mockResolvedValueOnce(failResponse)
        .mockResolvedValueOnce(successResponse);
      console.log = jest.fn();

      const result = await retryFetch(mockUrl, {}, 5, 10);

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toBe(successResponse);
      expect(console.log).toHaveBeenCalledWith(`[MCP] Fetch failed with status 500 (attempt 1/5)`);
      expect(console.log).toHaveBeenCalledWith(`[MCP] Fetch failed with status 500 (attempt 2/5)`);
    });

    it('should retry on fetch error and eventually succeed', async () => {
      const error = new Error('Network error');
      const successResponse = { ok: true, status: 200 };

      global.fetch = jest.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(successResponse);
      console.log = jest.fn();

      const result = await retryFetch(mockUrl, {}, 5, 10);

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toBe(successResponse);
      expect(console.log).toHaveBeenCalledWith(`[MCP] Fetch error (attempt 1/5): Error: Network error`);
      expect(console.log).toHaveBeenCalledWith(`[MCP] Fetch error (attempt 2/5): Error: Network error`);
    });

    it('should throw error after max retries with non-ok responses', async () => {
      const failResponse = { ok: false, status: 500 };
      global.fetch = jest.fn().mockResolvedValue(failResponse);
      console.log = jest.fn();

      await expect(retryFetch(mockUrl, {}, 3, 10)).rejects.toThrow(
        `Failed to fetch ${mockUrl} after 3 attempts`
      );

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries with fetch errors', async () => {
      const error = new Error('Network error');
      global.fetch = jest.fn().mockRejectedValue(error);
      console.log = jest.fn();

      await expect(retryFetch(mockUrl, {}, 3, 10)).rejects.toThrow(
        `Failed to fetch ${mockUrl} after 3 attempts`
      );

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should pass options to fetch', async () => {
      const mockResponse = { ok: true, status: 200 };
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      };
      
      global.fetch = jest.fn().mockResolvedValue(mockResponse);
      console.log = jest.fn();

      await retryFetch(mockUrl, options);

      expect(global.fetch).toHaveBeenCalledWith(mockUrl, {
        ...options,
        signal: expect.any(AbortSignal)
      });
    });

    it('should use custom retry parameters', async () => {
      const failResponse = { ok: false, status: 500 };
      global.fetch = jest.fn().mockResolvedValue(failResponse);
      console.log = jest.fn();

      await expect(retryFetch(mockUrl, {}, 2, 5)).rejects.toThrow(
        `Failed to fetch ${mockUrl} after 2 attempts`
      );

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout via AbortSignal', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
      console.log = jest.fn();

      await retryFetch(mockUrl);

      expect(global.fetch).toHaveBeenCalledWith(mockUrl, {
        signal: expect.any(AbortSignal)
      });
    });
  });
});