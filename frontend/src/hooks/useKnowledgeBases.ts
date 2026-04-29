import { useState, useEffect, useCallback } from 'react';
import {
  getKnowledgeBases,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  ApiError,
} from '../services/api';
import type {
  KnowledgeBase,
  CreateKnowledgeBaseInput,
  UpdateKnowledgeBaseInput,
} from '../types';

interface UseKnowledgeBasesOptions {
  enabled?: boolean;
}

interface UseKnowledgeBasesReturn {
  knowledgeBases: KnowledgeBase[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (data: CreateKnowledgeBaseInput) => Promise<KnowledgeBase | null>;
  update: (id: string, data: UpdateKnowledgeBaseInput) => Promise<KnowledgeBase | null>;
  remove: (id: string) => Promise<boolean>;
}

/**
 * 知识库管理 Hook
 */
export function useKnowledgeBases(
  getToken: () => Promise<string | null>,
  options: UseKnowledgeBasesOptions = {}
): UseKnowledgeBasesReturn {
  const { enabled = true } = options;

  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKnowledgeBases = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getKnowledgeBases(getToken);
      setKnowledgeBases(response.items);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '获取知识库列表失败';
      setError(message);
      console.error('Failed to fetch knowledge bases:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (enabled) {
      fetchKnowledgeBases();
    }
  }, [enabled, fetchKnowledgeBases]);

  const create = useCallback(
    async (data: CreateKnowledgeBaseInput): Promise<KnowledgeBase | null> => {
      try {
        const newKB = await createKnowledgeBase(getToken, data);
        setKnowledgeBases((prev) => [newKB, ...prev]);
        return newKB;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : '创建知识库失败';
        setError(message);
        console.error('Failed to create knowledge base:', err);
        return null;
      }
    },
    [getToken]
  );

  const update = useCallback(
    async (
      id: string,
      data: UpdateKnowledgeBaseInput
    ): Promise<KnowledgeBase | null> => {
      try {
        const updatedKB = await updateKnowledgeBase(getToken, id, data);
        setKnowledgeBases((prev) =>
          prev.map((kb) => (kb.id === id ? updatedKB : kb))
        );
        return updatedKB;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : '更新知识库失败';
        setError(message);
        console.error('Failed to update knowledge base:', err);
        return null;
      }
    },
    [getToken]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await deleteKnowledgeBase(getToken, id);
        setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
        return true;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : '删除知识库失败';
        setError(message);
        console.error('Failed to delete knowledge base:', err);
        return false;
      }
    },
    [getToken]
  );

  return {
    knowledgeBases,
    loading,
    error,
    refetch: fetchKnowledgeBases,
    create,
    update,
    remove,
  };
}

export default useKnowledgeBases;
