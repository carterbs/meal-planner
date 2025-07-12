import { infoLog, errorLog } from "../logging";

import {
  FeedbackEntry,
  MealPlanningState,
  WorkflowType } from
'../shared/types';
import { HttpCheckpointSaver } from '../shared/httpCheckpointer';




export interface FeedbackInput {
  threadId: string;
  from: string;
  message: string;
  mealPlanVersion?: number;
}

export class FeedbackHandler {
  private checkpointer: HttpCheckpointSaver;

  constructor(checkpointer: HttpCheckpointSaver) {
    this.checkpointer = checkpointer;
  }

  /**
   * Add feedback to a meal planning workflow
   */
  async addFeedback(input: FeedbackInput): Promise<boolean> {
    try {
      // Get current workflow state
      const config = {
        configurable: {
          threadId: input.threadId,
          workflow_type: WorkflowType.MEAL_PLANNING
        }
      };

      const tuple = await this.checkpointer.getTuple(config);
      if (!tuple) {
        errorLog(
          `❌ [FEEDBACK] No workflow found for thread ${input.threadId}`
        );
        return false;
      }

      // Do NOT persist feedback. Only log receipt and return true.
      infoLog(
        `💬 [FEEDBACK] (NO-OP) Received feedback from ${input.from} to workflow ${input.threadId}`
      );
      return true;
    } catch (error) {
      errorLog(`${`❌ [FEEDBACK] Error adding feedback:`} ${error}`);
      return false;
    }
  }

  /**
   * Get all feedback for a workflow
   */
  async getFeedback(threadId: string): Promise<FeedbackEntry[]> {
    try {
      const config = {
        configurable: {
          threadId: threadId,
          workflow_type: WorkflowType.MEAL_PLANNING
        }
      };

      const tuple = await this.checkpointer.getTuple(config);
      if (!tuple) {
        return [];
      }

      const [checkpoint] = tuple;
      if (!checkpoint.state) {
        return [];
      }
      const proto = checkpoint.state;
      const state: MealPlanningState = {
        threadId: proto.threadId,
        workflow_type: WorkflowType.MEAL_PLANNING,
        participants: proto.participants,
        created_at: proto.createdAt ? new Date(proto.createdAt) : new Date(),
        updated_at: proto.updatedAt ? new Date(proto.updatedAt) : new Date(),
        current_step: proto.currentStep as any,
        meal_plan: proto.mealPlan as any,
        feedback_history: proto.feedbackHistory as any,
        iteration_count: proto.iterationCount,
        shopping_list: proto.shoppingList as any,
        is_finalized: proto.isFinalized,
      };
      return state.feedback_history || [];
    } catch (error) {
      errorLog(`${`❌ [FEEDBACK] Error getting feedback:`} ${error}`);
      return [];
    }
  }

  /**
   * Get feedback for a specific meal plan version
   */
  async getFeedbackForVersion(
  threadId: string,
  version: number)
  : Promise<FeedbackEntry[]> {
    const allFeedback = await this.getFeedback(threadId);
    return allFeedback.filter((f) => f.meal_plan_version === version);
  }

  /**
   * Check if workflow is waiting for feedback
   */
  async isAwaitingFeedback(threadId: string): Promise<boolean> {
    try {
      const config = {
        configurable: {
          threadId: threadId,
          workflow_type: WorkflowType.MEAL_PLANNING
        }
      };

      errorLog(`[FEEDBACK] Checking if workflow ${threadId} is awaiting feedback...`);
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
      const state: MealPlanningState = {
        threadId: proto.threadId,
        workflow_type: WorkflowType.MEAL_PLANNING,
        participants: proto.participants,
        created_at: proto.createdAt ? new Date(proto.createdAt) : new Date(),
        updated_at: proto.updatedAt ? new Date(proto.updatedAt) : new Date(),
        current_step: proto.currentStep as any,
        meal_plan: proto.mealPlan as any,
        feedback_history: proto.feedbackHistory as any,
        iteration_count: proto.iterationCount,
        shopping_list: proto.shoppingList as any,
        is_finalized: proto.isFinalized,
      };

      infoLog(`[FEEDBACK] Current step: ${state.current_step}`);
      infoLog(`[FEEDBACK] Current step type: ${typeof state.current_step}`);
      infoLog(`[FEEDBACK] Checking if equals 'await_feedback': ${state.current_step === 'await_feedback'}`);
      infoLog(`${`[FEEDBACK] Full state:`} ${JSON.stringify(state, null, 2)}`);
      return state.current_step === 'await_feedback';
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

  /**
   * Process feedback and determine required actions
   */
  async processFeedback(
  threadId: string,
  version: number)
  : Promise<{
    requiresChanges: boolean;
    suggestions: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
  }> {
    const feedback = await this.getFeedbackForVersion(threadId, version);

    if (feedback.length === 0) {
      return {
        requiresChanges: false,
        suggestions: [],
        sentiment: 'neutral'
      };
    }

    // Simple feedback analysis
    const messages = feedback.map((f) => f.message.toLowerCase());
    const negativeKeywords = [
    "don't like",
    'change',
    'different',
    'no',
    'not',
    'replace',
    'swap'];

    const positiveKeywords = [
    'good',
    'great',
    'like',
    'love',
    'perfect',
    'yes',
    'approve'];


    let negativeCount = 0;
    let positiveCount = 0;
    const suggestions: string[] = [];

    for (const message of messages) {
      negativeCount += negativeKeywords.filter((keyword) =>
      message.includes(keyword)
      ).length;
      positiveCount += positiveKeywords.filter((keyword) =>
      message.includes(keyword)
      ).length;

      // Extract specific change requests
      if (
      message.includes('change') ||
      message.includes('replace') ||
      message.includes('swap'))
      {
        suggestions.push(`Consider addressing: "${message}"`);
      }
    }

    const requiresChanges = negativeCount > positiveCount;
    const sentiment =
    negativeCount > positiveCount ?
    'negative' :
    positiveCount > negativeCount ?
    'positive' :
    'neutral';

    return {
      requiresChanges,
      suggestions,
      sentiment
    };
  }

  /**
   * Format feedback for display
   */
  formatFeedback(feedback: FeedbackEntry[]): string {
    if (feedback.length === 0) {
      return 'No feedback received yet.';
    }

    const lines: string[] = [];
    lines.push('💬 Feedback History:');
    lines.push('='.repeat(40));

    for (const entry of feedback) {
      const timestamp = entry.timestamp.toLocaleString();
      lines.push(
        `\n👤 ${entry.from} (v${entry.meal_plan_version}) - ${timestamp}:`
      );
      lines.push(`   ${entry.message}`);
    }

    return lines.join('\n');
  }
}