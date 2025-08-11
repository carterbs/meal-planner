import { useCallback, useEffect, useState } from 'react';
import { getMessages } from '../../../api';
import type { GoMessage } from '@mealplanner/generated/dist/gateway/types.gen';

export interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
}

export default function useAgentMessages(threadId: string | null | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const fetchMessages = useCallback(async () => {
    if (!threadId) return;
    const msgs: GoMessage[] = (await getMessages(threadId)) as GoMessage[];
    const formatted: ChatMessage[] = msgs.map((msg) => ({
      sender: msg.sender === 'user' ? 'user' : 'agent',
      text: (msg.content ?? msg.message ?? ''),
    }));
    setMessages(formatted);
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    void fetchMessages();
  }, [threadId, fetchMessages]);

  return { messages, fetchMessages };
}
