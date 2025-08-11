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
    try {
      const rawMessages = await getMessages(threadId);
      if (!Array.isArray(rawMessages)) {
        setMessages([]);
        return;
      }
      const messagesTyped = rawMessages as Array<{ sender?: string; content?: string; message?: string }>;
      const formatted: ChatMessage[] = messagesTyped.map((msg) => ({
        sender: msg.sender === 'user' ? 'user' : 'agent',
        text: (msg.content ?? msg.message ?? ''),
      }));
      setMessages(formatted);
    } catch {
      // Swallow errors during fetch; leave messages as-is
    }
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    void fetchMessages();
  }, [threadId, fetchMessages]);

  return { messages, fetchMessages };
}
