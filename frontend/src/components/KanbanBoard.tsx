import {useState} from "react"
import { useOrganization } from "@clerk/clerk-react"
import TaskColumn from "./TaskColumn"
import {createTask, updateTask, deleteTask} from "../services/api"
import TaskForm from './TaskForm'

const STATUSES = ["pending", "started", "completed"] as const;

type Task = {
    id: string
    title: string
    description?: string
    status: "pending" | "started" | "completed"
}
  

const KanbanBoard = ({tasks, setTasks, getToken}:{tasks:any, setTasks:any, getToken:any}) => {
    const {membership} = useOrganization()
    const [showForm, setShowForm] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)

    const role = membership?.role
    const canManage = role === "org:admin" || role === "org:editor"


    type TaskStatus = (typeof STATUSES)[number]
    const getTasksByStatus = (status:TaskStatus) => {
        return tasks.filter((task:any) => task.status === status)
    }

    const handleEdit = (task:any) => {
        setEditingTask(task)
        setShowForm(true)
    }

    const handleDelete = async (taskId:any) => {
        if (!confirm("您确定要删除这个任务吗？")) return

        const taskToDelete = tasks.find((t:any) => t.id === taskId)
        // 乐观更新，先从前端删除
        setTasks((prev:any) => prev.filter((t:any) => t.id!==taskId))
        // 调用后端API删除
        try {
            await deleteTask(getToken, taskId)
        } catch (err) {
            //删除失败，回滚前端的状态
            setTasks((prev:any) => [...prev, taskToDelete])
            console.error(err)
            alert("删除失败，请重试")
        }
    }

    const handleSubmit = async (taskData:any) => {
        if (editingTask) {
            const updatedTask = {...editingTask, ...taskData}
            setTasks((prev:any) => prev.map((t:any) => t.id === editingTask.id ? updatedTask : t))
            setShowForm(false)
            setEditingTask(null)

            try {
                await updateTask(getToken, editingTask.id, taskData)
            } catch(err){
                setTasks((prev:any) => prev.map((t:any) => t.id === editingTask.id ? editingTask: t))
                console.error(err)
            }
        } else {
            try {
                const newTask = await createTask(getToken, taskData)
                setTasks((prev:any) => [...prev, newTask])
                setShowForm(false)
            } catch (err) {
                console.error(err)
            }
        }
    }
    
    function handleCancel() {
        setShowForm(false)
        setEditingTask(null)
    }

    function handleAddTask() {
        setEditingTask(null)
        setShowForm(true)
    }

    return (
        <div className={"kanban-wrapper"}>
            <div className={"kanban-header"}>
                <h2 className={"kanban-title"}>Tasks</h2>
                {
                    canManage && (
                        <button className="btn btn-primary" onClick={handleAddTask}>
                            + 新增
                        </button>
                    )
                }
            </div>

            <div className={"kanban-board"}>
                    {
                        STATUSES.map(status => (
                            <TaskColumn
                                key={status}
                                status={status}
                                tasks={getTasksByStatus(status)}
                                onEidt={canManage ? handleEdit : null}
                                onDelete={canManage ? handleDelete : null}
                            />
                        ))
                    }
            </div>
            {showForm && <TaskForm 
                            task={editingTask as Task}
                            onCancel={handleCancel}
                            onSubmit={handleSubmit}/>}
        </div>
    )

}

export default KanbanBoard
