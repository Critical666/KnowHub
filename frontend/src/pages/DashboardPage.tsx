import { useOrganization, CreateOrganization } from '@clerk/clerk-react';
import { useTasks } from '../hooks';
import KanbanBoard from '../components/KanbanBoard';

interface DashboardPageProps {
  getToken: () => Promise<string | null>;
}

const DashboardPage = ({ getToken }: DashboardPageProps) => {
  const { organization } = useOrganization({ memberships: { infinite: true } });
  const { tasks, loading, error, refetch, create, update, remove } = useTasks(getToken);

  const memberCount = organization?.membersCount ?? 0;

  if (!organization) {
    return (
      <div className="dashboard-container">
        <div className="no-org-container">
          <h1 className="no-org-title">欢迎来到任务面板</h1>
          <p className="no-org-text">
            创建或者加入组织，以开始管理团队任务
          </p>
          <CreateOrganization afterCreateOrganizationUrl="/dashboard" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">{organization.name}</h1>
          <p className="org-member">
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      {loading ? (
        <p className="text-muted">加载中</p>
      ) : error ? (
        <div className="card-error">
          <p className="text-error text-error-title">加载失败</p>
          <p className="text-error text-error-message">{error}</p>
          <button className="btn btn-primary" onClick={refetch}>
            重试
          </button>
        </div>
      ) : (
        <KanbanBoard
          tasks={tasks}
          onCreate={create}
          onUpdate={update}
          onDelete={remove}
        />
      )}
    </div>
  );
};

export default DashboardPage;
