import type { BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage } from "@bufbuild/protobuf";
import { Message, proto3 } from "@bufbuild/protobuf";
/**
 * Plan Start
 *
 * @generated from message agent.PlanStartRequest
 */
export declare class PlanStartRequest extends Message<PlanStartRequest> {
    /**
     * @generated from field: repeated string participants = 1;
     */
    participants: string[];
    constructor(data?: PartialMessage<PlanStartRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "agent.PlanStartRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): PlanStartRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): PlanStartRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): PlanStartRequest;
    static equals(a: PlanStartRequest | PlainMessage<PlanStartRequest> | undefined, b: PlanStartRequest | PlainMessage<PlanStartRequest> | undefined): boolean;
}
/**
 * @generated from message agent.PlanStartResponse
 */
export declare class PlanStartResponse extends Message<PlanStartResponse> {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
    /**
     * @generated from field: string thread_id = 3;
     */
    threadId: string;
    /**
     * @generated from field: string current_step = 4;
     */
    currentStep: string;
    /**
     * JSON-encoded state
     *
     * @generated from field: bytes initial_state = 5;
     */
    initialState: Uint8Array<ArrayBuffer>;
    constructor(data?: PartialMessage<PlanStartResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "agent.PlanStartResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): PlanStartResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): PlanStartResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): PlanStartResponse;
    static equals(a: PlanStartResponse | PlainMessage<PlanStartResponse> | undefined, b: PlanStartResponse | PlainMessage<PlanStartResponse> | undefined): boolean;
}
/**
 * Plan Feedback
 *
 * @generated from message agent.PlanFeedbackRequest
 */
export declare class PlanFeedbackRequest extends Message<PlanFeedbackRequest> {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
    /**
     * @generated from field: string from = 3;
     */
    from: string;
    constructor(data?: PartialMessage<PlanFeedbackRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "agent.PlanFeedbackRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): PlanFeedbackRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): PlanFeedbackRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): PlanFeedbackRequest;
    static equals(a: PlanFeedbackRequest | PlainMessage<PlanFeedbackRequest> | undefined, b: PlanFeedbackRequest | PlainMessage<PlanFeedbackRequest> | undefined): boolean;
}
/**
 * @generated from message agent.PlanFeedbackResponse
 */
export declare class PlanFeedbackResponse extends Message<PlanFeedbackResponse> {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
    constructor(data?: PartialMessage<PlanFeedbackResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "agent.PlanFeedbackResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): PlanFeedbackResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): PlanFeedbackResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): PlanFeedbackResponse;
    static equals(a: PlanFeedbackResponse | PlainMessage<PlanFeedbackResponse> | undefined, b: PlanFeedbackResponse | PlainMessage<PlanFeedbackResponse> | undefined): boolean;
}
/**
 * Plan Finalize
 *
 * @generated from message agent.PlanFinalizeRequest
 */
export declare class PlanFinalizeRequest extends Message<PlanFinalizeRequest> {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    constructor(data?: PartialMessage<PlanFinalizeRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "agent.PlanFinalizeRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): PlanFinalizeRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): PlanFinalizeRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): PlanFinalizeRequest;
    static equals(a: PlanFinalizeRequest | PlainMessage<PlanFinalizeRequest> | undefined, b: PlanFinalizeRequest | PlainMessage<PlanFinalizeRequest> | undefined): boolean;
}
/**
 * @generated from message agent.PlanFinalizeResponse
 */
export declare class PlanFinalizeResponse extends Message<PlanFinalizeResponse> {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
    /**
     * JSON-encoded state
     *
     * @generated from field: bytes final_state = 3;
     */
    finalState: Uint8Array<ArrayBuffer>;
    constructor(data?: PartialMessage<PlanFinalizeResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "agent.PlanFinalizeResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): PlanFinalizeResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): PlanFinalizeResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): PlanFinalizeResponse;
    static equals(a: PlanFinalizeResponse | PlainMessage<PlanFinalizeResponse> | undefined, b: PlanFinalizeResponse | PlainMessage<PlanFinalizeResponse> | undefined): boolean;
}
/**
 * Resume Workflow
 *
 * @generated from message agent.ResumeWorkflowRequest
 */
export declare class ResumeWorkflowRequest extends Message<ResumeWorkflowRequest> {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * Additional input parameters
     *
     * @generated from field: map<string, string> input = 2;
     */
    input: {
        [key: string]: string;
    };
    constructor(data?: PartialMessage<ResumeWorkflowRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "agent.ResumeWorkflowRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ResumeWorkflowRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ResumeWorkflowRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ResumeWorkflowRequest;
    static equals(a: ResumeWorkflowRequest | PlainMessage<ResumeWorkflowRequest> | undefined, b: ResumeWorkflowRequest | PlainMessage<ResumeWorkflowRequest> | undefined): boolean;
}
/**
 * @generated from message agent.ResumeWorkflowResponse
 */
export declare class ResumeWorkflowResponse extends Message<ResumeWorkflowResponse> {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
    /**
     * @generated from field: string current_step = 3;
     */
    currentStep: string;
    /**
     * JSON-encoded state
     *
     * @generated from field: bytes state = 4;
     */
    state: Uint8Array<ArrayBuffer>;
    constructor(data?: PartialMessage<ResumeWorkflowResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "agent.ResumeWorkflowResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ResumeWorkflowResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ResumeWorkflowResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ResumeWorkflowResponse;
    static equals(a: ResumeWorkflowResponse | PlainMessage<ResumeWorkflowResponse> | undefined, b: ResumeWorkflowResponse | PlainMessage<ResumeWorkflowResponse> | undefined): boolean;
}
