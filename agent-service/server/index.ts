import * as grpc from '@grpc/grpc-js';
import { debugLog } from '../logging';
import { registerServices } from './wiring';

export function startServer(): void {
    const server = new grpc.Server({
        'grpc.keepalive_time_ms': 30000,
        'grpc.keepalive_timeout_ms': 5000,
        'grpc.keepalive_permit_without_calls': 1,
        'grpc.http2.max_pings_without_data': 0,
        'grpc.http2.min_time_between_pings_ms': 10000,
        'grpc.http2.min_ping_interval_without_data_ms': 300000,
        'grpc.max_receive_message_length': 4 * 1024 * 1024,
        'grpc.max_send_message_length': 4 * 1024 * 1024,
    });
    registerServices(server);
    const port = process.env.AGENT_SERVICE_PORT || '50053';
    server.bindAsync(
        `0.0.0.0:${port}`,
        grpc.ServerCredentials.createInsecure(),
        async (err, boundPort) => {
            if (err) {
                await debugLog(`Failed to start server: ${err.message}`);
                return;
            }
            await debugLog(`🚀 Agent service started on port ${boundPort}`);
        },
    );

    const shutdown = async () => {
        await debugLog('Shutting down agent service...');
        server.tryShutdown((err) => {
            if (err) {
                server.forceShutdown();
            }
            process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

if (require.main === module) {
    startServer();
}


