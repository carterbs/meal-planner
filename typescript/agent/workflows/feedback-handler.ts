import {
  FeedbackEntry,
  MealPlanningState,
  WorkflowType,
} from '../shared/types';
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
          workflow_type: WorkflowType.MEAL_PLANNING,
        },
      };

      const tuple = await this.checkpointer.getTuple(config);
      if (!tuple) {
        console.error(
          `❌ [FEEDBACK] No workflow found for thread ${input.threadId}`,
        );
        return false;
      }

      // Do NOT persist feedback. Only log receipt and return true.
      console.log(
        `💬 [FEEDBACK] (NO-OP) Received feedback from ${input.from} to workflow ${input.threadId}`,
      );
      return true;
    } catch (error) {
      console.error(`❌ [FEEDBACK] Error adding feedback:`, error);
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
          workflow_type: WorkflowType.MEAL_PLANNING,
        },
      };

      const tuple = await this.checkpointer.getTuple(config);
      if (!tuple) {
        return [];
      }

      const [checkpoint] = tuple;
      // Properly deserialize state from checkpoint
      const stateAny = checkpoint.channelValues['state'];
      if (!stateAny || typeof stateAny !== 'object' || !('value' in stateAny)) {
        return [];
      }
      const stateBytes = stateAny.value as Uint8Array;
      const stateJson = new TextDecoder().decode(stateBytes);
      const state = JSON.parse(stateJson) as MealPlanningState;

      return state.feedback_history || [];
    } catch (error) {
      console.error(`❌ [FEEDBACK] Error getting feedback:`, error);
      return [];
    }
  }

  /**
   * Get feedback for a specific meal plan version
   */
  async getFeedbackForVersion(
    threadId: string,
    version: number,
  ): Promise<FeedbackEntry[]> {
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
          workflow_type: WorkflowType.MEAL_PLANNING,
        },
      };

      console.error(`[FEEDBACK] Checking if workflow ${threadId} is awaiting feedback...`);
      console.error(`[FEEDBACK] Config:`, JSON.stringify(config));
      
      let tuple;
      try {
        tuple = await this.checkpointer.getTuple(config);
      } catch (getTupleError) {
        console.error(`[FEEDBACK] Error calling getTuple:`, getTupleError);
        throw getTupleError;
      }
      
      if (!tuple) {
        console.error(`[FEEDBACK] No checkpoint found for thread ${threadId}`);
        return false;
      }

      console.error(`[FEEDBACK] Got tuple, extracting checkpoint...`);
      const [checkpoint] = tuple;
      let state: MealPlanningState;
      
      // Try to get state from channelValues directly (backend format)
      if (checkpoint.channelValues && 'current_step' in checkpoint.channelValues) {
        console.log(`[FEEDBACK] Found state in channelValues directly`);
        state = checkpoint.channelValues as any as MealPlanningState;
      } 
      // Otherwise try protobuf format
      else {
        console.log(`[FEEDBACK] Trying protobuf format...`);
        const stateAny = checkpoint.channelValues['state'];
        console.log(`[FEEDBACK] stateAny type:`, typeof stateAny);
        console.log(`[FEEDBACK] stateAny keys:`, stateAny ? Object.keys(stateAny) : 'null');
        
        if (!stateAny || typeof stateAny !== 'object' || !('value' in stateAny)) {
          console.log(`[FEEDBACK] No valid state found in checkpoint`);
          return false;
        }
        
        console.log(`[FEEDBACK] stateAny.value type:`, typeof stateAny.value);
        console.log(`[FEEDBACK] stateAny.value constructor:`, stateAny.value?.constructor?.name);
        
        // Convert to proper Uint8Array if it's not already one
        let stateBytes: Uint8Array;
        if (stateAny.value instanceof Uint8Array) {
          stateBytes = stateAny.value;
        } else if (Array.isArray(stateAny.value)) {
          stateBytes = new Uint8Array(stateAny.value);
        } else if (stateAny.value && typeof stateAny.value === 'object' && 'data' in stateAny.value) {
          // Handle Buffer-like objects
          stateBytes = new Uint8Array((stateAny.value as any).data);
        } else {
          console.log(`[FEEDBACK] Unexpected stateAny.value format, trying direct conversion`);
          stateBytes = new Uint8Array(Object.values(stateAny.value as any));
        }
        
        console.log(`[FEEDBACK] About to decode ${stateBytes.length} bytes`);
        
        const stateJson = new TextDecoder().decode(stateBytes);
        console.log(`[FEEDBACK] Decoded JSON string length:`, stateJson.length);
        console.log(`[FEEDBACK] First 100 chars:`, stateJson.substring(0, 100));
        
        state = JSON.parse(stateJson) as MealPlanningState;
      }

      console.log(`[FEEDBACK] Current step: ${state.current_step}`);
      console.log(`[FEEDBACK] Current step type: ${typeof state.current_step}`);
      console.log(`[FEEDBACK] Checking if equals 'await_feedback': ${state.current_step === 'await_feedback'}`);
      console.log(`[FEEDBACK] Full state:`, JSON.stringify(state, null, 2));
      return state.current_step === 'await_feedback';
    } catch (error) {
      console.error(`❌ [FEEDBACK] Error checking feedback status:`, error);
      console.error(`[FEEDBACK] Error type:`, typeof error);
      console.error(`[FEEDBACK] Error stringified:`, JSON.stringify(error));
      if (error instanceof Error) {
        console.error(`[FEEDBACK] Error message:`, error.message);
        console.error(`[FEEDBACK] Error stack:`, error.stack);
      }
      return false;
    }
  }

  /**
   * Process feedback and determine required actions
   */
  async processFeedback(
    threadId: string,
    version: number,
  ): Promise<{
    requiresChanges: boolean;
    suggestions: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
  }> {
    const feedback = await this.getFeedbackForVersion(threadId, version);

    if (feedback.length === 0) {
      return {
        requiresChanges: false,
        suggestions: [],
        sentiment: 'neutral',
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
      'swap',
    ];
    const positiveKeywords = [
      'good',
      'great',
      'like',
      'love',
      'perfect',
      'yes',
      'approve',
    ];

    let negativeCount = 0;
    let positiveCount = 0;
    const suggestions: string[] = [];

    for (const message of messages) {
      negativeCount += negativeKeywords.filter((keyword) =>
        message.includes(keyword),
      ).length;
      positiveCount += positiveKeywords.filter((keyword) =>
        message.includes(keyword),
      ).length;

      // Extract specific change requests
      if (
        message.includes('change') ||
        message.includes('replace') ||
        message.includes('swap')
      ) {
        suggestions.push(`Consider addressing: "${message}"`);
      }
    }

    const requiresChanges = negativeCount > positiveCount;
    const sentiment =
      negativeCount > positiveCount
        ? 'negative'
        : positiveCount > negativeCount
          ? 'positive'
          : 'neutral';

    return {
      requiresChanges,
      suggestions,
      sentiment,
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
        `\n👤 ${entry.from} (v${entry.meal_plan_version}) - ${timestamp}:`,
      );
      lines.push(`   ${entry.message}`);
    }

    return lines.join('\n');
  }
}
