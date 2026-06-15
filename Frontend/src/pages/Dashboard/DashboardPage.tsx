// src/pages/Dashboard/DashboardPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../styles/auth.css'

export default function DashboardPage() {
  const { user, userProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  // Resolve display name: Firestore profile → Firebase Auth displayName → email prefix
  const displayName =
    userProfile?.name ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Player'

  const email = user?.email ?? ''

  // Avatar initials
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="dashboard-page">
      {/* Background orbs */}
      <div className="dashboard-orbs">
        <div className="dashboard-orb dashboard-orb-1" />
        <div className="dashboard-orb dashboard-orb-2" />
      </div>

      {/* Sticky top nav */}
      <nav className="dashboard-navbar">
        <div className="dashboard-navbar-inner">
          <a href="/" className="dashboard-logo">
            <span className="dashboard-logo-icon">🏏</span>
            <span className="dashboard-logo-text">GullyScore</span>
          </a>
          <button
            id="dashboard-logout-btn"
            className="dashboard-logout-btn"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fca5a5', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} />
                Signing out…
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </>
            )}
          </button>
        </div>
      </nav>

      {/* Page body */}
      <main className="dashboard-body">
        {/* Welcome banner */}
        <div className="dashboard-welcome">
          <div className="dashboard-avatar" aria-label={`${displayName} avatar`}>
            {initials}
          </div>
          <div className="dashboard-welcome-text">
            <h1 className="dashboard-greeting">
              Welcome, <span>{displayName}</span> 🏏
            </h1>
            <p className="dashboard-email">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              {email}
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="dashboard-cards">
          {[
            { icon: '🏏', label: 'Matches Played', value: '0' },
            { icon: '⚡', label: 'Total Runs',     value: '0' },
            { icon: '🎯', label: 'Wickets Taken',  value: '0' },
            { icon: '🏆', label: 'Team Rank',      value: '—' },
          ].map(card => (
            <div key={card.label} className="dashboard-card">
              <div className="dashboard-card-icon">{card.icon}</div>
              <div className="dashboard-card-label">{card.label}</div>
              <div className="dashboard-card-value">{card.value}</div>
            </div>
          ))}
        </div>

        {/* Coming soon */}
        <div className="dashboard-coming-soon">
          <h3>🚀 More features coming soon</h3>
          <p>Live scoring, team management, player analytics and leaderboards are on the way.</p>
        </div>
      </main>
    </div>
  )
}
