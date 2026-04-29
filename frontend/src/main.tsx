import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// 加载状态组件
function LoadingSpinner() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        border: '4px solid rgba(255,255,255,0.1)',
        borderTop: '4px solid #6366f1',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function Root() {
  const [clerkLoaded, setClerkLoaded] = useState(false)
  const [clerkError, setClerkError] = useState(false)

  useEffect(() => {
    // 给 Clerk 更多时间加载
    const timer = setTimeout(() => {
      if (!clerkLoaded) {
        console.warn('Clerk 加载超时，请检查网络连接')
        setClerkError(true)
      }
    }, 10000)

    return () => clearTimeout(timer)
  }, [clerkLoaded])

  if (clerkError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        color: 'white',
        padding: '24px',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '16px' }}>网络连接问题</h2>
        <p style={{ color: '#94a3b8', maxWidth: '400px' }}>
          无法连接到认证服务器。请检查您的网络连接，或稍后再试。
        </p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: '24px',
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          刷新页面
        </button>
      </div>
    )
  }

  return (
    <ClerkProvider 
      publishableKey={clerkPubKey}
      loaded={() => setClerkLoaded(true)}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
