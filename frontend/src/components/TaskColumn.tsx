import TaskCard from './TaskCard';
import type { Task, TaskStatus, TaskColumnProps } from '../types';

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '代办',
  started: '进行中',
  completed: '已完成',
};

const TaskColumn = ({ status, tasks, onEdit, onDelete }: TaskColumnProps) => {
  return (
    <div className="kanban-column">
      <div className={`kanban-column-header kanban-column-header-${status}`}>
        <h3 className="kanban-column-title">{STATUS_LABELS[status]}</h3>
        <span className="kanban-column-count">{tasks.length}</span>
      </div>
      <div className="kanban-column-body">
        {tasks.map((task: Task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEdit ?? undefined}
            onDelete={onDelete ?? undefined}
          />
        ))}
      </div>
    </div>
  );
};

export default TaskColumn;
