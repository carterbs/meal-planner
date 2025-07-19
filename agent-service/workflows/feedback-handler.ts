import { infoLog, errorLog } from '../logging';

import {
  WorkflowType,
  MealPlanningStep,
} from '../shared/types';
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

      errorLog(
        `[FEEDBACK] Checking if workflow ${threadId} is awaiting feedback...`,
      );
      errorLog(`${`[FEEDBACK] Config:`} ${JSON.stringify(config)}`);

      let tuple;
      try {
        tuple = await this.checkpointer.getTuple(config);
      } catch (getTupleError) {
        errorLog(`${`[FEEDBACK] Error calling getTuple:`} ${getTupleError}`);
        throw getTupleError;
      }

      if (!tuple) {
        errorLog(`[FEEDBACK] No checkpoint found for thread ${threadId}`);
        return false;
      }

      errorLog(`[FEEDBACK] Got tuple, extracting checkpoint...`);
      const [checkpoint] = tuple;
      if (!checkpoint.state) {
        errorLog('[FEEDBACK] No state in checkpoint');
        return false;
      }
      const proto = checkpoint.state;
      infoLog(`[FEEDBACK] Current step: ${proto.currentStep}`);
      infoLog(`[FEEDBACK] Current step type: ${typeof proto.currentStep}`);
      infoLog(
        `[FEEDBACK] Checking if equals 'await_feedback': ${proto.currentStep === MealPlanningStep.AWAIT_FEEDBACK}`,
      );
      infoLog(`${`[FEEDBACK] Full state:`} ${JSON.stringify(proto, null, 2)}`);
      return proto.currentStep === MealPlanningStep.AWAIT_FEEDBACK;
    } catch (error) {
      errorLog(`${`❌ [FEEDBACK] Error checking feedback status:`} ${error}`);
      errorLog(`${`[FEEDBACK] Error type:`} ${typeof error}`);
      errorLog(`${`[FEEDBACK] Error stringified:`} ${JSON.stringify(error)}`);
      if (error instanceof Error) {
        errorLog(`${`[FEEDBACK] Error message:`} ${error.message}`);
        errorLog(`${`[FEEDBACK] Error stack:`} ${error.stack}`);
      }
      return false;
    }
  }
}
