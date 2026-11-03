import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { getSession, signOut, type AuthUser } from './lib/auth'
import LoginPage from './pages/LoginPage'
import AppShell from './pages/AppShell'

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    getSession()
      .then(setUser)
      .catch((error: Error) => setSessionError(error.message))
      .finally(() => setCheckingSession(false))
  }, [])

  async function handleSignOut() {
    try { await signOut() } finally {
      setUser(null)
      navigate('/login', { replace: true })
    }
  }

  if (checkingSession) return <div className="app-loading"><span className="spinner" /> Checking your secure session…</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={setUser} sessionError={sessionError} />} />
      <Route path="/*" element={user ? <AppShell user={user} onSignOut={handleSignOut} /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}
