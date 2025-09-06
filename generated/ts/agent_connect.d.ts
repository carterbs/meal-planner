import { Empty, MethodKind } from "@bufbuild/protobuf";
import { AbandonWorkflowRequest, AbandonWorkflowResponse, AddMessageRequest, AddMessageResponse, CancelWorkflowRequest, CancelWorkflowResponse, GetCheckpointRequest, GetCheckpointResponse, GetMessagesRequest, GetMessagesResponse, GetWorkflowStateRequest, GetWorkflowStateResponse, GetWorkflowStatusRequest, GetWorkflowStatusResponse, HealthCheckResponse, ListCheckpointsRequest, ListCheckpointsResponse, ListWorkflowsResponse, MessageAgentRequest, MessageAgentResponse, PutCheckpointRequest, PutCheckpointResponse, StartAgentWorkflowRequest, StartAgentWorkflowResponse } from "./api_pb.js";
import { PlanFeedbackRequest, PlanFeedbackResponse, PlanFinalizeRequest, PlanFinalizeResponse, PlanStartRequest, PlanStartResponse, ResumeWorkflowRequest, ResumeWorkflowResponse } from "./agent_pb.js";
/**
 * Agent Service - provides gRPC endpoints for all CLI commands
 *
 * @generated from service agent.AgentService
 */
export declare const AgentService: {
    readonly typeName: "agent.AgentService";
    readonly methods: {
        /**
         * Health check endpoint
         *
         * @generated from rpc agent.AgentService.HealthCheck
         */
        readonly healthCheck: {
            readonly name: "HealthCheck";
            readonly I: typeof Empty;
            readonly O: typeof HealthCheckResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * Plan commands
         *
         * @generated from rpc agent.AgentService.PlanStart
         */
        readonly planStart: {
            readonly name: "PlanStart";
            readonly I: typeof PlanStartRequest;
            readonly O: typeof PlanStartResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc agent.AgentService.PlanFeedback
         */
        readonly planFeedback: {
            readonly name: "PlanFeedback";
            readonly I: typeof PlanFeedbackRequest;
            readonly O: typeof PlanFeedbackResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc agent.AgentService.PlanFinalize
         */
        readonly planFinalize: {
            readonly name: "PlanFinalize";
            readonly I: typeof PlanFinalizeRequest;
            readonly O: typeof PlanFinalizeResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * Workflow management
         *
         * @generated from rpc agent.AgentService.ResumeWorkflow
         */
        readonly resumeWorkflow: {
            readonly name: "ResumeWorkflow";
            readonly I: typeof ResumeWorkflowRequest;
            readonly O: typeof ResumeWorkflowResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * High level workflow endpoints for API gateway
         *
         * @generated from rpc agent.AgentService.StartAgentWorkflow
         */
        readonly startAgentWorkflow: {
            readonly name: "StartAgentWorkflow";
            readonly I: typeof StartAgentWorkflowRequest;
            readonly O: typeof StartAgentWorkflowResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc agent.AgentService.MessageAgent
         */
        readonly messageAgent: {
            readonly name: "MessageAgent";
            readonly I: typeof MessageAgentRequest;
            readonly O: typeof MessageAgentResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * Workflow management endpoints
         *
         * @generated from rpc agent.AgentService.GetWorkflowStatus
         */
        readonly getWorkflowStatus: {
            readonly name: "GetWorkflowStatus";
            readonly I: typeof GetWorkflowStatusRequest;
            readonly O: typeof GetWorkflowStatusResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc agent.AgentService.ListWorkflows
         */
        readonly listWorkflows: {
            readonly name: "ListWorkflows";
            readonly I: typeof Empty;
            readonly O: typeof ListWorkflowsResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc agent.AgentService.CancelWorkflow
         */
        readonly cancelWorkflow: {
            readonly name: "CancelWorkflow";
            readonly I: typeof CancelWorkflowRequest;
            readonly O: typeof CancelWorkflowResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc agent.AgentService.GetWorkflowState
         */
        readonly getWorkflowState: {
            readonly name: "GetWorkflowState";
            readonly I: typeof GetWorkflowStateRequest;
            readonly O: typeof GetWorkflowStateResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc agent.AgentService.AbandonWorkflow
         */
        readonly abandonWorkflow: {
            readonly name: "AbandonWorkflow";
            readonly I: typeof AbandonWorkflowRequest;
            readonly O: typeof AbandonWorkflowResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * Message management endpoints
         *
         * @generated from rpc agent.AgentService.GetMessages
         */
        readonly getMessages: {
            readonly name: "GetMessages";
            readonly I: typeof GetMessagesRequest;
            readonly O: typeof GetMessagesResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc agent.AgentService.AddMessage
         */
        readonly addMessage: {
            readonly name: "AddMessage";
            readonly I: typeof AddMessageRequest;
            readonly O: typeof AddMessageResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * Checkpoint management endpoints
         *
         * @generated from rpc agent.AgentService.GetCheckpoint
         */
        readonly getCheckpoint: {
            readonly name: "GetCheckpoint";
            readonly I: typeof GetCheckpointRequest;
            readonly O: typeof GetCheckpointResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc agent.AgentService.PutCheckpoint
         */
        readonly putCheckpoint: {
            readonly name: "PutCheckpoint";
            readonly I: typeof PutCheckpointRequest;
            readonly O: typeof PutCheckpointResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc agent.AgentService.ListCheckpoints
         */
        readonly listCheckpoints: {
            readonly name: "ListCheckpoints";
            readonly I: typeof ListCheckpointsRequest;
            readonly O: typeof ListCheckpointsResponse;
            readonly kind: MethodKind.Unary;
        };
    };
};
