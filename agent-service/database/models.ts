// Database models based on Go structs
export interface MessageRecord {
  id: number;
  thread_id: string;
  sender: string;
  content: string;
  created_at: Date;
}
export interface ChatMessage {
  sender: string;
  text: string;
}
export interface CheckpointRecord {
  thread_id: string;
  checkpoint_ns: string;
  checkpoint_data: Buffer;
  metadata: Buffer;
}
export interface WorkflowStatus {
  thread_id: string;
  workflow_type: string;
  current_step: string;
  participants: string[];
}
