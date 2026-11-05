import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { getMerchantOnboarding, getSession, signOut, type AuthUser } from './lib/auth'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import AdminPanel from './pages/AdminPanel'
import AppShell from './pages/AppShell'
import Onboarding from './pages/Onboarding'

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null)
  const [sessionError, setSessionError] = useState('')
  const [onboardingStatusError, setOnboardingStatusError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    async function restoreSession() {
      try {
        const currentUser = await getSession()
        if (!active) return
        setUser(currentUser)

        if (!currentUser || currentUser.role === 'admin') {
          setOnboardingComplete(true)
          return
        }

        try {
          const profile = await getMerchantOnboarding()
          if (!active) return
          setOnboardingComplete(profile.isOnboardingComplete)
          setOnboardingStatusError('')
        } catch (error) {
          if (!active) return
          setOnboardingComplete(false)
          setOnboardingStatusError(error instanceof Error ? error.message : 'Could not verify onboarding status.')
        }
      } catch (error) {
        if (!active) return
        setSessionError(error instanceof Error ? error.message : 'Could not verify your session.')
      } finally {
        if (active) setCheckingSession(false)
      }
    }

    void restoreSession()
    return () => {
      active = false
    }
  }, [])

  async function handleLogin(nextUser: AuthUser) {
    setUser(nextUser)
    setCheckingSession(true)
    setSessionError('')
    setOnboardingStatusError('')

    if (nextUser.role === 'admin') {
      setOnboardingComplete(true)
      setCheckingSession(false)
      navigate('/admin', { replace: true })
      return
    }

    try {
      const profile = await getMerchantOnboarding()
      setOnboardingComplete(profile.isOnboardingComplete)
      navigate(profile.isOnboardingComplete ? '/dashboard' : '/onboarding', { replace: true })
    } catch (error) {
      setOnboardingComplete(false)
      setOnboardingStatusError(error instanceof Error ? error.message : 'Could not verify onboarding status.')
      navigate('/onboarding', { replace: true })
    } finally {
      setCheckingSession(false)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
    } finally {
      setUser(null)
      setOnboardingComplete(null)
      setOnboardingStatusError('')
      navigate('/login', { replace: true })
    }
  }

  function completeOnboarding() {
    setOnboardingComplete(true)
    setOnboardingStatusError('')
    navigate('/dashboard', { replace: true })
  }

  if (checkingSession) {
    return <div className="app-loading"><span className="spinner" /> Checking your secure workspace…</div>
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          user
            ? <Navigate to={user.role === 'admin' ? '/admin' : onboardingComplete ? '/dashboard' : '/onboarding'} replace />
            : <LoginPage onLogin={handleLogin} sessionError={sessionError} />
        }
      />
      <Route
        path="/admin"
        element={
          !user
            ? <Navigate to="/login" replace />
            : user.role === 'admin'
              ? <AdminPanel user={user} onSignOut={handleSignOut} />
              : <Navigate to={onboardingComplete ? '/dashboard' : '/onboarding'} replace />
        }
      />
      <Route
        path="/onboarding"
        element={
          !user
            ? <Navigate to="/login" replace />
            : user.role === 'admin'
              ? <Navigate to="/admin" replace />
              : onboardingComplete
                ? <Navigate to="/dashboard" replace />
                : <Onboarding onComplete={completeOnboarding} setupLoadError={onboardingStatusError} />
        }
      />
      <Route
        path="/dashboard"
        element={
          !user
            ? <Navigate to="/login" replace />
            : user.role === 'admin'
              ? <Navigate to="/admin" replace />
              : onboardingComplete
                ? <AppShell user={user} onSignOut={handleSignOut} />
                : <Navigate to="/onboarding" replace />
        }
      />
      <Route
        path="*"
        element={
          !user
            ? <Navigate to="/login" replace />
            : user.role === 'admin'
              ? <Navigate to="/admin" replace />
              : <Navigate to={onboardingComplete ? '/dashboard' : '/onboarding'} replace />
        }
      />
    </Routes>
  )
}
