import { useCallback, useEffect, useState } from 'react';
import { getMessages } from '../../../api';

export interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
}

export default function useAgentMessages(threadId: string | null | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const fetchMessages = useCallback(async () => {
    if (!threadId) return;
    const msgs = (await getMessages(threadId)) || [];
    const formatted: ChatMessage[] = msgs.map((msg) => ({
      sender: msg.sender === 'user' ? 'user' : 'agent',
      text: (msg as { content?: string; message?: string }).content ??
        (msg as { content?: string; message?: string }).message ??
        '',
    }));
    setMessages(formatted);
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    void fetchMessages();
  }, [threadId, fetchMessages]);

  return { messages, fetchMessages };
}
