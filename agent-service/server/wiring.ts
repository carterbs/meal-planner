import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { planStart } from './handlers/planStart';
import { planFeedback } from './handlers/planFeedback';
import { planFinalize } from './handlers/planFinalize';

const packageDefinition = protoLoader.loadSync(
    path.resolve(__dirname, '../../proto/agent.proto'),
    {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
    },
);

interface ProtoGrpcType {
    agent: {
        AgentService: {
            service: grpc.ServiceDefinition;
        };
    };
}

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;

export function registerServices(server: grpc.Server) {
    const agentProto = protoDescriptor.agent;
    server.addService(agentProto.AgentService.service, {
        planStart,
        planFeedback,
        planFinalize,
    });
}


