import { useState, useEffect } from 'react';
import { useAuth, useOrganization, CreateOrganization } from '@clerk/clerk-react';
import { getTasks } from '../services/api';
import KanbanBoard from '../components/KanbanBoard';
import type { Task } from '../types';

const DashboardPage = () => {
  const { getToken } = useAuth();
  const { organization } = useOrganization({ memberships: { infinite: true } });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const memberCount = organization?.membersCount ?? 0;
  const orgId = organization?.id;

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getTasks(getToken);
        if (!cancelled) {
          setTasks(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgId, getToken]);

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
        </div>
      ) : (
        <KanbanBoard tasks={tasks} setTasks={setTasks} getToken={getToken} />
      )}
    </div>
  );
};

export default DashboardPage;
