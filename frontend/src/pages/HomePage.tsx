import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, useOrganization, CreateOrganization } from '@clerk/clerk-react';
import { 
  ProjectOutlined, 
  DatabaseOutlined, 
  RobotOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';

const features = [
  {
    icon: <ProjectOutlined />,
    title: '任务看板',
    description: '直观的看板视图，轻松管理任务状态。支持拖拽排序、优先级标记、团队协作。'
  },
  {
    icon: <DatabaseOutlined />,
    title: '知识库',
    description: '集中管理企业文档，支持多种格式上传。智能分类、快速检索、权限控制。'
  },
  {
    icon: <RobotOutlined />,
    title: 'AI 助手',
    description: '基于 RAG 技术的智能问答，让 AI 帮你从知识库中快速找到答案。'
  }
];

const HomePage = () => {
  const { organization } = useOrganization();

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero__grid" />
        
        <div className="home-hero__content">
          <SignedOut>
            <div className="home-hero__badge">
              <span className="home-hero__badge-dot" />
              免费开始使用
            </div>
          </SignedOut>
          
          <h1 className="home-hero__title">
            团队任务管理
            <span className="home-hero__title-accent">化繁为简</span>
          </h1>
          
          <p className="home-hero__subtitle">
            使用强大的任务看板和知识库，组织团队工作。
            创建、分配并追踪任务，让 AI 助手帮你从文档中找到答案。
          </p>

          <SignedOut>
            <div className="home-hero__actions">
              <Link to="/sign-up" className="home-hero__btn home-hero__btn--primary">
                免费开始
                <ArrowRightOutlined />
              </Link>
              <Link to="/sign-in" className="home-hero__btn home-hero__btn--secondary">
                登录
              </Link>
            </div>
          </SignedOut>

          <SignedIn>
            <div className="home-hero__signed-in">
              {organization ? (
                <Link to="/dashboard" className="home-hero__btn home-hero__btn--primary">
                  进入任务看板
                  <ArrowRightOutlined />
                </Link>
              ) : (
                <div className="home-hero__org-card">
                  <h3 className="home-hero__org-title">创建或加入组织</h3>
                  <p className="home-hero__org-text">
                    您需要创建或加入一个组织才能开始使用
                  </p>
                  <CreateOrganization 
                    afterCreateOrganizationUrl="/dashboard"
                    appearance={{
                      elements: {
                        rootBox: {
                          width: '100%'
                        },
                        card: {
                          background: 'transparent',
                          boxShadow: 'none',
                          border: '1px solid rgba(255,255,255,0.2)'
                        },
                        headerTitle: {
                          color: 'white'
                        },
                        headerSubtitle: {
                          color: '#94a3b8'
                        }
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </SignedIn>
        </div>
      </section>

      {/* Features Section */}
      <section className="home-features">
        <div className="home-features__container">
          <div className="home-features__header">
            <h2 className="home-features__title">强大功能，助力团队协作</h2>
            <p className="home-features__subtitle">
              集成任务管理、知识库和 AI 助手，打造高效团队工作流
            </p>
          </div>

          <div className="home-features__grid">
            {features.map((feature, index) => (
              <div key={index} className="home-feature-card">
                <div className="home-feature-card__icon">
                  {feature.icon}
                </div>
                <h3 className="home-feature-card__title">{feature.title}</h3>
                <p className="home-feature-card__description">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <p className="home-footer__text">
          © 2026 TaskBoard. 让团队协作更高效。
        </p>
      </footer>
    </div>
  );
};

export default HomePage;
