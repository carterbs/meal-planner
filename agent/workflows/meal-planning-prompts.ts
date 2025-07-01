import { VALIDATION_CRITERIA } from "../shared/types";

/**
 * Generates a prompt to analyze user feedback for satisfaction.
 */
export function getAnalyzeFeedbackPrompt(latestFeedbackMessage: string): string {
  return `Given the following user feedback on a meal plan, does the user want changes or are they satisfied? Respond with a JSON object: { "satisfied": true/false, "reasoning": "..." }\n\nFeedback: ${latestFeedbackMessage}`;
}

/**
 * Generates a prompt to update a weekly meal plan based on session feedback.
 */
export function getUpdateMealPlanPrompt(
  feedbackText: string,
  planDescription: string,
  mealOptions: string
): string {
  return `You are updating a weekly meal plan based on ALL user feedback from the entire session.\n
${feedbackText}\n
Current meal plan:\n${planDescription}\n\nAvailable meals to choose from:\n${mealOptions}\n\nIMPORTANT GUIDELINES:\n- Consider ALL feedback messages above when making decisions\n- If feedback is contradictory or impossible to satisfy (e.g., "no eggs, no cereal, no bagels" for breakfast), do your best and explain the constraints in your message\n- Only replace meals with the same meal type (breakfast/lunch/dinner)\n- Avoid duplicate meals\n- Avoid suggesting meals that have been explicitly rejected in ANY previous feedback\n- When constraints are impossible to meet, choose the best available options and explain why in your message\n\nRespond with ONLY a JSON object containing your recommended removals and/or replacements AND a friendly message to the user:\n
{
  "removals": [],
  "replacements": [
    {
      "day": "Sunday",
      "mealType": "dinner",
      "oldMealId": 9,
      "newMealId": 50,
      "reason": "Replace as requested in feedback"
    }
  ],
  "userMessage": "Thanks for your feedback! I've swapped out the Steak dinner for Chicken nuggets - a much easier option that should work better for your needs."
}\n\nIf no removals or replacements are needed, return: {"removals": [], "replacements": [], "userMessage": "Your current meal plan already looks great and addresses your preferences!"}\n
<important> Your response should be parseable as JSON.</important>`;
}

/**
 * Generates a prompt to optimize a weekly meal plan based on detected issues.
 */
export function getOptimizeMealPlanPrompt(
  issues: string[],
  planDescription: string,
  mealOptions: string
): string {
  return `You are optimizing a weekly meal plan. Here are the current issues:\n${issues.join("\n")}\n\nCurrent meal plan:\n${planDescription}\n\nAvailable meals to choose from:\n${mealOptions}\n\nOptimization rules:\n- Max ${VALIDATION_CRITERIA.maxConsecutiveHighEffort} consecutive high-effort meals (effort > 3)\n- Max ${VALIDATION_CRITERIA.maxRedMeatPerWeek} red meat meals per week\n- No duplicate meals\n- Only replace meals with same meal type (breakfast/lunch/dinner)\n- Prefer lower effort meals (1-2) for replacements\n\nPlease analyze the issues and respond with ONLY a JSON object containing your recommended replacements:\n{
  "replacements": [
    {
      "day": "Sunday",
      "mealType": "dinner",
      "oldMealId": 9,
      "newMealId": 50,
      "reason": "Replace high-effort meal"
    }
  ]
}\nIf no replacements are needed, return: {"replacements": []}.\n\n<important> Your response should be parseable as JSON.</important>`;
}

/**
 * Generates a prompt to categorize pantry staples in a shopping list.
 */
export function getPantryStaplesCategorizationPrompt(bulletedList: string): string {
  return `I will provide a bulleted shopping list to you. You should return a bulleted list with two sections: Pantry Staples and Groceries. Identify which items in the bulleted shopping list below are pantry staples (e.g., oil, salt, flour, sugar, rice, canned beans, spices, herbs), and put them in their own section. Do not remove items from the list, and ensure wording is unchanged. Return ONLY the list.\n\n${bulletedList}`;
}
