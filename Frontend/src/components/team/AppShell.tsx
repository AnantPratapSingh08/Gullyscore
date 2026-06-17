// src/components/team/AppShell.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared layout shell for all authenticated team pages.
// Contains the sticky navbar with navigation links + logout.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { user, userProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const displayName =
    userProfile?.name ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Player'

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

  const navLinks = [
    { to: '/dashboard',   label: 'Dashboard',   icon: '📊' },
    { to: '/teams',       label: 'Teams',       icon: '🏆' },
    { to: '/my-teams',    label: 'My Teams',    icon: '👥' },
    { to: '/matches',     label: 'Matches',     icon: '🏏' },
    { to: '/leaderboard', label: 'Leaderboard', icon: '🥇' },
    { to: '/tournaments', label: 'Tournaments', icon: '🎯' },
    { to: '/profile',     label: 'Profile',     icon: '👤' },
  ]

  return (
    <div className="app-shell">
      {/* Background orbs */}
      <div className="shell-orbs">
        <div className="shell-orb shell-orb-1" />
        <div className="shell-orb shell-orb-2" />
        <div className="shell-orb shell-orb-3" />
      </div>

      {/* Sticky navbar */}
      <nav className="shell-navbar">
        <div className="shell-navbar-inner">
          {/* Logo */}
          <NavLink to="/dashboard" className="shell-logo">
            <span className="shell-logo-icon">🏏</span>
            <span className="shell-logo-text">GullyScore</span>
          </NavLink>

          {/* Desktop nav links */}
          <ul className="shell-nav-links">
            {navLinks.map(link => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) => `shell-nav-link ${isActive ? 'shell-nav-link--active' : ''}`}
                >
                  <span className="shell-nav-link-icon">{link.icon}</span>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Right side: avatar + logout */}
          <div className="shell-nav-right">
            <NavLink to="/profile" className="shell-user-chip" title="View Profile">
              <div className="shell-avatar">{initials}</div>
              <span className="shell-username">{displayName}</span>
            </NavLink>
            <button
              id="shell-logout-btn"
              className="shell-logout-btn"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Logout"
            >
              {loggingOut ? (
                <span className="team-spinner" style={{ width: 14, height: 14 }} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              className={`shell-hamburger ${mobileMenuOpen ? 'open' : ''}`}
              onClick={() => setMobileMenuOpen(v => !v)}
              aria-label="Toggle menu"
            >
              <span /><span /><span />
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="shell-mobile-menu">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `shell-mobile-link ${isActive ? 'shell-mobile-link--active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>{link.icon}</span> {link.label}
              </NavLink>
            ))}
            <button className="shell-mobile-logout" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        )}
      </nav>

      {/* Page content */}
      <main className="shell-content">
        {children}
      </main>
    </div>
  )
}
