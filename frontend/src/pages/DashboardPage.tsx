import { useState, useEffect } from 'react';
import KanbanBoard from '../components/KanbanBoard';

// 模拟任务数据
const mockTasks = [
  { id: '1', title: '设计知识库架构', description: '确定数据模型和API设计', status: 'completed', org_id: '1', created_by: '1', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: '2', title: '实现文档上传功能', description: '支持PDF、Word等格式', status: 'started', org_id: '1', created_by: '1', created_at: '2024-01-02', updated_at: '2024-01-02' },
  { id: '3', title: '集成向量数据库', description: '使用Milvus存储文档向量', status: 'pending', org_id: '1', created_by: '1', created_at: '2024-01-03', updated_at: '2024-01-03' },
  { id: '4', title: '开发AI问答接口', description: '基于Kimi大模型', status: 'pending', org_id: '1', created_by: '1', created_at: '2024-01-04', updated_at: '2024-01-04' },
];

const DashboardPage = () => {
  const [tasks, setTasks] = useState(mockTasks);
  const [loading, setLoading] = useState(false);

  // 模拟API调用
  const mockGetToken = async () => 'mock-token';

  const handleCreate = async (data: any) => {
    const newTask = {
      id: Date.now().toString(),
      ...data,
      org_id: '1',
      created_by: '1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks(prev => [...prev, newTask]);
    return newTask;
  };

  const handleUpdate = async (id: string, data: any) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data, updated_at: new Date().toISOString() } : t));
    return tasks.find(t => t.id === id);
  };

  const handleDelete = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    return true;
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">任务看板</h1>
          <p className="org-member">
            管理您的项目任务
          </p>
        </div>
      </div>
      {loading ? (
        <p className="text-muted">加载中...</p>
      ) : (
        <KanbanBoard
          tasks={tasks}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default DashboardPage;
