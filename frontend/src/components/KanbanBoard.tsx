import { useState } from 'react';
import { useOrganization } from '@clerk/clerk-react';
import TaskColumn from './TaskColumn';
import TaskForm from './TaskForm';
import type { Task, TaskStatus, CreateTaskInput, UpdateTaskInput } from '../types';

const STATUSES: TaskStatus[] = ['pending', 'started', 'completed'];

interface KanbanBoardProps {
  tasks: Task[];
  onCreate: (data: CreateTaskInput) => Promise<Task | null>;
  onUpdate: (id: string, data: UpdateTaskInput) => Promise<Task | null>;
  onDelete: (id: string) => Promise<boolean>;
}

const KanbanBoard = ({ tasks, onCreate, onUpdate, onDelete }: KanbanBoardProps) => {
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
    await onDelete(taskId);
  };

  const handleSubmit = async (taskData: CreateTaskInput): Promise<void> => {
    if (editingTask) {
      await onUpdate(editingTask.id, taskData);
      setShowForm(false);
      setEditingTask(null);
    } else {
      await onCreate(taskData);
      setShowForm(false);
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
