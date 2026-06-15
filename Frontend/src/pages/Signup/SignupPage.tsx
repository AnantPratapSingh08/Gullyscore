// src/pages/Signup/SignupPage.tsx
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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

// Password strength scorer
function getStrength(pwd: string): { score: number; label: string } {
  if (pwd.length === 0) return { score: 0, label: '' }
  let score = 0
  if (pwd.length >= 8)  score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (score <= 1) return { score: 1, label: 'Weak' }
  if (score <= 2) return { score: 2, label: 'Medium' }
  return { score: 3, label: 'Strong' }
}

export default function SignupPage() {
  const { signup, loginWithGoogle, error, clearError, loading } = useAuth()

  const [name, setName]                 = useState('')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [localError, setLocalError]     = useState<string | null>(null)

  const strength = getStrength(password)
  const strengthClass = strength.label.toLowerCase() as 'weak' | 'medium' | 'strong'

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault()
    clearError()
    setLocalError(null)

    if (password !== confirm) {
      setLocalError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    await signup(name.trim(), email.trim(), password)
    setSubmitting(false)
  }

  const handleGoogle = async () => {
    clearError()
    setLocalError(null)
    setGoogleLoading(true)
    await loginWithGoogle()
    setGoogleLoading(false)
  }

  const displayedError = localError ?? error

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
          <p className="auth-brand-tagline">Join Thousands of<br />Gully Cricket Legends</p>
          <p className="auth-brand-sub">
            Create your free account and start tracking every run,
            wicket, and milestone of your cricket journey.
          </p>
          <div className="auth-score-card">
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>📊 Community Stats</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Players', value: '1000+' },
                { label: 'Teams',   value: '100+' },
                { label: 'Matches', value: '500+' },
                { label: 'Runs',    value: '50K+' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 22, fontWeight: 900, background: 'linear-gradient(135deg,#22d3ee,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
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

          <h1 className="auth-heading">Create your account</h1>
          <p className="auth-subheading">Join the gully cricket community for free</p>

          {/* Error banner */}
          {displayedError && (
            <div className="auth-error" role="alert">
              <span className="auth-error-icon">⚠️</span>
              <span>{displayedError}</span>
              <button
                className="auth-error-close"
                onClick={() => { clearError(); setLocalError(null) }}
                aria-label="Dismiss"
              >×</button>
            </div>
          )}

          <form onSubmit={handleSignup} noValidate>
            {/* Name */}
            <div className="auth-field">
              <label htmlFor="signup-name" className="auth-label">Full Name</label>
              <input
                id="signup-name"
                type="text"
                className="auth-input"
                placeholder="Virat Sharma"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
                autoFocus
              />
            </div>

            {/* Email */}
            <div className="auth-field">
              <label htmlFor="signup-email" className="auth-label">Email</label>
              <input
                id="signup-email"
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="auth-field">
              <label htmlFor="signup-password" className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input auth-input--with-icon"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
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
              {/* Strength meter */}
              {password.length > 0 && (
                <div className="auth-strength">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`auth-strength-bar ${i <= strength.score ? strengthClass : ''}`}
                    />
                  ))}
                  <span className={`auth-strength-label ${strengthClass}`}>{strength.label}</span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="auth-field">
              <label htmlFor="signup-confirm" className="auth-label">Confirm Password</label>
              <div className="auth-input-wrap">
                <input
                  id="signup-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  className="auth-input auth-input--with-icon"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-input-icon"
                  onClick={() => setShowConfirm(v => !v)}
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              id="signup-submit-btn"
              type="submit"
              className="auth-btn auth-btn--primary"
              disabled={submitting || loading}
            >
              {submitting
                ? <><span className="auth-spinner" /> Creating account…</>
                : 'Create Account'}
            </button>
          </form>

          <div className="auth-divider">or sign up with</div>

          <button
            id="signup-google-btn"
            type="button"
            className="auth-btn auth-btn--google"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
          >
            {googleLoading
              ? <><span className="auth-spinner" /> Connecting…</>
              : <><GoogleIcon /> Sign up with Google</>}
          </button>

          <p className="auth-bottom">
            Already have an account?{' '}
            <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
