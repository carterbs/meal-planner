export interface IOHandler {
  /**
   * Send a message to the participant(s).
   * @param message The message content.
   * @param from Identifier of the sender (e.g., 'brad', 'shannon').
   */
  sendMessage(message: string, from: string): Promise<void>;
  /**
   * Prompt the participant for input.
   * @param prompt The prompt message.
   * @param from Identifier of who is prompted.
   * @returns The participant's input.
   */
  receiveInput(prompt: string, from: string): Promise<string>;
  /**
   * Format a message uniformly, including optional timestamp.
   * @param message The message content.
   * @param from Identifier of the sender.
   * @param timestamp Optional timestamp (defaults to now).
   */
  formatMessage(message: string, from: string, timestamp?: Date): string;
  /**
   * Clean up any resources (e.g., close streams).
   */
  close(): void;
}
