import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, useOrganization, CreateOrganization } from '@clerk/clerk-react';

const HomePage = () => {
  const { organization } = useOrganization();

  return (
    <div className="home-container">
      <h1 className="home-title">
        团队任务管理
        <span className="home-title-accent">化繁为简</span>
      </h1>
      <p className="home-subtitle">
        使用强大的任务看板，组织团队工作。
        创建，分配，并追踪整个团队的任务。
      </p>

      <SignedOut>
        <div className="home-buttons">
          <Link to="/sign-up" className="btn btn-primary btn-lg">
            免费开始
          </Link>
          <Link to="/sign-in" className="btn btn-outline btn-lg">
            登录
          </Link>
        </div>
      </SignedOut>

      <SignedIn>
        {organization ? (
          <Link to="/dashboard" className="btn btn-primary btn-lg">
            任务看板
          </Link>
        ) : (
          <div className="home-create-org">
            <CreateOrganization afterCreateOrganizationUrl="/dashboard" />
          </div>
        )}
      </SignedIn>
    </div>
  );
};

export default HomePage;
