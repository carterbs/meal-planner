import {
  FeedbackEntry,
  MealPlanningState,
  WorkflowType,
} from '../shared/types';
import { PostgresCheckpointSaver } from '../shared/checkpointer';

export interface FeedbackInput {
  threadId: string;
  from: string;
  message: string;
  mealPlanVersion?: number;
}

export class FeedbackHandler {
  private checkpointer: PostgresCheckpointSaver;

  constructor(checkpointer: PostgresCheckpointSaver) {
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

      const [checkpoint, metadata] = tuple;
      const state = checkpoint.channel_values as MealPlanningState;

      // Create feedback entry
      const feedback: FeedbackEntry = {
        from: input.from,
        message: input.message,
        timestamp: new Date(),
        meal_plan_version: input.mealPlanVersion ?? state.iteration_count,
      };

      // Add feedback to state
      const updatedState: Partial<MealPlanningState> = {
        feedback_history: [...(state.feedback_history || []), feedback],
        updated_at: new Date(),
      };

      // Update checkpoint
      const updatedCheckpoint = {
        ...checkpoint,
        channel_values: {
          ...state,
          ...updatedState,
        },
      };

      const updatedMetadata = {
        ...metadata,
        step: metadata.step + 1,
        writes: { feedback_added: feedback },
      };

      await this.checkpointer.put(config, updatedCheckpoint, updatedMetadata);

      console.log(
        `💬 [FEEDBACK] Added feedback from ${input.from} to workflow ${input.threadId}`,
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
      const state = checkpoint.channel_values as MealPlanningState;

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

      const tuple = await this.checkpointer.getTuple(config);
      if (!tuple) {
        return false;
      }

      const [checkpoint] = tuple;
      const state = checkpoint.channel_values as MealPlanningState;

      return state.current_step === 'await_feedback';
    } catch (error) {
      console.error(`❌ [FEEDBACK] Error checking feedback status:`, error);
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
