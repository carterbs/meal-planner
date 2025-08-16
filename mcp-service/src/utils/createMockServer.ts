// Helper function to create properly typed mock server
type MockMcpServer = {
    resource: jest.Mock;
};
export function createMockServer(): MockMcpServer {
    return {
        resource: jest.fn()
    } as MockMcpServer;
}
