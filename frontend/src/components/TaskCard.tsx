
const TaskCard = ({task, onEdit, onDelete}:{task:any, onEdit:any, onDelete:any}) => {

    const canEdit = !!onEdit
    const canDelete = !!onDelete

    return (
        <div 
            className={`task-card ${canEdit ? "task-card-clickable" : ""}`}
            data-status={task.status}
            onClick={canEdit ? () => onEdit(task): undefined}
        >
            <div className={"task-card-header"}>
                <h4 className={"task-card-title"}>{task.title}</h4>
                {canDelete && (
                    <button
                    className={"task-card-btn task-card-btn-delete"}
                    onClick={(e) => {
                        e.stopPropagation()
                        onDelete(task.id)
                    }}
                    title={"Delete Task"}>
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                </button>
                )}
            </div>
            {task.description && (
                <p className={"task-card-description"}>
                    {task.description}
                </p>
            )}
        </div>
    )
}

export default TaskCard