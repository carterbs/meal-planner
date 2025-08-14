import { infoLog, errorLog } from '../logging';
import { WorkflowType, MealPlanningStep } from '../shared/types';
import { DbCheckpointSaver } from '../shared/dbCheckpointer';
export interface FeedbackInput {
  threadId: string;
  from: string;
  message: string;
  mealPlanVersion?: number;
}
export class FeedbackHandler {
  private checkpointer: DbCheckpointSaver;
  constructor(checkpointer: DbCheckpointSaver) {
    this.checkpointer = checkpointer;
  }
  /**
   * Check if workflow is waiting for feedback
   */
  async isAwaitingFeedback(threadId: string): Promise<boolean> {
    try {
      const config = {
        configurable: {
          threadId: threadId,
          workflow_type: WorkflowType.MEAL_PLANNING,
        },
      };
      await errorLog(
        `[FEEDBACK] Checking if workflow ${threadId} is awaiting feedback...`,
      );
      await errorLog(`${`[FEEDBACK] Config:`} ${JSON.stringify(config)}`);
      let tuple;
      try {
        tuple = await this.checkpointer.getTuple(config);
      } catch (getTupleError) {
        await errorLog(
          `${`[FEEDBACK] Error calling getTuple:`} ${String(getTupleError)}`,
        );
        throw getTupleError;
      }
      if (!tuple) {
        await errorLog(`[FEEDBACK] No checkpoint found for thread ${threadId}`);
        return false;
      }
      await errorLog(`[FEEDBACK] Got tuple, extracting checkpoint...`);
      const [checkpoint] = tuple;
      if (!checkpoint.state) {
        await errorLog('[FEEDBACK] No state in checkpoint');
        return false;
      }
      const proto = checkpoint.state;
      await infoLog(`[FEEDBACK] Current step: ${proto.currentStep}`);
      await infoLog(
        `[FEEDBACK] Current step type: ${typeof proto.currentStep}`,
      );
      await infoLog(
        `[FEEDBACK] Checking if equals 'await_feedback': ${proto.currentStep === MealPlanningStep.AWAIT_FEEDBACK}`,
      );
      await infoLog(
        `${`[FEEDBACK] Full state:`} ${JSON.stringify(proto, null, 2)}`,
      );
      return proto.currentStep === MealPlanningStep.AWAIT_FEEDBACK;
    } catch (error) {
      await errorLog(
        `${`❌ [FEEDBACK] Error checking feedback status:`} ${String(error)}`,
      );
      await errorLog(`${`[FEEDBACK] Error type:`} ${typeof error}`);
      await errorLog(
        `${`[FEEDBACK] Error stringified:`} ${JSON.stringify(error)}`,
      );
      if (error instanceof Error) {
        await errorLog(`${`[FEEDBACK] Error message:`} ${error.message}`);
        await errorLog(`${`[FEEDBACK] Error stack:`} ${error.stack}`);
      }
      return false;
    }
  }
}
