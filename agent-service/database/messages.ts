import { Pool } from 'pg';
import { getDatabase } from './connection';
import { MessageRecord, ChatMessage } from './models';
export class MessageRepository {
  private db: Pool;
  constructor() {
    this.db = getDatabase();
  }
  // SaveMessage inserts a new message into the messages table - matches Go models/message_sql.go
  async saveMessage(
    threadID: string,
    sender: string,
    content: string,
  ): Promise<MessageRecord> {
    const query = `
      INSERT INTO messages (thread_id, sender, content)
      VALUES ($1, $2, $3)
      RETURNING id, thread_id, sender, content, created_at`;
    const result = await this.db.query(query, [threadID, sender, content]);
    const row = result.rows[0];
    return {
      id: row.id,
      thread_id: row.thread_id,
      sender: row.sender,
      content: row.content,
      created_at: row.created_at,
    };
  }
  // GetMessagesForThread retrieves all messages for a thread ordered by creation time - matches Go models/message_sql.go
  async getMessagesForThread(threadID: string): Promise<MessageRecord[]> {
    const query = `
      SELECT id, thread_id, sender, content, created_at
      FROM messages
      WHERE thread_id = $1
      ORDER BY created_at`;
    const result = await this.db.query(query, [threadID]);
    return result.rows.map((row) => ({
      id: row.id,
      thread_id: row.thread_id,
      sender: row.sender,
      content: row.content,
      created_at: row.created_at,
    }));
  }
  // AddMessage stores a message in the messages table - matches Go models/checkpoint.go
  async addMessage(
    threadID: string,
    sender: string,
    content: string,
  ): Promise<void> {
    const query = `
      INSERT INTO messages (thread_id, sender, content, created_at)
      VALUES ($1, $2, $3, NOW())`;
    try {
      await this.db.query(query, [threadID, sender, content]);
    } catch (error) {
      throw new Error(`Failed to insert message: ${error}`);
    }
  }
  // GetMessages retrieves all messages for a thread - matches Go models/checkpoint.go
  async getMessages(threadID: string): Promise<ChatMessage[]> {
    const query = `
      SELECT sender, content FROM messages 
      WHERE thread_id = $1 
      ORDER BY created_at ASC`;
    try {
      const result = await this.db.query(query, [threadID]);
      return result.rows.map((row) => ({
        sender: row.sender,
        text: row.content,
      }));
    } catch (error) {
      throw new Error(`Failed to query messages: ${error}`);
    }
  }
  // GetMessagesForProtobuf retrieves all messages for a thread in protobuf format - matches Go models/checkpoint.go
  async getMessagesForProtobuf(threadID: string): Promise<
    Array<{
      thread_id: string;
      sender: string;
      content: string;
      created_at: string;
    }>
  > {
    const query = `
      SELECT sender, content, created_at FROM messages 
      WHERE thread_id = $1 
      ORDER BY created_at ASC`;
    try {
      const result = await this.db.query(query, [threadID]);
      return result.rows.map((row) => ({
        thread_id: threadID,
        sender: row.sender,
        content: row.content,
        created_at: row.created_at.toISOString(),
      }));
    } catch (error) {
      throw new Error(`Failed to query messages: ${error}`);
    }
  }
  // AddMessageLegacy appends a message and returns it (for backward compatibility) - matches Go models/checkpoint.go
  async addMessageLegacy(
    threadID: string,
    sender: string,
    message: string,
  ): Promise<ChatMessage> {
    await this.addMessage(threadID, sender, message);
    return { sender: sender, text: message };
  }
}
