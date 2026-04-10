import React, { useState, useEffect } from "react";

type TaskStatus = 'pending' | 'started' | 'completed'

type Task = {
    id:string
    title: string
    description?: string
    status: TaskStatus
}

interface TaskFormProps {
    task: Task,
    onSubmit: ({title, description, status}:{title:string, description?:string, status:TaskStatus}) => void,
    onCancel: () => void
}

const TaskForm = ({task, onSubmit, onCancel}:TaskFormProps) => {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [status, setStatus] = useState<TaskStatus>("pending")
    
    // 两次逻辑非，第一次将task转换为boolen值并取反，第二次再取反，得到task本身对应的boolen值
    const isEditing = !!task
    
    useEffect(
        () => {
            if (task){
                setTitle(task.title)
                setDescription(task.description || "")
                setStatus(task.status)
            } else {
                setTitle("")
                setDescription("")
                setStatus("pending")
            }
        },[task]
    )

    const handleSubmit = (e:React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!title.trim()) return

        onSubmit ({
            title: title.trim(),
            description: description.trim(),
            status
        })
    }
    

    return (
        <div className={"modal-overlay"} onClick={onCancel}>
            <div className={"modal"} onClick={(e) => e.stopPropagation()}>
                <div className={"modal-header"}>
                    <h2 className={"modal-title"}>{isEditing ? "Edit Task" : "New Task"}</h2>
                    <button className={"modal-close"} onClick={onCancel}>x</button>
                </div>
                <form onSubmit={handleSubmit}>
                <div className={"form-group"}>
                    <label className={"form-label"} htmlFor={"title"}>Title</label>
                    <input 
                        id={"title"}
                        type={"text"}
                        className={"form-input"}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={"Enter task title"}
                        autoFocus
                    />
                </div>
                <div className={"form-group"}>
                    <label className={"form-label"} htmlFor={"description"}>Description</label>
                    <textarea
                        id={"description"}
                        className={"form-textarea"}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={"Enter description (optional)"}
                    />
                </div>
                <div className={"form-group"}>
                    <label className={"form-label"} htmlFor={"status"}>Status</label>
                    <select
                        id={"status"}
                        className={"form-select"}
                        value={status}
                        onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    >
                        <option value={"pending"}>To Do</option>
                        <option value={"started"}>In Progress</option>
                        <option value={"completed"}>Done</option>
                    </select>
                </div>
                <div className={"form-actions"}>
                    <button type={"button"} className={"btn btn-outline"} onClick={onCancel}>
                        Cancel
                    </button>
                    <button type={"submit"} className={"btn btn-primary"}>
                        {isEditing ? "Save Changes" : "Create Task"}
                    </button>
                </div>
            </form>
            </div>
        </div>
    )  
}

export default TaskForm