import TaskCard from "./TaskCard";

const STATUS_LABELS = {
    pending: "代办",
    started: "进行中",
    completed:"已完成"
} as const

type TaskStatus = keyof typeof STATUS_LABELS

type Task = {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
  };

const TaskColumn = ({status, tasks, onEidt, onDelete}:{status:TaskStatus, tasks:Task[], onEidt:any, onDelete:any}) => {
    return (
        <div className={"kanban-column"}>
            <div className={`kanban-column-header kanban-column-header-${status}`}>
                <h3 className={"kanban-column-title"}>
                    {STATUS_LABELS[status]}
                </h3>
                <span className="kanban-column-count">
                    {tasks.length}
                </span>
            </div>
            <div className={"kanban-column-body"}>
                {tasks.map(task => 
                    (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onEdit={onEidt}
                            onDelete={onDelete}
                        />
                    )
                )}
            </div>

        </div>
    )
}

export default TaskColumn