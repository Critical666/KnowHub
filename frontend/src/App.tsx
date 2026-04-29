import { Routes, Route, Navigate, Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Layout, Menu, Button } from 'antd';
import { DatabaseOutlined, ProjectOutlined, HomeOutlined } from '@ant-design/icons';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import PricingPage from './pages/PricingPage';
import KnowledgeBaseList from './components/KnowledgeBaseList';
import ChatInterface from './components/ChatInterface';

const { Header, Content } = Layout;

// 导航栏
function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  const items = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to="/">首页</Link>,
    },
    {
      key: '/dashboard',
      icon: <ProjectOutlined />,
      label: <Link to="/dashboard">任务看板</Link>,
    },
    {
      key: '/knowledge',
      icon: <DatabaseOutlined />,
      label: <Link to="/knowledge">知识库</Link>,
    },
  ];

  const getSelectedKey = () => {
    if (location.pathname.startsWith('/knowledge')) return '/knowledge';
    if (location.pathname === '/dashboard') return '/dashboard';
    return '/';
  };

  return (
    <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', background: '#001529' }}>
      <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginRight: '48px' }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>RAG知识库</Link>
      </div>
      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={[getSelectedKey()]}
        items={items}
        style={{ flex: 1, minWidth: 0 }}
      />
    </Header>
  );
}

// 主布局
function MainLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content>
        <Outlet />
      </Content>
    </Layout>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/knowledge" element={<KnowledgeBaseList />} />
        <Route path="/knowledge/:kbId/chat" element={<ChatInterface />} />
        <Route path="/pricing" element={<PricingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
