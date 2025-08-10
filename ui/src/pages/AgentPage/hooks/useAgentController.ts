import { useCallback, useEffect, useMemo, useState } from 'react';
import { WeeklyMealPlan, ShoppingListItem } from '@mealplanner/generated';
import { SessionInfo } from '../../../api';
import useAgentSession from './useAgentSession';
import useAgentMessages from './useAgentMessages';
import useAgentMealSync from './useAgentMealSync';

export interface ChatMessage {
    sender: 'user' | 'agent';
    text: string;
}

interface UseAgentControllerReturn {
    session: SessionInfo | null;
    startSession: () => Promise<void>;
    logout: () => void;

    input: string;
    setInput: (v: string) => void;
    isWorking: boolean;

    messages: ChatMessage[];
    sendMessage: (text?: string) => Promise<{ newPlan?: WeeklyMealPlan } | void>;

    mealPlan: WeeklyMealPlan | null;
    shoppingList: ShoppingListItem[] | null;
    setMealPlanExternal: (plan: WeeklyMealPlan) => void;
}

export default function useAgentController(): UseAgentControllerReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const { session, isWorking: isStarting, start, logout } = useAgentSession();
    const { messages: fetchedMessages, fetchMessages } = useAgentMessages(
        session?.threadId,
    );
    const { mealPlan, shoppingList, syncFromCheckpoint, send, setMealPlan } =
        useAgentMealSync();

    const fetchAndUpdateMessages = useCallback(async () => {
        await fetchMessages();
    }, [fetchMessages]);

    const startSession = useCallback(async () => {
        const result = await start();
        if (result.initialState?.mealPlan) {
            setMealPlan(result.initialState.mealPlan);
        }
        if (result.message) {
            setMessages([{ sender: 'agent', text: result.message }]);
        }
        // Ensure we populate meal plan and messages from the latest checkpoint/state
        if (result.session?.threadId) {
            await syncFromCheckpoint(result.session.threadId);
            await fetchAndUpdateMessages();
        }
    }, [start, setMealPlan, syncFromCheckpoint, fetchAndUpdateMessages]);

    const _logout = useCallback(() => {
        setMessages([]);
        logout();
    }, [logout]);

    useEffect(() => {
        setMessages(fetchedMessages);
    }, [fetchedMessages]);

    // When a session is present, keep local messages in sync with fetched state
    // and sync meal plan from checkpoint.
    // Intentionally no resume logic here; handled in useAgentSession.

    useEffect(() => {
        if (!session?.threadId) return;
        void (async () => {
            await syncFromCheckpoint(session.threadId);
            await fetchAndUpdateMessages();
        })();
    }, [session && session.threadId, syncFromCheckpoint, fetchAndUpdateMessages]);

    const sendMessage = useCallback(
        async (text?: string) => {
            if (!session) return;
            const messageText = (text ?? input).trim();
            if (!messageText) return;
            const userMsg: ChatMessage = { sender: 'user', text: messageText };
            setMessages((prev) => [...prev, userMsg]);
            if (!text) setInput('');
            await send(session.threadId, userMsg.text);
            await syncFromCheckpoint(session.threadId);
            await fetchAndUpdateMessages();
            return mealPlan ? { newPlan: mealPlan } : undefined;
        },
        [session, input, send, syncFromCheckpoint, fetchAndUpdateMessages, mealPlan],
    );

    return useMemo(
        () => ({
            session,
            startSession,
            logout: _logout,
            input,
            setInput,
            isWorking: isStarting,
            messages,
            sendMessage,
            mealPlan,
            shoppingList,
            setMealPlanExternal: setMealPlan,
        }),
        [
            session,
            startSession,
            _logout,
            input,
            isStarting,
            messages,
            sendMessage,
            mealPlan,
            shoppingList,
            setMealPlan,
        ],
    );
}
