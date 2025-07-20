import { IOHandler } from './ioHandler';
import * as readline from 'readline';
export class CLIHandler implements IOHandler {
  private rl: readline.Interface | null = null;
  private isClosed = false;
  private ensureInterface(): readline.Interface {
    if (this.isClosed || !this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });
      this.isClosed = false;
    }
    return this.rl;
  }
  async sendMessage(message: string, from: string): Promise<void> {
    const formatted = this.formatMessage(message, from);
    console.log(formatted);
  }
  async receiveInput(prompt: string, from: string): Promise<string> {
    const formattedPrompt = this.formatMessage(prompt, from);
    const rl = this.ensureInterface();
    return new Promise<string>((resolve, reject) => {
      if (this.isClosed) {
        reject(new Error('CLI handler has been closed'));
        return;
      }
      rl.question(formattedPrompt + ' ', (answer) => {
        resolve(answer);
      });
    });
  }
  formatMessage(
    message: string,
    from: string,
    timestamp: Date = new Date(),
  ): string {
    const time = timestamp.toISOString();
    return `[${time}] ${from}: ${message}`;
  }
  close(): void {
    this.isClosed = true;
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}
