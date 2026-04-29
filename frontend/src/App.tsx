import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, useUser, UserButton, OrganizationSwitcher } from '@clerk/clerk-react';
import { Layout, Menu, Button } from 'antd';
import { DatabaseOutlined, ProjectOutlined } from '@ant-design/icons';
import HomePage from './pages/HomePage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import PricingPage from './pages/PricingPage';
import KnowledgeBaseList from './components/KnowledgeBaseList';
import ChatInterface from './components/ChatInterface';

const { Header, Content } = Layout;

// 未登录时的导航栏
function UnsignedHeader() {
  const navigate = useNavigate();

  return (
    <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
      <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginRight: '48px' }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>TaskBoard</Link>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Button type="link" style={{ color: 'white' }} onClick={() => navigate('/pricing')}>
          定价
        </Button>
        <Button type="default" onClick={() => navigate('/sign-in')}>
          登录
        </Button>
        <Button type="primary" onClick={() => navigate('/sign-up')}>
          注册
        </Button>
      </div>
    </Header>
  );
}

// 已登录时的导航栏
function SignedInHeader() {
  const location = useLocation();

  const items = [
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
    return '/dashboard';
  };

  return (
    <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
      <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginRight: '48px' }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>TaskBoard</Link>
      </div>
      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={[getSelectedKey()]}
        items={items}
        style={{ flex: 1, minWidth: 0 }}
      />
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link to="/pricing" style={{ color: 'white', textDecoration: 'none', marginRight: '8px' }}>
          定价
        </Link>
        <OrganizationSwitcher
          hidePersonal
          afterCreateOrganizationUrl="/dashboard"
          afterSelectOrganizationUrl="/dashboard"
          appearance={{
            elements: {
              organizationSwitcherTrigger: {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: 'white',
              },
              organizationPreviewText: {
                color: 'white',
              },
            },
          }}
        />
        <UserButton />
      </div>
    </Header>
  );
}

// 首页组件 - 根据登录状态显示不同内容
function HomeRoute() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <UnsignedHeader />
      <Content>
        <HomePage />
      </Content>
    </>
  );
}

function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Routes>
        {/* 未登录路由 */}
        <Route path="/" element={<HomeRoute />} />
        <Route
          path="/sign-in"
          element={
            <>
              <UnsignedHeader />
              <Content
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                }}
              >
                <SignInPage />
              </Content>
            </>
          }
        />
        <Route
          path="/sign-up"
          element={
            <>
              <UnsignedHeader />
              <Content
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                }}
              >
                <SignUpPage />
              </Content>
            </>
          }
        />
        {/* 定价页面 - 公共访问 */}
        <Route
          path="/pricing"
          element={
            <>
              <SignedIn>
                <SignedInHeader />
              </SignedIn>
              <SignedOut>
                <UnsignedHeader />
              </SignedOut>
              <Content
                style={{
                  background: '#f0f2f5',
                  minHeight: 'calc(100vh - 64px)',
                  padding: '24px',
                }}
              >
                <PricingPage />
              </Content>
            </>
          }
        />

        {/* 已登录路由 */}
        <Route
          path="/dashboard"
          element={
            <SignedIn>
              <SignedInHeader />
              <Content style={{ background: '#f0f2f5', minHeight: 'calc(100vh - 64px)' }}>
                <DashboardPage />
              </Content>
            </SignedIn>
          }
        />
        <Route
          path="/knowledge"
          element={
            <SignedIn>
              <SignedInHeader />
              <Content style={{ background: '#f0f2f5', minHeight: 'calc(100vh - 64px)' }}>
                <KnowledgeBaseList />
              </Content>
            </SignedIn>
          }
        />
        <Route
          path="/knowledge/:kbId/chat"
          element={
            <SignedIn>
              <SignedInHeader />
              <Content style={{ background: '#f0f2f5', minHeight: 'calc(100vh - 64px)' }}>
                <ChatInterface />
              </Content>
            </SignedIn>
          }
        />

        {/* 默认重定向 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
