package proto

import (
    context "context"
    grpc "google.golang.org/grpc"
)

// StartWorkflowRequest represents a request to start an agent workflow.
type StartWorkflowRequest struct {
    Participants []string `protobuf:"bytes,1,rep,name=participants,proto3" json:"participants,omitempty"`
}

// WorkflowResponse is returned for workflow operations.
type WorkflowResponse struct {
    Success     bool   `protobuf:"varint,1,opt,name=success,proto3" json:"success,omitempty"`
    Message     string `protobuf:"bytes,2,opt,name=message,proto3" json:"message,omitempty"`
    ThreadId    string `protobuf:"bytes,3,opt,name=thread_id,json=threadId,proto3" json:"thread_id,omitempty"`
    CurrentStep string `protobuf:"bytes,4,opt,name=current_step,json=currentStep,proto3" json:"current_step,omitempty"`
}

// FeedbackRequest carries user feedback for a workflow.
type FeedbackRequest struct {
    ThreadId string `protobuf:"bytes,1,opt,name=thread_id,json=threadId,proto3" json:"thread_id,omitempty"`
    Feedback string `protobuf:"bytes,2,opt,name=feedback,proto3" json:"feedback,omitempty"`
}

// ResumeWorkflowRequest requests resuming a paused workflow.
type ResumeWorkflowRequest struct {
    ThreadId string `protobuf:"bytes,1,opt,name=thread_id,json=threadId,proto3" json:"thread_id,omitempty"`
}

// GetStatusRequest requests workflow status.
type GetStatusRequest struct {
    ThreadId string `protobuf:"bytes,1,opt,name=thread_id,json=threadId,proto3" json:"thread_id,omitempty"`
}

// StatusResponse returns the status of a workflow.
type StatusResponse struct {
    Success     bool   `protobuf:"varint,1,opt,name=success,proto3" json:"success,omitempty"`
    Message     string `protobuf:"bytes,2,opt,name=message,proto3" json:"message,omitempty"`
    CurrentStep string `protobuf:"bytes,3,opt,name=current_step,json=currentStep,proto3" json:"current_step,omitempty"`
}

// AgentServiceClient defines the client API for AgentService.
type AgentServiceClient interface {
    StartWorkflow(ctx context.Context, in *StartWorkflowRequest, opts ...grpc.CallOption) (*WorkflowResponse, error)
    AddFeedback(ctx context.Context, in *FeedbackRequest, opts ...grpc.CallOption) (*WorkflowResponse, error)
    ResumeWorkflow(ctx context.Context, in *ResumeWorkflowRequest, opts ...grpc.CallOption) (*WorkflowResponse, error)
    GetWorkflowStatus(ctx context.Context, in *GetStatusRequest, opts ...grpc.CallOption) (*StatusResponse, error)
}

type agentServiceClient struct {
    cc grpc.ClientConnInterface
}

// NewAgentServiceClient creates a new AgentServiceClient.
func NewAgentServiceClient(cc grpc.ClientConnInterface) AgentServiceClient {
    return &agentServiceClient{cc}
}

func (c *agentServiceClient) StartWorkflow(ctx context.Context, in *StartWorkflowRequest, opts ...grpc.CallOption) (*WorkflowResponse, error) {
    out := new(WorkflowResponse)
    err := c.cc.Invoke(ctx, "/agent.AgentService/StartWorkflow", in, out, opts...)
    if err != nil {
        return nil, err
    }
    return out, nil
}

func (c *agentServiceClient) AddFeedback(ctx context.Context, in *FeedbackRequest, opts ...grpc.CallOption) (*WorkflowResponse, error) {
    out := new(WorkflowResponse)
    err := c.cc.Invoke(ctx, "/agent.AgentService/AddFeedback", in, out, opts...)
    if err != nil {
        return nil, err
    }
    return out, nil
}

func (c *agentServiceClient) ResumeWorkflow(ctx context.Context, in *ResumeWorkflowRequest, opts ...grpc.CallOption) (*WorkflowResponse, error) {
    out := new(WorkflowResponse)
    err := c.cc.Invoke(ctx, "/agent.AgentService/ResumeWorkflow", in, out, opts...)
    if err != nil {
        return nil, err
    }
    return out, nil
}

func (c *agentServiceClient) GetWorkflowStatus(ctx context.Context, in *GetStatusRequest, opts ...grpc.CallOption) (*StatusResponse, error) {
    out := new(StatusResponse)
    err := c.cc.Invoke(ctx, "/agent.AgentService/GetWorkflowStatus", in, out, opts...)
    if err != nil {
        return nil, err
    }
    return out, nil
}

// AgentServiceServer defines the server API for AgentService.
type AgentServiceServer interface {
    StartWorkflow(context.Context, *StartWorkflowRequest) (*WorkflowResponse, error)
    AddFeedback(context.Context, *FeedbackRequest) (*WorkflowResponse, error)
    ResumeWorkflow(context.Context, *ResumeWorkflowRequest) (*WorkflowResponse, error)
    GetWorkflowStatus(context.Context, *GetStatusRequest) (*StatusResponse, error)
}

