import { useState, useEffect, useCallback } from 'react';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  ApiError,
} from '../services/api';
import type { Task, CreateTaskInput, UpdateTaskInput } from '../types';

interface UseTasksOptions {
  enabled?: boolean;
}

interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (data: CreateTaskInput) => Promise<Task | null>;
  update: (id: string, data: UpdateTaskInput) => Promise<Task | null>;
  remove: (id: string) => Promise<boolean>;
  optimisticUpdate: (id: string, data: Partial<Task>) => void;
  optimisticCreate: (task: Task) => void;
  optimisticDelete: (id: string) => void;
  rollback: () => void;
}

/**
 * 任务管理 Hook
 * 提供任务数据的获取、创建、更新、删除功能
 * 支持乐观更新和错误回滚
 */
export function useTasks(
  getToken: () => Promise<string | null>,
  options: UseTasksOptions = {}
): UseTasksReturn {
  const { enabled = true } = options;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousTasks, setPreviousTasks] = useState<Task[]>([]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getTasks(getToken);
      setTasks(data);
    } catch (err) {
      const message = err instanceof ApiError 
        ? err.message 
        : '获取任务列表失败';
      setError(message);
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (enabled) {
      fetchTasks();
    }
  }, [enabled, fetchTasks]);

  /**
   * 乐观更新：保存当前状态
   */
  const saveCurrentState = useCallback(() => {
    setPreviousTasks(tasks);
  }, [tasks]);

  /**
   * 回滚到之前的状态
   */
  const rollback = useCallback(() => {
    setTasks(previousTasks);
    setPreviousTasks([]);
  }, [previousTasks]);

  /**
   * 乐观创建任务
   */
  const optimisticCreate = useCallback((task: Task) => {
    saveCurrentState();
    setTasks((prev) => [...prev, task]);
  }, [saveCurrentState]);

  /**
   * 乐观更新任务
   */
  const optimisticUpdate = useCallback((id: string, data: Partial<Task>) => {
    saveCurrentState();
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...data } : task))
    );
  }, [saveCurrentState]);

  /**
   * 乐观删除任务
   */
  const optimisticDelete = useCallback((id: string) => {
    saveCurrentState();
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, [saveCurrentState]);

  /**
   * 创建任务
   */
  const create = useCallback(
    async (data: CreateTaskInput): Promise<Task | null> => {
      try {
        const newTask = await createTask(getToken, data);
        setTasks((prev) => [...prev, newTask]);
        return newTask;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : '创建任务失败';
        setError(message);
        console.error('Failed to create task:', err);
        return null;
      }
    },
    [getToken]
  );

  /**
   * 更新任务
   */
  const update = useCallback(
    async (id: string, data: UpdateTaskInput): Promise<Task | null> => {
      try {
        const updatedTask = await updateTask(getToken, id, data);
        setTasks((prev) =>
          prev.map((task) => (task.id === id ? updatedTask : task))
        );
        return updatedTask;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : '更新任务失败';
        setError(message);
        console.error('Failed to update task:', err);
        return null;
      }
    },
    [getToken]
  );

  /**
   * 删除任务
   */
  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await deleteTask(getToken, id);
        setTasks((prev) => prev.filter((task) => task.id !== id));
        return true;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : '删除任务失败';
        setError(message);
        console.error('Failed to delete task:', err);
        return false;
      }
    },
    [getToken]
  );

  return {
    tasks,
    loading,
    error,
    refetch: fetchTasks,
    create,
    update,
    remove,
    optimisticUpdate,
    optimisticCreate,
    optimisticDelete,
    rollback,
  };
}

export default useTasks;
