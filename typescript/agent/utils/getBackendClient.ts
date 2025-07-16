import { createClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { MealPlannerAPI } from "@mealplanner/generated";

let client: ReturnType<typeof createClient<typeof MealPlannerAPI>> | null = null;

export function getBackendClient() {
    if (client) {
        return client;
    }
    const baseUrl: string = process.env.BACKEND_GRPC_URL || 'http://localhost:50051';

    const transport = createGrpcTransport({
        baseUrl: baseUrl,
        httpVersion: '2',
    });
    client = createClient(MealPlannerAPI, transport);
    return client;
}