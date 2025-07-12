import { AgentCheckpoint, Any } from '@mealplanner/generated';

const state = { current_step: 'await_feedback', foo: 'bar' };
const stateJson = JSON.stringify(state);
const stateBytes = new TextEncoder().encode(stateJson);
const stateAny = Any.create({ typeUrl: 'type.googleapis.com/MealPlanningState', value: stateBytes });
const checkpoint = AgentCheckpoint.create({ channelValues: { state: stateAny }, next: [], step: 0 });
console.log(JSON.stringify(AgentCheckpoint.toJSON(checkpoint), null, 2));
