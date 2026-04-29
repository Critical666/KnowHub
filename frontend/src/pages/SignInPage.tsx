import { SignIn } from '@clerk/clerk-react';
import { Card } from 'antd';

const SignInPage = () => {
  return (
    <div className="auth-page">
      <Card className="auth-card">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          appearance={{
            elements: {
              rootBox: {
                width: '100%'
              },
              card: {
                boxShadow: 'none',
                border: 'none',
                background: 'transparent'
              },
              headerTitle: {
                fontSize: '24px',
                fontWeight: 600
              },
              formButtonPrimary: {
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                fontSize: '16px',
                height: '44px'
              }
            }
          }}
        />
      </Card>
    </div>
  );
};

export default SignInPage;
