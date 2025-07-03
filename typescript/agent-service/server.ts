import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { LangGraphAgent } from '../agent/langgraph-agent';

const packageDefinition = protoLoader.loadSync('../../proto/agent_service.proto');
const agentProto = grpc.loadPackageDefinition(packageDefinition).agent as any;

class AgentServiceImpl {
  private agent: LangGraphAgent;

  constructor() {
    // In real use, pass configuration as needed
    this.agent = new LangGraphAgent({ database: { connectionString: '' } } as any);
  }

  async startWorkflow(call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) {
    try {
      const result = await this.agent.startMealPlanningWorkflow(call.request.participants);
      callback(null, {
        success: true,
        message: result.message,
        thread_id: result.threadId,
        current_step: result.currentStep
      });
    } catch (err: any) {
      callback(null, { success: false, message: err.message });
    }
  }

  // Placeholder implementations for other RPCs
  async addFeedback(call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) {
    callback(null, { success: false, message: 'not implemented' });
  }

  async resumeWorkflow(call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) {
    callback(null, { success: false, message: 'not implemented' });
  }

  async getWorkflowStatus(call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) {
    callback(null, { success: false, message: 'not implemented' });
  }
}

const server = new grpc.Server();
server.addService(agentProto.AgentService.service, new AgentServiceImpl());
server.bindAsync('0.0.0.0:9091', grpc.ServerCredentials.createInsecure(), () => {
  console.log('Agent gRPC server listening on :9091');
  server.start();
});
