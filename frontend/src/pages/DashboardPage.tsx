import { useState, useEffect } from "react"
import { useAuth, useOrganization, CreateOrganization } from "@clerk/clerk-react"
import { getTask } from "../services/api"
import KanbanBoard from "../components/KanbanBoard"


const DashboardPage = () => {
    const {getToken} = useAuth()
    const {organization} = useOrganization(
        {memberships:{infinite:true}}
    )
    const [tasks, setTasks] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const memberCount = organization?.membersCount ?? 0
    const orgId = organization?.id

    useEffect(() => {
        if (!orgId) {
            setLoading(false)
            return
        }

        let cancelled = false

        ;(async () => {
            try {
                setLoading(true)
                setError(null)
                const data = await getTask(getToken)
                if (!cancelled) {
                    setTasks(Array.isArray(data) ? data : [])
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err.message)
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        })()

        return () => {
            cancelled = true
        }
    }, [orgId])

    if(!organization) {
        return (
            <div className={"dashboard-container"}>
                <div className={"no-org-container"}>
                    <h1 className={"no-org-title"}>欢迎来到任务面板</h1>
                    <p className={"no-org-text"}>
                        创建或者加入组织，以开始管理团队任务
                    </p>
                    <CreateOrganization afterCreateOrganizationUrl={"/dashboard"}/>
                </div>

            </div>
        )
    }

    return (
        <div className={"dashboard-container"}>
            <div className={"dashboard-header"}>
                <div>
                    <h1 className={"dashboard-title"}>{organization.name}</h1>
                    <p className={"org-member"}>
                        {memberCount} member{memberCount !== 1 ? "s" : ""}
                    </p>
                </div>
            </div>
            {
                loading ? (
                    <p className={"text-muted"}>加载中</p>
                ): error ? (
                    <div className={"card-error"}>
                        <p className={"text-error text-error-title"}> 加载失败 </p>
                        <p className={"text-error text-error-message"}> {error} </p>
                    </div>
                ): (
                    <KanbanBoard
                        tasks={tasks}
                        setTasks={setTasks}
                        getToken={getToken}
                    />
                )
            }
        </div>
    )
}

export default DashboardPage