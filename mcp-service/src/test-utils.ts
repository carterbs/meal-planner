import { beforeEach, afterEach } from '@jest/globals';

interface MockServer {
  close: () => Promise<void>;
}

let mockServer: MockServer | null = null;

export function setupMockServer(server: MockServer): void {
  (beforeEach as (fn: () => void) => void)((): void => {
    mockServer = server;
  });

  (afterEach as (fn: () => Promise<void>) => void)(async (): Promise<void> => {
    if (mockServer) {
      await mockServer.close();
      mockServer = null;
    }
  });
}