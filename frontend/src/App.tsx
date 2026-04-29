import { Routes, Route, Navigate, Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { SignedIn, SignedOut, useUser, useAuth, UserButton, OrganizationSwitcher, SignIn, SignUp } from '@clerk/clerk-react';
import { Layout, Menu, Button } from 'antd';
import { DatabaseOutlined, ProjectOutlined } from '@ant-design/icons';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import PricingPage from './pages/PricingPage';
import KnowledgeBaseList from './components/KnowledgeBaseList';
import ChatInterface from './components/ChatInterface';

const { Header, Content } = Layout;

// Clerk 外观配置
const clerkAppearance = {
  elements: {
    rootBox: {
      width: '100%'
    },
    card: {
      background: 'white',
      borderRadius: '16px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      padding: '32px'
    },
    headerTitle: {
      fontSize: '24px',
      fontWeight: 600
    },
    formButtonPrimary: {
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      fontSize: '16px',
      height: '48px'
    }
  }
};

// 未登录时的导航栏
function UnsignedHeader() {
  const navigate = useNavigate();

  return (
    <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', background: '#001529' }}>
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

// 首页布局
function HomeLayout() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <UnsignedHeader />
      <Content>
        <HomePage />
      </Content>
    </Layout>
  );
}

// 登录页面
function SignInPage() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <UnsignedHeader />
      <Content
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '400px', background: 'white', padding: '32px', borderRadius: '16px' }}>
          <SignIn
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/dashboard"
          />
        </div>
      </Content>
    </Layout>
  );
}

// 注册页面
function SignUpPage() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <UnsignedHeader />
      <Content
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '400px', background: 'white', padding: '32px', borderRadius: '16px' }}>
          <SignUp
            signInUrl="/sign-in"
            fallbackRedirectUrl="/dashboard"
          />
        </div>
      </Content>
    </Layout>
  );
}

// 定价页面布局
function PricingLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SignedIn>
        <SignedInHeader />
      </SignedIn>
      <SignedOut>
        <UnsignedHeader />
      </SignedOut>
      <Content style={{ background: '#f0f2f5', padding: '24px' }}>
        <PricingPage />
      </Content>
    </Layout>
  );
}

// 主布局（已登录）
function MainLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SignedInHeader />
      <Content style={{ background: '#f0f2f5' }}>
        <Outlet />
      </Content>
    </Layout>
  );
}

// Dashboard 包装组件
function DashboardPageWrapper() {
  const { getToken } = useAuth();
  return <DashboardPage getToken={getToken} />;
}

function App() {
  return (
    <Routes>
      {/* 首页 */}
      <Route path="/" element={<HomeLayout />} />
      
      {/* 认证页面 - 直接使用内联组件 */}
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      
      {/* 定价页面 */}
      <Route path="/pricing" element={<PricingLayout />} />
      
      {/* 已登录页面 */}
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<DashboardPageWrapper />} />
        <Route path="/knowledge" element={<KnowledgeBaseList />} />
        <Route path="/knowledge/:kbId/chat" element={<ChatInterface />} />
      </Route>
      
      {/* 默认重定向 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
