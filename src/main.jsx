import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './lib/AuthContext'
import { ProfileProvider } from './lib/ProfileContext'
import { StickersProvider } from './lib/StickersContext'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ProfileProvider>
        <StickersProvider>
          <App />
        </StickersProvider>
      </ProfileProvider>
    </AuthProvider>
  </StrictMode>,
)
