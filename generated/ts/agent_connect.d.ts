import { PlanFeedbackRequest, PlanFeedbackResponse, PlanFinalizeRequest, PlanFinalizeResponse, PlanStartRequest, PlanStartResponse, ResumeWorkflowRequest, ResumeWorkflowResponse } from "./agent_pb.js";
import { MethodKind } from "@bufbuild/protobuf";
/**
 * Agent Service - provides gRPC endpoints for all CLI commands
 *
 * @generated from service agent.AgentService
 */
export declare const AgentService: {
    readonly typeName: "agent.AgentService";
    readonly methods: {
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
    };
};
