import { useState } from 'react';
import { useOrganization } from '@clerk/clerk-react';
import TaskColumn from './TaskColumn';
import TaskForm from './TaskForm';
import { createTask, updateTask, deleteTask } from '../services/api';
import type { Task, TaskStatus, CreateTaskInput } from '../types';

const STATUSES: TaskStatus[] = ['pending', 'started', 'completed'];

interface KanbanBoardProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  getToken: () => Promise<string | null>;
}

const KanbanBoard = ({ tasks, setTasks, getToken }: KanbanBoardProps) => {
  const { membership } = useOrganization();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const role = membership?.role;
  const canManage = role === 'org:admin' || role === 'org:editor';

  const getTasksByStatus = (status: TaskStatus): Task[] => {
    return tasks.filter((task) => task.status === status);
  };

  const handleEdit = (task: Task): void => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleDelete = async (taskId: string): Promise<void> => {
    if (!confirm('您确定要删除这个任务吗？')) return;

    const taskToDelete = tasks.find((t) => t.id === taskId);
    if (!taskToDelete) return;

    // 乐观更新，先从前端删除
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    // 调用后端API删除
    try {
      await deleteTask(getToken, taskId);
    } catch (err) {
      // 删除失败，回滚前端的状态
      setTasks((prev) => [...prev, taskToDelete]);
      console.error(err);
      alert('删除失败，请重试');
    }
  };

  const handleSubmit = async (taskData: CreateTaskInput): Promise<void> => {
    if (editingTask) {
      const updatedTask = { ...editingTask, ...taskData };
      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? updatedTask : t))
      );
      setShowForm(false);
      setEditingTask(null);

      try {
        await updateTask(getToken, editingTask.id, taskData);
      } catch (err) {
        setTasks((prev) =>
          prev.map((t) => (t.id === editingTask.id ? editingTask : t))
        );
        console.error(err);
      }
    } else {
      try {
        const newTask = await createTask(getToken, taskData);
        setTasks((prev) => [...prev, newTask]);
        setShowForm(false);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCancel = (): void => {
    setShowForm(false);
    setEditingTask(null);
  };

  const handleAddTask = (): void => {
    setEditingTask(null);
    setShowForm(true);
  };

  return (
    <div className="kanban-wrapper">
      <div className="kanban-header">
        <h2 className="kanban-title">Tasks</h2>
        {canManage && (
          <button className="btn btn-primary" onClick={handleAddTask}>
            + 新增
          </button>
        )}
      </div>

      <div className="kanban-board">
        {STATUSES.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={getTasksByStatus(status)}
            onEdit={canManage ? handleEdit : null}
            onDelete={canManage ? handleDelete : null}
          />
        ))}
      </div>

      {showForm && (
        <TaskForm
          task={editingTask ?? undefined}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
};

export default KanbanBoard;
