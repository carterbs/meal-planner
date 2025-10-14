import { useCallback, useEffect, useState } from 'react';
import { getMessages } from '../../../api';
import type { AgentMessage as GatewayAgentMessage } from '../../../utils/gatewayGuards';

export interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
}

export default function useAgentMessages(threadId: string | null | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const fetchMessages = useCallback(async () => {
    if (!threadId) return;
    try {
      const rawMessages: GatewayAgentMessage[] = await getMessages(threadId);
      const formatted: ChatMessage[] = rawMessages.map((msg) => ({
        sender: msg.sender,
        text: msg.content,
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
