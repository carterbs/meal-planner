#!/usr/bin/env node

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { LangGraphAgent } from './langgraph-agent';
import { debugLog } from './logging';
import { getBackendClient } from './utils/getBackendClient';
import { WorkflowType, MealPlanningState } from './shared/types';
import {
    PlanStartRequest,
    PlanStartResponse,
    PlanFeedbackRequest,
    PlanFeedbackResponse,
    PlanFinalizeRequest,
    PlanFinalizeResponse,
    ResumeWorkflowRequest,
    ResumeWorkflowResponse
} from '@mealplanner/generated/agent_pb';

// Initialize agent instance
let agentInstance: LangGraphAgent | null = null;

async function initializeAgent(): Promise<LangGraphAgent> {
    if (!agentInstance) {
        agentInstance = new LangGraphAgent({
            defaultParticipants: ['brad', 'shannon'],
        });
        await agentInstance.initialize();
    }
    return agentInstance;
}

function validateThreadId(threadId: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(threadId);
}

// Plan Start implementation
function planStart(call: grpc.ServerUnaryCall<PlanStartRequest, PlanStartResponse>, callback: grpc.sendUnaryData<PlanStartResponse>): void {
    (async () => {
        try {
            const request = call.request;
            const participants = request.participants || [];

            if (participants.length === 0) {
                return callback(new Error('At least one participant is required.'));
            }

            const agentInstance = await initializeAgent();
            debugLog(`🔄 Starting meal planning session for participants: ${participants.join(', ')}`);

            const threadId = await agentInstance.startWorkflow(WorkflowType.MEAL_PLANNING, participants);
            debugLog(`🔄 Got a threadId: ${threadId}`);

            let initialState: MealPlanningState;
            try {
                initialState = await agentInstance.getWorkflowState(threadId);
            } catch (e) {
                debugLog(`Failed to fetch initial workflow state: ${e}`);
                return callback(e as Error);
            }
            const response = new PlanStartResponse({
                success: true,
                message: 'Meal planning session started',
                threadId: threadId,
                currentStep: initialState.currentStep,
                initialState: new TextEncoder().encode(initialState.toJsonString()),
            });

            callback(null, response);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            debugLog(`Error starting meal planning session: ${errMsg}`);
            callback(new Error(`Error starting meal planning session: ${errMsg}`));
        }
    })();
}

// Plan Feedback implementation
function planFeedback(call: grpc.ServerUnaryCall<PlanFeedbackRequest, PlanFeedbackResponse>, callback: grpc.sendUnaryData<PlanFeedbackResponse>): void {
    (async () => {
        try {
            const request = call.request;
            const threadId = request.threadId || '';
            const message = request.message || '';
            const from = request.from || '';

            if (!validateThreadId(threadId)) {
                return callback(new Error('Invalid thread ID format. Expected UUID format.'));
            }

            const agentInstance = await initializeAgent();

            // Check if workflow is awaiting feedback
            debugLog(`Checking if workflow ${threadId} is awaiting feedback...`);
            const isAwaiting = await agentInstance.isAwaitingFeedback(threadId);
            debugLog(`isAwaitingFeedback returned: ${isAwaiting}`);

            if (!isAwaiting) {
                return callback(new Error('This workflow is not currently awaiting feedback.'));
            }

            // Add message using the http client
            const client = getBackendClient();
            await client.addMessage({
                threadId: threadId,
                message,
                sender: from,
            });

            const response = new PlanFeedbackResponse({
                success: true,
                message: `Feedback added successfully from ${from}`,
            });

            callback(null, response);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            debugLog(`Error adding feedback: ${errMsg}`);
            callback(new Error(`Error adding feedback: ${errMsg}`));
        }
    })();
}

