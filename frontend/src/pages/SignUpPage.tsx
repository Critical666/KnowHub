import { SignUp } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const SignUpPage = () => {
  const navigate = useNavigate();

  return (
    <div className="auth-container">
      <SignUp
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: {
              width: '100%',
              maxWidth: '400px',
              margin: '0 auto'
            },
            card: {
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: '32px',
              width: '100%'
            },
            headerTitle: {
              fontSize: '24px',
              fontWeight: 600,
              color: '#1f2937',
              textAlign: 'center'
            },
            headerSubtitle: {
              color: '#6b7280',
              textAlign: 'center'
            },
            formButtonPrimary: {
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              fontSize: '16px',
              height: '48px',
              borderRadius: '8px',
              width: '100%'
            },
            formFieldLabel: {
              color: '#374151',
              fontSize: '14px',
              fontWeight: 500
            },
            formFieldInput: {
              borderRadius: '8px',
              borderColor: '#e5e7eb',
              height: '44px'
            },
            footerActionLink: {
              color: '#6366f1',
              fontWeight: 500
            },
            dividerRow: {
              display: 'none'
            },
            socialButtonsBlockButton: {
              borderRadius: '8px',
              height: '44px'
            }
          }
        }}
      />
    </div>
  );
};

export default SignUpPage;
