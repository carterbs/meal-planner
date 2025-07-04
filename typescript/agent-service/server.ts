import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { LangGraphAgent } from '../agent/langgraph-agent';

const packageDefinition = protoLoader.loadSync('../../proto/agent_service.proto');
const agentProto = (grpc.loadPackageDefinition(packageDefinition) as any).agent;

class AgentServiceImpl {
  private agent: LangGraphAgent;

  constructor() {
    // In a real implementation, configuration would be injected
    this.agent = new LangGraphAgent({} as any);
  }

  async startWorkflow(call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) {
    try {
      const result = await this.agent.startMealPlanningWorkflow(call.request.participants);
      callback(null, {
        success: true,
        message: result.message,
        thread_id: result.threadId,
        current_step: result.currentStep,
      });
    } catch (err: any) {
      callback(null, { success: false, message: err.message });
    }
  }
}

export function startServer() {
  const server = new grpc.Server();
  server.addService(agentProto.AgentService.service, new AgentServiceImpl());
  server.bindAsync('0.0.0.0:9091', grpc.ServerCredentials.createInsecure(), () => {
    console.log('Agent gRPC server listening on :9091');
    server.start();
  });
}

if (require.main === module) {
  startServer();
}
