import { useState, useCallback } from 'react';
import { sendChatMessage, ApiError } from '../services/api';
import type { Message } from '../types';

interface UseChatOptions {
  kbId: string;
}

interface UseChatReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

/**
 * 聊天功能 Hook
 */
export function useChat(options: UseChatOptions): UseChatReturn {
  const { kbId } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      if (!content.trim()) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: content.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      setError(null);

      try {
        const response = await sendChatMessage(kbId, {
          message: content.trim(),
        });

        const assistantMessage: Message = {
          id: response.id,
          role: 'assistant',
          content: response.content,
          sources: response.sources?.map((s) => ({
            doc_id: s.doc_id,
            content: s.content,
            score: s.score,
            chunk_index: s.chunk_index,
          })),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : '发送消息失败';
        setError(message);
        console.error('Failed to send message:', err);
      } finally {
        setLoading(false);
      }
    },
    [kbId]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearMessages,
  };
}

export default useChat;
