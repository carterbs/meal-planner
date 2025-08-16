import fetchMock from 'jest-fetch-mock';

/**
 * Helper to configure jest-fetch-mock with a sequence of responses.
 * Each response is the raw body object (which will be JSON.stringified) or
 * a Response-like error indicated by passing an empty body and status.
 */
export function setupFetchMock(...responses: Array<{ body?: any; status?: number; statusText?: string; reject?: Error }>) {
  fetchMock.enableMocks();
  fetchMock.resetMocks();
  for (const resp of responses) {
    if (resp.reject) {
      fetchMock.mockRejectedValueOnce(resp.reject);
    } else {
      const body = resp.body === undefined ? '' : JSON.stringify(resp.body);
      fetchMock.mockResponseOnce(body, { status: resp.status ?? 200, statusText: resp.statusText ?? 'OK' });
    }
  }
  return fetchMock;
}