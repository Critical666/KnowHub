import { Link } from 'react-router-dom';
import { 
  DatabaseOutlined, 
  FileTextOutlined, 
  RobotOutlined,
  ArrowRightOutlined,
  CloudUploadOutlined,
  SearchOutlined,
  MessageOutlined
} from '@ant-design/icons';

const features = [
  {
    icon: <CloudUploadOutlined />,
    title: '文档上传与管理',
    description: '支持 PDF、Word、TXT、Markdown 等多种格式。自动文档解析与分段，安全的文件存储与管理。'
  },
  {
    icon: <DatabaseOutlined />,
    title: '智能知识库构建',
    description: '基于 BGE Embedding 的向量检索，Milvus 向量数据库存储，高效的语义相似度匹配。'
  },
  {
    icon: <RobotOutlined />,
    title: 'AI 智能问答',
    description: '基于 Kimi 大模型的智能回答，上下文感知的对话体验，答案可追溯原文出处。'
  }
];

const techStack = [
  { name: 'FastAPI', desc: '高性能后端框架' },
  { name: 'React', desc: '现代化前端' },
  { name: 'Milvus', desc: '向量数据库' },
  { name: 'Kimi', desc: '大语言模型' },
];

const HomePage = () => {
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero__grid" />
        
        <div className="home-hero__content">
          <div className="home-hero__badge">
            <span className="home-hero__badge-dot" />
            基于 RAG 技术
          </div>
          
          <h1 className="home-hero__title">
            智能知识库
            <span className="home-hero__title-accent">管理系统</span>
          </h1>
          
          <p className="home-hero__subtitle">
            上传文档，构建知识库，让 AI 助手为您快速找到答案。
            基于检索增强生成（RAG）技术的企业文档智能问答平台。
          </p>

          <div className="home-hero__actions">
            <Link to="/knowledge" className="home-hero__btn home-hero__btn--primary">
              立即体验
              <ArrowRightOutlined />
            </Link>
            <Link to="/dashboard" className="home-hero__btn home-hero__btn--secondary">
              任务看板
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="home-features">
        <div className="home-features__container">
          <div className="home-features__header">
            <h2 className="home-features__title">核心功能</h2>
            <p className="home-features__subtitle">
              完整的 RAG 解决方案，让文档管理和知识检索变得简单高效
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

      {/* Tech Stack Section */}
      <section className="home-tech">
        <div className="home-tech__container">
          <h2 className="home-tech__title">技术架构</h2>
          <div className="home-tech__grid">
            {techStack.map((tech, index) => (
              <div key={index} className="home-tech-item">
                <div className="home-tech-item__name">{tech.name}</div>
                <div className="home-tech-item__desc">{tech.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="home-cta">
        <div className="home-cta__content">
          <h2 className="home-cta__title">开始构建您的知识库</h2>
          <p className="home-cta__subtitle">
            无需登录，立即体验完整的 RAG 功能
          </p>
          <Link to="/knowledge" className="home-hero__btn home-hero__btn--primary">
            开始使用
            <ArrowRightOutlined />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <p className="home-footer__text">
          © 2026 RAG知识库. 基于检索增强生成技术的企业文档智能问答平台。
        </p>
      </footer>
    </div>
  );
};

export default HomePage;
