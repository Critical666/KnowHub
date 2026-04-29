import { SignUp } from '@clerk/clerk-react';
import { Card } from 'antd';

const SignUpPage = () => {
  return (
    <div className="auth-page">
      <Card className="auth-card">
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
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

export default SignUpPage;
