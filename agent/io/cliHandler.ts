import { IOHandler } from './ioHandler';
import * as readline from 'readline';

export class CLIHandler implements IOHandler {
  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  async sendMessage(message: string, from: string): Promise<void> {
    const formatted = this.formatMessage(message, from);
    console.log(formatted);
  }

  async receiveInput(prompt: string, from: string): Promise<string> {
    const formattedPrompt = this.formatMessage(prompt, from);
    return new Promise<string>((resolve) => {
      this.rl.question(formattedPrompt + ' ', (answer) => {
        resolve(answer);
      });
    });
  }

  formatMessage(message: string, from: string, timestamp: Date = new Date()): string {
    const time = timestamp.toISOString();
    return `[${time}] ${from}: ${message}`;
  }

  close(): void {
    this.rl.close();
  }
}
