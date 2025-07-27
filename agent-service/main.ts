#!/usr/bin/env node
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { LangGraphAgent } from './langgraph-agent';
import { debugLog } from './logging';
import { MessageRepository } from './database/messages';
import { CheckpointRepository } from './database/checkpoints';
import { WorkflowType, MealPlanningState } from './shared/types';
import {
  PlanStartRequest,
  PlanStartResponse,
  PlanFeedbackRequest,
  PlanFeedbackResponse,
  PlanFinalizeRequest,
  PlanFinalizeResponse,
  ResumeWorkflowRequest,
  ResumeWorkflowResponse,
} from '@mealplanner/generated/agent_pb';
import * as apipb from '@mealplanner/generated/api_pb';
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
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(threadId);
}
// Plan Start implementation
function planStart(
  call: grpc.ServerUnaryCall<PlanStartRequest, PlanStartResponse>,
  callback: grpc.sendUnaryData<PlanStartResponse>,
): void {
  (async () => {
    try {
      const request = call.request;
      const participants = request.participants || [];
      if (participants.length === 0) {
        return callback(new Error('At least one participant is required.'));
      }
      const agentInstance = await initializeAgent();
      await debugLog(
        `🔄 Starting meal planning session for participants: ${participants.join(', ')}`,
      );
      const threadId = await agentInstance.startWorkflow(
        WorkflowType.MEAL_PLANNING,
        participants,
      );
      await debugLog(`🔄 Got a threadId: ${threadId}`);
      let initialState: MealPlanningState;
      try {
        initialState = await agentInstance.getWorkflowState(threadId);
      } catch (e) {
        await debugLog(`Failed to fetch initial workflow state: ${e}`);
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
      await debugLog(`Error starting meal planning session: ${errMsg}`);
      callback(new Error(`Error starting meal planning session: ${errMsg}`));
    }
  })();
}
// Plan Feedback implementation
function planFeedback(
  call: grpc.ServerUnaryCall<PlanFeedbackRequest, PlanFeedbackResponse>,
  callback: grpc.sendUnaryData<PlanFeedbackResponse>,
): void {
  (async () => {
    try {
      const request = call.request;
      const threadId = request.threadId || '';
      const message = request.message || '';
      const from = request.from || '';
      if (!validateThreadId(threadId)) {
        return callback(
          new Error('Invalid thread ID format. Expected UUID format.'),
        );
      }
      const agentInstance = await initializeAgent();
      // Check if workflow is awaiting feedback
      await debugLog(
        `Checking if workflow ${threadId} is awaiting feedback...`,
      );
      const isAwaiting = await agentInstance.isAwaitingFeedback(threadId);
      await debugLog(`isAwaitingFeedback returned: ${isAwaiting}`);
      if (!isAwaiting) {
        return callback(
          new Error('This workflow is not currently awaiting feedback.'),
        );
      }
      // Add message directly to database
      const messageRepo = new MessageRepository();
      await messageRepo.addMessage(threadId, from, message);
      const response = new PlanFeedbackResponse({
        success: true,
        message: `Feedback added successfully from ${from}`,
      });
      callback(null, response);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await debugLog(`Error adding feedback: ${errMsg}`);
      callback(new Error(`Error adding feedback: ${errMsg}`));
    }
  })();
}
// Plan Finalize implementation
function planFinalize(
  call: grpc.ServerUnaryCall<PlanFinalizeRequest, PlanFinalizeResponse>,
  callback: grpc.sendUnaryData<PlanFinalizeResponse>,
): void {
  (async () => {
    try {
      const request = call.request;
      const threadId = request.threadId || '';
      if (!validateThreadId(threadId)) {
        return callback(
          new Error('Invalid thread ID format. Expected UUID format.'),
        );
      }
      const agentInstance = await initializeAgent();
      await debugLog('🔄 Finalizing meal plan and generating shopping list...');
      const result = await agentInstance.resumeWorkflow(threadId, {
        action: 'finalize',
      });
      if (result.success) {
        await debugLog('✅ Meal plan finalized successfully!');
        // Get and display the final meal plan
        let finalState: MealPlanningState;
        try {
          finalState = await agentInstance.getWorkflowState(threadId);
        } catch (stateError) {
          await debugLog('⚠️ Could not retrieve final state details');
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
      await debugLog(`Error finalizing meal plan: ${errMsg}`);
      callback(new Error(`Error finalizing meal plan: ${errMsg}`));
    }
  })();
}
// Resume Workflow implementation
function resumeWorkflow(
  call: grpc.ServerUnaryCall<ResumeWorkflowRequest, ResumeWorkflowResponse>,
  callback: grpc.sendUnaryData<ResumeWorkflowResponse>,
): void {
  (async () => {
    try {
      const request = call.request;
      const threadId = request.threadId || '';
      const inputMap = request.input || {};
      if (!validateThreadId(threadId)) {
        return callback(
          new Error('Invalid thread ID format. Expected UUID format.'),
        );
      }
      const agentInstance = await initializeAgent();
      await debugLog(`🔄 Resuming workflow ${threadId}...`);
      // Convert map<string, string> to Record<string, string>
      const inputObj: Record<string, string> = {};
      for (const [key, value] of Object.entries(inputMap)) {
        inputObj[key] = value;
      }
      const result = await agentInstance.resumeWorkflow(threadId, inputObj);
      if (result.success) {
        await debugLog('✅ Workflow resumed successfully!');
        // Get current state
        let currentState: MealPlanningState;
        try {
          currentState = await agentInstance.getWorkflowState(threadId);
        } catch (stateError) {
          await debugLog('⚠️ Could not retrieve current state details');
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
      await debugLog(`Error resuming workflow: ${errMsg}`);
      callback(new Error(`Error resuming workflow: ${errMsg}`));
    }
  })();
}
// StartAgentWorkflow implementation - wraps PlanStart for API gateway
function startAgentWorkflow(
  call: grpc.ServerUnaryCall<
    apipb.StartAgentWorkflowRequest,
    apipb.StartAgentWorkflowResponse
  >,
  callback: grpc.sendUnaryData<apipb.StartAgentWorkflowResponse>,
): void {
  (async () => {
    try {
      const request = call.request.request;
      if (!request) {
        return callback(new Error('request is required'));
      }
      if (!request.participants || request.participants.length === 0) {
        return callback(new Error('participants required'));
      }
      const agent = await initializeAgent();
      const threadId = await agent.startWorkflow(
        WorkflowType.MEAL_PLANNING,
        request.participants,
      );
      const state = await agent.getWorkflowState(threadId);
      const resp = new apipb.AgentResponse({
        success: true,
        message: 'Workflow started',
        threadId,
        currentStep: state.currentStep,
        initialState: state.toJsonString(),
      });
      callback(null, new apipb.StartAgentWorkflowResponse({ response: resp }));
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      callback(new Error(`Error starting workflow: ${errMsg}`));
    }
  })();
}
// MessageAgent implementation - wraps PlanFeedback and ResumeWorkflow
function messageAgent(
  call: grpc.ServerUnaryCall<
    apipb.MessageAgentRequest,
    apipb.MessageAgentResponse
  >,
  callback: grpc.sendUnaryData<apipb.MessageAgentResponse>,
): void {
  (async () => {
    try {
      const request = call.request.request;
      if (!request) {
        return callback(new Error('request is required'));
      }
      const { threadId, message, from } = request;
      if (!threadId) return callback(new Error('threadId required'));
      if (!message) return callback(new Error('message required'));
      if (!from) return callback(new Error('from required'));
      const agent = await initializeAgent();
      const repo = new MessageRepository();
      await repo.addMessage(threadId, from, message);
      const result = await agent.resumeWorkflow(threadId, {});
      const resp = new apipb.AgentResponse({
        success: result.success,
        message: result.message || '',
        threadId,
        currentStep: result.currentStep || '',
      });
      callback(null, new apipb.MessageAgentResponse({ response: resp }));
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      callback(new Error(`Error messaging agent: ${errMsg}`));
    }
  })();
}
// Workflow Management Methods
function getWorkflowStatus(
  call: grpc.ServerUnaryCall<
    apipb.GetWorkflowStatusRequest,
    apipb.GetWorkflowStatusResponse
  >,
  callback: grpc.sendUnaryData<apipb.GetWorkflowStatusResponse>,
): void {
  (async () => {
    try {
      const { threadId } = call.request;
      if (!threadId) return callback(new Error('threadId required'));
      const agent = await initializeAgent();
      const state = await agent.getWorkflowState(threadId);
      const status = new apipb.WorkflowStatus({
        threadId,
        workflowType: 'meal_planning',
        currentStep: state.currentStep,
        participants: state.participants,
      });
      callback(null, new apipb.GetWorkflowStatusResponse({ status }));
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      callback(new Error(`Error getting workflow status: ${errMsg}`));
    }
  })();
}
function listWorkflows(
  _call: grpc.ServerUnaryCall<any, apipb.ListWorkflowsResponse>,
  callback: grpc.sendUnaryData<apipb.ListWorkflowsResponse>,
): void {
  (async () => {
    try {
      const checkpointRepo = new CheckpointRepository();
      const workflows = await checkpointRepo.listWorkflows(50); // Default limit of 50
      const pbWorkflows = workflows.map(
        (wf) =>
          new apipb.WorkflowStatus({
            threadId: wf.thread_id,
            workflowType: wf.workflow_type,
            currentStep: wf.current_step,
            participants: wf.participants,
          }),
      );
      callback(
        null,
        new apipb.ListWorkflowsResponse({ workflows: pbWorkflows }),
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      callback(new Error(`Error listing workflows: ${errMsg}`));
    }
  })();
}
function cancelWorkflow(
  call: grpc.ServerUnaryCall<
    apipb.CancelWorkflowRequest,
    apipb.CancelWorkflowResponse
  >,
  callback: grpc.sendUnaryData<apipb.CancelWorkflowResponse>,
): void {
  (async () => {
    try {
      const { threadId } = call.request;
      if (!threadId) return callback(new Error('threadId required'));
      const agent = await initializeAgent();
      const cancelled = await agent.cancelWorkflow(threadId);
      callback(
        null,
        new apipb.CancelWorkflowResponse({
          status: cancelled ? 'CANCELLED' : 'FAILED',
        }),
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      callback(new Error(`Error cancelling workflow: ${errMsg}`));
    }
  })();
}
function getWorkflowState(
  call: grpc.ServerUnaryCall<
    apipb.GetWorkflowStateRequest,
    apipb.GetWorkflowStateResponse
  >,
  callback: grpc.sendUnaryData<apipb.GetWorkflowStateResponse>,
): void {
  (async () => {
    try {
      const { threadId } = call.request;
      if (!threadId) return callback(new Error('threadId required'));
      const agent = await initializeAgent();
      const state = await agent.getWorkflowState(threadId);
      // Get messages for this thread
      const messageRepo = new MessageRepository();
      const messages = await messageRepo.getMessagesForProtobuf(threadId);
      const protoMessages = messages.map(
        (msg) =>
          new apipb.Message({
            threadId: msg.thread_id,
            sender: msg.sender,
            content: msg.content,
            createdAt: msg.created_at,
          }),
      );
      // Convert state to expected format
      const response = new apipb.GetWorkflowStateResponse({
        plan: state.mealPlan || undefined,
        shoppingList: state.shoppingList
          ? new apipb.ShoppingList({ items: state.shoppingList.items })
          : undefined,
        messages: protoMessages,
      });
      callback(null, response);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      callback(new Error(`Error getting workflow state: ${errMsg}`));
    }
  })();
}
function abandonWorkflow(
  call: grpc.ServerUnaryCall<
    apipb.AbandonWorkflowRequest,
    apipb.AbandonWorkflowResponse
  >,
  callback: grpc.sendUnaryData<apipb.AbandonWorkflowResponse>,
): void {
  (async () => {
    try {
      const { threadId } = call.request;
      if (!threadId) return callback(new Error('threadId required'));
      const agent = await initializeAgent();
      const cancelled = await agent.cancelWorkflow(threadId);
      // Add abandonment message to conversation
      const messageRepo = new MessageRepository();
      await messageRepo.addMessage(threadId, 'system', 'ABANDONED');
      callback(
        null,
        new apipb.AbandonWorkflowResponse({
          message: cancelled
            ? 'Workflow abandoned successfully'
            : 'Failed to abandon workflow',
        }),
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      callback(new Error(`Error abandoning workflow: ${errMsg}`));
    }
  })();
}
// Message Management Methods
function getMessages(
  call: grpc.ServerUnaryCall<
    apipb.GetMessagesRequest,
    apipb.GetMessagesResponse
  >,
  callback: grpc.sendUnaryData<apipb.GetMessagesResponse>,
): void {
  (async () => {
    try {
      const { threadId } = call.request;
      if (!threadId) return callback(new Error('threadId required'));
      const repo = new MessageRepository();
      const messages = await repo.getMessagesForProtobuf(threadId);
      const protoMessages = messages.map(
        (msg) =>
          new apipb.Message({
            threadId: msg.thread_id,
            sender: msg.sender,
            content: msg.content,
            createdAt: msg.created_at,
          }),
      );
      callback(
        null,
        new apipb.GetMessagesResponse({ messages: protoMessages }),
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      callback(new Error(`Error getting messages: ${errMsg}`));
    }
  })();
}
function addMessage(
  call: grpc.ServerUnaryCall<apipb.AddMessageRequest, apipb.AddMessageResponse>,
  callback: grpc.sendUnaryData<apipb.AddMessageResponse>,
): void {
  (async () => {
    try {
      const { threadId, sender, message } = call.request;
      if (!threadId) return callback(new Error('threadId required'));
      if (!sender) return callback(new Error('sender required'));
      if (!message) return callback(new Error('message required'));
      const repo = new MessageRepository();
      await repo.addMessage(threadId, sender, message);
      callback(
        null,
        new apipb.AddMessageResponse({ message: 'Message added successfully' }),
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      callback(new Error(`Error adding message: ${errMsg}`));
    }
  })();
}
function updateSessionState(
  call: grpc.ServerUnaryCall<
    apipb.UpdateSessionStateRequest,
    apipb.UpdateSessionStateResponse
  >,
  callback: grpc.sendUnaryData<apipb.UpdateSessionStateResponse>,
): void {
  (async () => {
    try {
      const { threadId, mealPlan, shoppingList, currentStep, status } =
        call.request;
      if (!threadId) return callback(new Error('threadId required'));
      // Create state update and store as checkpoint
      const stateUpdate = {
        meal_plan: mealPlan,
        shopping_list: shoppingList,
        current_step: currentStep,
        status: status,
      };
      const checkpointRepo = new CheckpointRepository();
      const data = Buffer.from(JSON.stringify(stateUpdate), 'utf8');
      await checkpointRepo.updateWorkflowCheckpoint(threadId, data);
      callback(
        null,
        new apipb.UpdateSessionStateResponse({
          message: 'Session state updated successfully',
        }),
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      callback(new Error(`Error updating session state: ${errMsg}`));
    }
  })();
}
// Checkpoint Management Methods
function getCheckpoint(
  call: grpc.ServerUnaryCall<
    apipb.GetCheckpointRequest,
    apipb.GetCheckpointResponse
  >,
  callback: grpc.sendUnaryData<apipb.GetCheckpointResponse>,
): void {
  (async () => {
    try {
      const { threadId, checkpointNs } = call.request;
      if (!threadId) return callback(new Error('threadId required'));
      const checkpointRepo = new CheckpointRepository();
      const ns = checkpointNs || 'latest';
      const result = await checkpointRepo.getCheckpoint(threadId, ns);
      if (!result.found || !result.checkpoint) {
        callback(null, new apipb.GetCheckpointResponse({ found: false }));
        return;
      }
      // Parse checkpoint data and convert to protobuf
      try {
        const checkpointData = JSON.parse(result.checkpoint.toString());
        const checkpoint = apipb.AgentCheckpoint.fromJson(checkpointData);
        const metadataData = result.metadata
          ? JSON.parse(result.metadata.toString())
          : {};
        const metadata = apipb.AgentCheckpointMetadata.fromJson(metadataData);
        const tuple = new apipb.CheckpointTuple({
          checkpoint: checkpoint,
          metadata: metadata,
        });
        callback(null, new apipb.GetCheckpointResponse({ tuple, found: true }));
      } catch (parseError) {
        callback(new Error(`Error parsing checkpoint data: ${parseError}`));
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      callback(new Error(`Error getting checkpoint: ${errMsg}`));
    }
  })();
}
function putCheckpoint(
  call: grpc.ServerUnaryCall<
    apipb.PutCheckpointRequest,
    apipb.PutCheckpointResponse
  >,
  callback: grpc.sendUnaryData<apipb.PutCheckpointResponse>,
): void {
  (async () => {
    try {
      const { threadId, checkpoint, metadata, workflowType, checkpointNs } =
        call.request;
      if (!threadId) return callback(new Error('threadId required'));
      if (!checkpoint) return callback(new Error('checkpoint required'));
      const checkpointRepo = new CheckpointRepository();
      const ns = checkpointNs || 'latest';
      const wfType = workflowType || 'meal_planning';
      const meta = metadata || new apipb.AgentCheckpointMetadata({});
      await checkpointRepo.putCheckpoint(
        threadId,
        ns,
        wfType,
        checkpoint,
        meta,
      );
      callback(
        null,
        new apipb.PutCheckpointResponse({
          success: true,
          threadId,
          checkpointNs: ns,
        }),
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      callback(new Error(`Error putting checkpoint: ${errMsg}`));
    }
  })();
}
function listCheckpoints(
  call: grpc.ServerUnaryCall<
    apipb.ListCheckpointsRequest,
    apipb.ListCheckpointsResponse
  >,
  callback: grpc.sendUnaryData<apipb.ListCheckpointsResponse>,
): void {
  (async () => {
    try {
      const { limit, beforeThreadId } = call.request;
      const checkpointRepo = new CheckpointRepository();
      const checkpoints = await checkpointRepo.listCheckpoints(
        limit || 50,
        beforeThreadId || '',
      );
      const pbEntries = checkpoints.map((entry) => {
        let checkpoint: apipb.AgentCheckpoint;
        let metadata: apipb.AgentCheckpointMetadata;
        try {
          const checkpointData = JSON.parse(entry.checkpoint_data.toString());
          checkpoint = apipb.AgentCheckpoint.fromJson(checkpointData);
        } catch {
          checkpoint = new apipb.AgentCheckpoint({});
        }
        try {
          const metadataData = entry.metadata
            ? JSON.parse(entry.metadata.toString())
            : {};
          metadata = apipb.AgentCheckpointMetadata.fromJson(metadataData);
        } catch {
          metadata = new apipb.AgentCheckpointMetadata({});
        }
        return new apipb.CheckpointEntry({
          threadId: entry.thread_id,
          checkpointNs: entry.checkpoint_ns,
          tuple: new apipb.CheckpointTuple({
            checkpoint: checkpoint,
            metadata: metadata,
          }),
        });
      });
      callback(null, new apipb.ListCheckpointsResponse({ entries: pbEntries }));
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      callback(new Error(`Error listing checkpoints: ${errMsg}`));
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
const protoDescriptor = grpc.loadPackageDefinition(
  packageDefinition,
) as unknown as ProtoGrpcType;
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
    startAgentWorkflow,
    messageAgent,
    getWorkflowStatus,
    listWorkflows,
    cancelWorkflow,
    getWorkflowState,
    abandonWorkflow,
    getMessages,
    addMessage,
    updateSessionState,
    getCheckpoint,
    putCheckpoint,
    listCheckpoints,
  });
  // Bind and start the server
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    async (err, port) => {
      if (err) {
        await debugLog(`Failed to start server: ${err.message}`);
        return;
      }
      await debugLog(`🚀 Agent service started on port ${port}`);
    },
  );
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await debugLog('Shutting down agent service...');
    server.tryShutdown(async (err) => {
      if (err) {
        await debugLog(`Error during shutdown: ${err.message}`);
        server.forceShutdown();
      }
      process.exit(0);
    });
  });
}
// Start the server
startServer();