// UnimplementedAgentServiceServer can be embedded to have forward compatible implementations.
type UnimplementedAgentServiceServer struct{}

func (UnimplementedAgentServiceServer) StartWorkflow(context.Context, *StartWorkflowRequest) (*WorkflowResponse, error) {
    return nil, grpc.Errorf(grpc.Code(grpc.ErrServerStopped), "method StartWorkflow not implemented")
}
func (UnimplementedAgentServiceServer) AddFeedback(context.Context, *FeedbackRequest) (*WorkflowResponse, error) {
    return nil, grpc.Errorf(grpc.Code(grpc.ErrServerStopped), "method AddFeedback not implemented")
}
func (UnimplementedAgentServiceServer) ResumeWorkflow(context.Context, *ResumeWorkflowRequest) (*WorkflowResponse, error) {
    return nil, grpc.Errorf(grpc.Code(grpc.ErrServerStopped), "method ResumeWorkflow not implemented")
}
func (UnimplementedAgentServiceServer) GetWorkflowStatus(context.Context, *GetStatusRequest) (*StatusResponse, error) {
    return nil, grpc.Errorf(grpc.Code(grpc.ErrServerStopped), "method GetWorkflowStatus not implemented")
}

// RegisterAgentServiceServer registers the server with a gRPC instance.
func RegisterAgentServiceServer(s *grpc.Server, srv AgentServiceServer) {
    s.RegisterService(&grpc.ServiceDesc{
        ServiceName: "agent.AgentService",
        HandlerType: (*AgentServiceServer)(nil),
        Methods: []grpc.MethodDesc{
            {MethodName: "StartWorkflow", Handler: _AgentService_StartWorkflow_Handler},
            {MethodName: "AddFeedback", Handler: _AgentService_AddFeedback_Handler},
            {MethodName: "ResumeWorkflow", Handler: _AgentService_ResumeWorkflow_Handler},
            {MethodName: "GetWorkflowStatus", Handler: _AgentService_GetWorkflowStatus_Handler},
        },
        Streams:  []grpc.StreamDesc{},
        Metadata: "proto/agent_service.proto",
    }, srv)
}

func _AgentService_StartWorkflow_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
    in := new(StartWorkflowRequest)
    if err := dec(in); err != nil {
        return nil, err
    }
    if interceptor == nil {
        return srv.(AgentServiceServer).StartWorkflow(ctx, in)
    }
    info := &grpc.UnaryServerInfo{
        Server:     srv,
        FullMethod: "/agent.AgentService/StartWorkflow",
    }
    handler := func(ctx context.Context, req interface{}) (interface{}, error) {
        return srv.(AgentServiceServer).StartWorkflow(ctx, req.(*StartWorkflowRequest))
    }
    return interceptor(ctx, in, info, handler)
}

func _AgentService_AddFeedback_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
    in := new(FeedbackRequest)
    if err := dec(in); err != nil {
        return nil, err
    }
    if interceptor == nil {
        return srv.(AgentServiceServer).AddFeedback(ctx, in)
    }
    info := &grpc.UnaryServerInfo{
        Server:     srv,
        FullMethod: "/agent.AgentService/AddFeedback",
    }
    handler := func(ctx context.Context, req interface{}) (interface{}, error) {
        return srv.(AgentServiceServer).AddFeedback(ctx, req.(*FeedbackRequest))
    }
    return interceptor(ctx, in, info, handler)
}

func _AgentService_ResumeWorkflow_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
    in := new(ResumeWorkflowRequest)
    if err := dec(in); err != nil {
        return nil, err
    }
    if interceptor == nil {
        return srv.(AgentServiceServer).ResumeWorkflow(ctx, in)
    }
    info := &grpc.UnaryServerInfo{
        Server:     srv,
        FullMethod: "/agent.AgentService/ResumeWorkflow",
    }
    handler := func(ctx context.Context, req interface{}) (interface{}, error) {
        return srv.(AgentServiceServer).ResumeWorkflow(ctx, req.(*ResumeWorkflowRequest))
    }
    return interceptor(ctx, in, info, handler)
}

func _AgentService_GetWorkflowStatus_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
    in := new(GetStatusRequest)
    if err := dec(in); err != nil {
        return nil, err
    }
    if interceptor == nil {
        return srv.(AgentServiceServer).GetWorkflowStatus(ctx, in)
    }
    info := &grpc.UnaryServerInfo{
        Server:     srv,
        FullMethod: "/agent.AgentService/GetWorkflowStatus",
    }
    handler := func(ctx context.Context, req interface{}) (interface{}, error) {
        return srv.(AgentServiceServer).GetWorkflowStatus(ctx, req.(*GetStatusRequest))
    }
    return interceptor(ctx, in, info, handler)
}
