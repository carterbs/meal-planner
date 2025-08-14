import { infoLog, errorLog } from '../logging';
import { WorkflowManager } from '../manager';
import { WorkflowType, MealPlanningStep } from '../shared/types';
export interface ConversationMessage {
  from: string;
  message: string;
  timestamp: Date;
  threadId?: string;
}
export interface ConversationResponse {
  success: boolean;
  message: string;
  threadId?: string;
  currentStep?: string;
  nextAction?: string;
}
export class ConversationHandler {
  private workflowManager: WorkflowManager;
  constructor(workflowManager: WorkflowManager) {
    this.workflowManager = workflowManager;
  }
  /**
   * Handle a conversation message and route it appropriately
   */
  async handleMessage(
    input: ConversationMessage,
  ): Promise<ConversationResponse> {
    try {
      // Determine if this is starting a new conversation or continuing an existing one
      if (!input.threadId) {
        return await this.startNewConversation(input);
      }
      return await this.continueConversation(input);
    } catch (error) {
      await errorLog(`${`❌ [CONVERSATION] Error handling message:`} ${String(error)}`);
      return {
        success: false,
        message:
          'Sorry, I encountered an error processing your message. Please try again.',
      };
    }
  }
  /**
   * Start a new meal planning conversation
   */
  private async startNewConversation(
    input: ConversationMessage,
  ): Promise<ConversationResponse> {
    await infoLog(
      `💬 [CONVERSATION] Starting new meal planning conversation for ${input.from}`,
    );
    // Detect intent from the message
    const intent = this.detectIntent(input.message);
    if (intent === 'meal_planning') {
      // Start a new meal planning workflow
      const threadId = await this.workflowManager.startWorkflow(
        WorkflowType.MEAL_PLANNING,
        {
          participants: [input.from],
          input: { initial_message: input.message },
        },
      );
      // Execute the first step
      await this.workflowManager.executeWorkflowStep(threadId, {
        initial_request: input.message,
      });
      return {
        success: true,
        message:
          "🍽️ I'm starting to create your meal plan! Let me generate some options for you...",
        threadId,
        currentStep: MealPlanningStep.GENERATE_PLAN,
        nextAction: 'Generating and optimizing meal plan',
      };
    }
    return {
      success: false,
      message:
        "I can help you with meal planning! Try saying something like 'create a meal plan' or 'I need help planning meals for this week'.",
    };
  }
  /**
   * Continue an existing conversation
   */
  private async continueConversation(
    input: ConversationMessage,
  ): Promise<ConversationResponse> {
    const { threadId, from, message } = input;
    if (!threadId) {
      throw new Error('Thread ID required for continuing conversation');
    }
    await infoLog(
      `💬 [CONVERSATION] Continuing conversation ${threadId} from ${from}`,
    );
    // Get current workflow status
    const status = await this.workflowManager.getWorkflowStatus(threadId);
    if (!status) {
      return {
        success: false,
        message:
          "I couldn't find our previous conversation. Let's start fresh!",
      };
    }
    // Handle based on current step
    switch (status.currentStep) {
      case MealPlanningStep.AWAIT_FEEDBACK:
        return await this.handleFeedback(threadId, from, message);
      case MealPlanningStep.COMPLETE:
        return await this.handleCompletedWorkflow(threadId, from, message);
      default:
        return await this.handleActiveWorkflow(threadId, message);
    }
  }
  /**
   * Handle feedback during the await_feedback step
   */
  private async handleFeedback(
    threadId: string,
    from: string,
    message: string,
  ): Promise<ConversationResponse> {
    await infoLog(
      `💬 [CONVERSATION] Processing feedback from ${from}: ${message}`,
    );
    // Resume the workflow to process the feedback
    const result = await this.workflowManager.resumeWorkflow(threadId, {
      feedback_received: true,
    });
    // Provide appropriate response based on feedback
    const isPositive = this.isPositiveFeedback(message);
    if (isPositive) {
      return {
        success: true,
        message:
          "Great! I'm glad you like the meal plan. Let me finalize it and generate your shopping list... 🛒",
        threadId,
        currentStep: result.currentStep,
        nextAction: 'Finalizing plan and generating shopping list',
      };
    } else {
      return {
        success: true,
        message:
          'Thanks for the feedback! Let me revise the meal plan based on your preferences... 🔄',
        threadId,
        currentStep: result.currentStep,
        nextAction: 'Optimizing plan based on feedback',
      };
    }
  }
  /**
   * Handle messages when workflow is complete
   */
  private async handleCompletedWorkflow(
    threadId: string,
    from: string,
    message: string,
  ): Promise<ConversationResponse> {
    // Check if user wants to start a new plan or modify existing
    const intent = this.detectIntent(message);
    if (intent === 'meal_planning') {
      // Start a new workflow
      return await this.startNewConversation({
        from,
        message,
        timestamp: new Date(),
      });
    }
    if (intent === 'modify_plan') {
      // TODO: Implement plan modification
      return {
        success: true,
        message:
          "I'd be happy to help modify your meal plan! What changes would you like to make?",
        threadId,
        nextAction: 'Plan modification requested',
      };
    }
    return {
      success: true,
      message:
        'Your meal plan is complete! Would you like to create a new meal plan, or is there something else I can help you with?',
      threadId,
    };
  }
  /**
   * Handle messages during active workflow execution
   */
  private async handleActiveWorkflow(
    threadId: string,
    message: string,
  ): Promise<ConversationResponse> {
    await infoLog(
      `💬 [CONVERSATION] Workflow ${threadId} is active, continuing execution`,
    );
    try {
      // Continue workflow execution
      const result = await this.workflowManager.executeWorkflowStep(threadId, {
        user_input: message,
      });
      return {
        success: true,
        message: this.getStepMessage(result.currentStep ?? 'unknown'),
        threadId,
        currentStep: result.currentStep,
        nextAction: this.getNextAction(result.currentStep ?? 'unknown'),
      };
    } catch (error) {
      await errorLog(
        `${`❌ [CONVERSATION] Error executing workflow step:`} ${String(error)}`,
      );
      return {
        success: false,
        message:
          'I encountered an issue while processing your request. Let me try again...',
        threadId,
      };
    }
  }
  /**
   * Detect user intent from message
   */
  private detectIntent(message: string): string {
    const lowerMessage = message.toLowerCase();
    // Meal planning keywords
    const mealPlanningKeywords = [
      'meal plan',
      'create plan',
      'plan meals',
      'weekly menu',
      'dinner ideas',
      'what should i eat',
      'meal suggestions',
      'food plan',
      'menu planning',
    ];
    // Modification keywords
    const modifyKeywords = [
      'change',
      'modify',
      'update',
      'different',
      'replace',
      'swap',
      'alter',
      'adjust',
    ];
    if (
      mealPlanningKeywords.some((keyword) => lowerMessage.includes(keyword))
    ) {
      return 'meal_planning';
    }
    if (modifyKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      return 'modify_plan';
    }
    return 'unknown';
  }
  /**
   * Determine if feedback is positive
   */
  private isPositiveFeedback(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    const positiveKeywords = [
      'good',
      'great',
      'perfect',
      'like',
      'love',
      'yes',
      'approve',
      'sounds good',
      'looks good',
      'fantastic',
    ];
    const negativeKeywords = [
      'no',
      "don't like",
      'change',
      'different',
      'not good',
      'replace',
      'swap',
      'hate',
      'dislike',
    ];
    const positiveCount = positiveKeywords.filter((keyword) =>
      lowerMessage.includes(keyword),
    ).length;
    const negativeCount = negativeKeywords.filter((keyword) =>
      lowerMessage.includes(keyword),
    ).length;
    return positiveCount > negativeCount;
  }
  /**
   * Get user-friendly message for each workflow step
   */
  private getStepMessage(step: string): string {
    switch (step) {
      case MealPlanningStep.GENERATE_PLAN:
        return "🔄 I'm generating your meal plan...";
      case MealPlanningStep.OPTIMIZE_PLAN:
        return '⚡ Optimizing your meal plan to make sure it meets all the criteria...';
      case MealPlanningStep.PRESENT_PLAN:
        return "📋 Here's your meal plan! Take a look and let me know what you think.";
      case MealPlanningStep.AWAIT_FEEDBACK:
        return "💭 What do you think of this meal plan? Any changes you'd like me to make?";
      case MealPlanningStep.FINALIZE_PLAN:
        return '✅ Finalizing your meal plan...';
      case MealPlanningStep.GENERATE_SHOPPING_LIST:
        return '🛒 Creating your shopping list based on the meal plan...';
      case MealPlanningStep.COMPLETE:
        return '🎉 Your meal plan is complete! Enjoy your meals this week!';
      default:
        return '🔄 Processing your request...';
    }
  }
  /**
   * Get next action description for each step
   */
  private getNextAction(step: string): string {
    switch (step) {
      case MealPlanningStep.GENERATE_PLAN:
        return 'Generating meal options';
      case MealPlanningStep.OPTIMIZE_PLAN:
        return 'Optimizing meal selection';
      case MealPlanningStep.PRESENT_PLAN:
        return 'Presenting meal plan for review';
      case MealPlanningStep.AWAIT_FEEDBACK:
        return 'Waiting for your feedback';
      case MealPlanningStep.FINALIZE_PLAN:
        return 'Finalizing meal plan';
      case MealPlanningStep.GENERATE_SHOPPING_LIST:
        return 'Generating shopping list';
      case MealPlanningStep.COMPLETE:
        return 'Workflow complete';
      default:
        return 'Processing request';
    }
  }
}
