// src/pages/Login/LoginPage.tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../styles/auth.css'

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginPage() {
  const { login, loginWithGoogle, forgotPassword, error, clearError, loading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Forgot-password panel state
  const [showForgot, setShowForgot]     = useState(false)
  const [forgotEmail, setForgotEmail]   = useState('')
  const [forgotSent, setForgotSent]     = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    clearError()
    setSubmitting(true)
    await login(email, password)
    setSubmitting(false)
    // onAuthStateChanged in AuthContext will update user; navigate on success
    // We check by trying — if no error thrown the user state updates
  }

  // Navigate after successful login — watch user via effect handled in App routing
  // We rely on ProtectedRoute redirect logic; just attempt login here.

  const handleGoogle = async () => {
    setGoogleLoading(true)
    clearError()
    await loginWithGoogle()
    setGoogleLoading(false)
  }

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    await forgotPassword(forgotEmail)
    setForgotLoading(false)
    if (!error) setForgotSent(true)
  }

  return (
    <div className="auth-page">
      {/* Background orbs */}
      <div className="auth-orbs">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
      </div>

      {/* Left brand panel */}
      <div className="auth-brand-panel">
        <div className="auth-brand-inner">
          <a href="/" className="auth-brand-logo">
            <span className="auth-brand-logo-icon">🏏</span>
            <span className="auth-brand-logo-text">GullyScore</span>
          </a>
          <p className="auth-brand-tagline">Track Every Run.<br />Every Wicket.<br />Every Match.</p>
          <p className="auth-brand-sub">
            The ultimate stats platform for gully cricket legends.
            Record scores, track performance, relive every moment.
          </p>
          <div className="auth-score-card">
            <div className="auth-score-live">
              <span className="auth-score-live-dot" />
              LIVE
            </div>
            <div className="auth-score-runs">247<span style={{ fontSize: 22, color: '#94a3b8', margin: '0 4px' }}>/</span><span style={{ fontSize: 26, color: '#f59e0b' }}>4</span></div>
            <div className="auth-score-detail">(38.2 overs) • RRR: 8.4</div>
            <div className="auth-score-teams">
              <div className="auth-score-team">
                Gully XI
                <span>Batting</span>
              </div>
              <div className="auth-score-team" style={{ textAlign: 'right' }}>
                Street Stars
                <span>Bowling</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-form-panel">
        <div className="auth-form-card">
          {/* Mobile-only logo */}
          <a href="/" className="auth-mobile-logo">
            <span className="auth-mobile-logo-icon">🏏</span>
            <span className="auth-mobile-logo-text">GullyScore</span>
          </a>

          <h1 className="auth-heading">Welcome back</h1>
          <p className="auth-subheading">Sign in to your GullyScore account</p>

          {/* Error banner */}
          {error && (
            <div className="auth-error" role="alert">
              <span className="auth-error-icon">⚠️</span>
              <span>{error}</span>
              <button className="auth-error-close" onClick={clearError} aria-label="Dismiss">×</button>
            </div>
          )}

          {/* Forgot password panel */}
          {showForgot && (
            <div className="auth-forgot-panel">
              {forgotSent ? (
                <div className="auth-success">
                  ✅ Reset link sent! Check your email inbox.
                </div>
              ) : (
                <form onSubmit={handleForgot}>
                  <p>Enter your email and we'll send you a password reset link.</p>
                  <div className="auth-field">
                    <input
                      id="forgot-email"
                      type="email"
                      className="auth-input"
                      placeholder="your@email.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="auth-btn auth-btn--google"
                      style={{ flex: 1, marginTop: 0, fontSize: 13, padding: '10px 16px' }}
                      onClick={() => { setShowForgot(false); setForgotEmail('') }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="auth-btn auth-btn--primary"
                      style={{ flex: 2, marginTop: 0 }}
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? <span className="auth-spinner" /> : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleLogin} noValidate>
            <div className="auth-field">
              <label htmlFor="login-email" className="auth-label">Email</label>
              <input
                id="login-email"
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="login-password" className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input auth-input--with-icon"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="auth-input-icon"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="auth-forgot-row">
              <button
                type="button"
                className="auth-forgot-btn"
                onClick={() => { setShowForgot(true); setForgotSent(false) }}
              >
                Forgot password?
              </button>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="auth-btn auth-btn--primary"
              disabled={submitting || loading}
            >
              {submitting ? <><span className="auth-spinner" /> Signing in…</> : 'Sign In'}
            </button>
          </form>

          <div className="auth-divider">or continue with</div>

          <button
            id="login-google-btn"
            type="button"
            className="auth-btn auth-btn--google"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
          >
            {googleLoading
              ? <><span className="auth-spinner" /> Connecting…</>
              : <><GoogleIcon /> Sign in with Google</>}
          </button>

          <p className="auth-bottom">
            Don't have an account?{' '}
            <Link to="/signup">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
