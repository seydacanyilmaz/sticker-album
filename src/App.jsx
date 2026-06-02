// App.jsx
// Root component. Handles routing between pages.
// If the user is not logged in, they see the Login page.
// If they are logged in, they can access the app's pages.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { supabase } from './lib/supabaseClient'
import Login from './pages/Login'

// ProtectedRoute wraps any page that requires login.
// If the user is not logged in, it redirects them to the login page.
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  // While we're checking for an existing session, show nothing
  if (loading) return null

  // If there's no user, redirect to login
  if (!user) return <Navigate to="/login" />

  // Otherwise render the page
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  // While checking for an existing session, show nothing
  if (loading) return null

  return (
    <BrowserRouter>
      <Routes>
        {/* Login page — redirect to dashboard if already logged in */}
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <Login />}
        />

        {/* Dashboard — protected, requires login */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>
                <p>Dashboard (coming soon)</p>
                <button onClick={() => supabase.auth.signOut()}>Sign out</button>
              </div>
            </ProtectedRoute>
          }
        />

        {/* Catch all unknown URLs and redirect to home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}