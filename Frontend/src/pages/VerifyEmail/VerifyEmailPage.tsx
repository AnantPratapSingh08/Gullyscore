// src/pages/VerifyEmail/VerifyEmailPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Shown when a user is logged in but email is not verified.
// Provides: Resend Verification, Refresh Status, Logout
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { auth } from '../../services/firebase'
import '../../styles/auth.css'

export default function VerifyEmailPage() {
  const { user, logout, resendVerification, error, clearError } = useAuth()
  const navigate = useNavigate()

  const [resendLoading, setResendLoading] = useState(false)
  const [refreshLoading, setRefreshLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)
  const [resendMsg, setResendMsg] = useState('')

  const handleResend = async () => {
    setResendLoading(true)
    setResendDone(false)
    clearError()
    await resendVerification()
    setResendLoading(false)
    setResendDone(true)
    setResendMsg('Verification email sent! Check your inbox and spam folder.')
  }

  const handleRefresh = async () => {
    setRefreshLoading(true)
    try {
      // Reload the user to pick up latest emailVerified status
      if (auth.currentUser) {
        await auth.currentUser.reload()
        if (auth.currentUser.emailVerified) {
          // Redirect to dashboard — AuthContext will pick up new state
          navigate('/dashboard', { replace: true })
        } else {
          setResendMsg('Email not verified yet. Please check your inbox.')
          setResendDone(true)
        }
      }
    } finally {
      setRefreshLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const email = user?.email ?? 'your email'

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
          <p className="auth-brand-tagline">Almost There!<br />One Last Step.</p>
          <p className="auth-brand-sub">
            We've sent a verification link to your email. Verify to start
            tracking runs, wickets, and every match moment.
          </p>
          <div className="auth-score-card">
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>Check Your Inbox</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                Verification email sent to:
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#22d3ee', marginTop: 4, wordBreak: 'break-all' }}>
                {email}
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

          <h1 className="auth-heading">Verify Your Email</h1>
          <p className="auth-subheading">
            A verification link was sent to <strong style={{ color: '#22d3ee' }}>{email}</strong>.
            Click the link to verify, then return here.
          </p>

          {/* Error banner */}
          {error && (
            <div className="auth-error" role="alert">
              <span className="auth-error-icon">⚠️</span>
              <span>{error}</span>
              <button className="auth-error-close" onClick={clearError} aria-label="Dismiss">×</button>
            </div>
          )}

          {/* Success message */}
          {resendDone && !error && (
            <div className="auth-success" style={{
              background: 'rgba(52,211,153,0.1)',
              border: '1px solid rgba(52,211,153,0.3)',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 13,
              color: '#34d399',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              ✅ {resendMsg}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {/* Refresh status */}
            <button
              id="refresh-verification-btn"
              className="auth-btn auth-btn--primary"
              onClick={handleRefresh}
              disabled={refreshLoading}
            >
              {refreshLoading
                ? <><span className="auth-spinner" /> Checking…</>
                : '🔄 Refresh Verification Status'}
            </button>

            {/* Resend email */}
            <button
              id="resend-verification-btn"
              className="auth-btn auth-btn--google"
              onClick={handleResend}
              disabled={resendLoading}
            >
              {resendLoading
                ? <><span className="auth-spinner" /> Sending…</>
                : '📩 Resend Verification Email'}
            </button>

            {/* Logout */}
            <button
              id="verify-logout-btn"
              type="button"
              className="auth-btn auth-btn--google"
              onClick={handleLogout}
              style={{ marginTop: 8, opacity: 0.7 }}
            >
              🚪 Logout
            </button>
          </div>

          <div style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: '#94a3b8' }}>Didn't receive the email?</strong><br />
              Check your spam/junk folder. If it's not there, click Resend above.
              Make sure you're checking the inbox for <span style={{ color: '#22d3ee' }}>{email}</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
