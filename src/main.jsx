import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Restore route after GitHub Pages 404 redirect
const redirect = new URLSearchParams(window.location.search).get('redirect')
if (redirect) {
  window.history.replaceState(null, '', '/sticker-album' + redirect)
}
import { AuthProvider } from './lib/AuthContext'
import { ProfileProvider } from './lib/ProfileContext'
import { StickersProvider } from './lib/StickersContext'
import { ChangelogProvider } from './lib/ChangelogContext'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ProfileProvider>
        <StickersProvider>
          <ChangelogProvider>
            <App />
          </ChangelogProvider>
        </StickersProvider>
      </ProfileProvider>
    </AuthProvider>
  </StrictMode>,
)