// Plan Finalize implementation
function planFinalize(call: grpc.ServerUnaryCall<PlanFinalizeRequest, PlanFinalizeResponse>, callback: grpc.sendUnaryData<PlanFinalizeResponse>): void {
    (async () => {
        try {
            const request = call.request;
            const threadId = request.threadId || '';

            if (!validateThreadId(threadId)) {
                return callback(new Error('Invalid thread ID format. Expected UUID format.'));
            }

            const agentInstance = await initializeAgent();
            debugLog('🔄 Finalizing meal plan and generating shopping list...');

            const result = await agentInstance.resumeWorkflow(threadId, {
                action: 'finalize',
            });

            if (result.success) {
                debugLog('✅ Meal plan finalized successfully!');

                // Get and display the final meal plan
                let finalState: MealPlanningState;
                try {
                    finalState = await agentInstance.getWorkflowState(threadId);
                } catch (stateError) {
                    debugLog('⚠️ Could not retrieve final state details');
                    return callback(stateError as Error);
                }

                const response = new PlanFinalizeResponse({
                    success: true,
                    message: 'Meal plan finalized successfully',
                    finalState: finalState.toBinary(),
                });

                callback(null, response);
            } else {
                callback(new Error(`Failed to finalize meal plan: ${result.message}`));
            }
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            debugLog(`Error finalizing meal plan: ${errMsg}`);
            callback(new Error(`Error finalizing meal plan: ${errMsg}`));
        }
    })();
}

// Resume Workflow implementation
function resumeWorkflow(call: grpc.ServerUnaryCall<ResumeWorkflowRequest, ResumeWorkflowResponse>, callback: grpc.sendUnaryData<ResumeWorkflowResponse>): void {
    (async () => {
        try {
            const request = call.request;
            const threadId = request.threadId || '';
            const inputMap = request.input || {};

            if (!validateThreadId(threadId)) {
                return callback(new Error('Invalid thread ID format. Expected UUID format.'));
            }

            const agentInstance = await initializeAgent();
            debugLog(`🔄 Resuming workflow ${threadId}...`);

            // Convert map<string, string> to Record<string, string>
            const inputObj: Record<string, string> = {};
            for (const [key, value] of Object.entries(inputMap)) {
                inputObj[key] = value;
            }

            const result = await agentInstance.resumeWorkflow(threadId, inputObj);

            if (result.success) {
                debugLog('✅ Workflow resumed successfully!');

                // Get current state
                let currentState: MealPlanningState;
                try {
                    currentState = await agentInstance.getWorkflowState(threadId);
                } catch (stateError) {
                    debugLog('⚠️ Could not retrieve current state details');
                    return callback(stateError as Error);
                }

                const response = new ResumeWorkflowResponse({
                    success: true,
                    message: result.message || 'Workflow resumed successfully',
                    currentStep: result.currentStep || '',
                    state: currentState.toBinary(),
                });

                callback(null, response);
            } else {
                callback(new Error(`Failed to resume workflow: ${result.message}`));
            }
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            debugLog(`Error resuming workflow: ${errMsg}`);
            callback(new Error(`Error resuming workflow: ${errMsg}`));
        }
    })();
}

// Load the protobuf definition
const PROTO_PATH = path.join(__dirname, '../../proto/agent.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

interface ProtoGrpcType {
    agent: {
        AgentService: {
            service: grpc.ServiceDefinition;
        };
    };
}

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;
const agentProto = protoDescriptor.agent;

// Start the gRPC server
function startServer(): void {
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
    const port = process.env.AGENT_SERVICE_PORT || '50053';

    // Add the service implementation
    server.addService(agentProto.AgentService.service, {
        planStart,
        planFeedback,
        planFinalize,
        resumeWorkflow,
    });

    // Bind and start the server
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            debugLog(`Failed to start server: ${err.message}`);
            return;
        }
        debugLog(`🚀 Agent service started on port ${port}`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        debugLog('Shutting down agent service...');
        server.tryShutdown((err) => {
            if (err) {
                debugLog(`Error during shutdown: ${err.message}`);
                server.forceShutdown();
            }
            process.exit(0);
        });
    });
}

// Start the server
startServer(); 