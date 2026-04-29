import { SignUp } from '@clerk/clerk-react';

const SignUpPage = () => {
  return (
    <div style={{ 
      width: '100%', 
      maxWidth: '400px',
      margin: '0 auto'
    }}>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        afterSignUpUrl="/dashboard"
        appearance={{
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
        }}
      />
    </div>
  );
};

export default SignUpPage;
