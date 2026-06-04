// App.jsx
// Root component. Handles routing between pages.
// ProtectedRoute ensures unauthenticated users are redirected to login.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { supabase } from './lib/supabaseClient'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import RecordNew from './pages/RecordNew'
import RecordTrade from './pages/RecordTrade'
import RecordDonated from './pages/RecordDonated'
import MyStickers from './pages/MyStickers'
import Help from './pages/Help'
import Layout from './components/Layout'

// ProtectedRoute wraps any page that requires login.
// If the user is not logged in, it redirects them to the login page.
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return null

  return (
    <BrowserRouter basename="/sticker-album">
      <Routes>
        {/* Login page — redirect to dashboard if already logged in */}
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <Login />}
        />

        {/* All protected pages are wrapped in ProtectedRoute and Layout */}
        <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/record-new" element={<ProtectedRoute><Layout><RecordNew /></Layout></ProtectedRoute>} />
        <Route path="/record-trade" element={<ProtectedRoute><Layout><RecordTrade /></Layout></ProtectedRoute>} />
        <Route path="/record-donated" element={<ProtectedRoute><Layout><RecordDonated /></Layout></ProtectedRoute>} />
        <Route path="/my-stickers" element={<ProtectedRoute><Layout><MyStickers /></Layout></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute><Layout><Help /></Layout></ProtectedRoute>} />

        {/* Catch all unknown URLs and redirect to home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}