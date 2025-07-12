const { AgentCheckpoint, Any, AgentCheckpointMetadata } = require('../generated/ts/api.js');
const state = { current_step: 'await_feedback', foo: 'bar' };
const stateBytes = Buffer.from(JSON.stringify(state), 'utf-8');
const stateAny = Any.create({ typeUrl: 'type.googleapis.com/MealPlanningState', value: stateBytes });
const checkpoint = AgentCheckpoint.create({ channelValues: { state: stateAny }, next: [], step: 0 });
const cpJson = AgentCheckpoint.toJSON(checkpoint);
console.log(JSON.stringify(cpJson, null, 2));
