// src/components/team/AppShell.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared authenticated layout shell with:
// • Tournament switcher dropdown in the navbar
// • Mobile-responsive hamburger menu
// • User avatar chip + logout
// • Global search button
// • Notification bell with unread count
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useActiveTournament } from '../../context/ActiveTournamentContext'
import {
  subscribeToNotifications,
  markAllNotificationsRead,
  deleteNotification,
  NOTIF_ICON,
  type Notification,
} from '../../services/notificationService'

interface AppShellProps {
  children: React.ReactNode
}

// ── Tournament Switcher ────────────────────────────────────────────────────────
function TournamentSwitcher() {
  const {
    joinedTournaments, activeTournament, activeTournamentId,
    setActiveTournamentId,
  } = useActiveTournament()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (joinedTournaments.length === 0) {
    return (
      <div className="ts-empty">
        <span className="ts-empty-icon">🎯</span>
        <span className="ts-empty-text">No Tournament</span>
      </div>
    )
  }

  return (
    <div className="ts-wrap" ref={ref}>
      <button
        className="ts-trigger"
        onClick={() => setOpen(v => !v)}
        type="button"
        id="tournament-switcher-btn"
      >
        <span className="ts-logo">{activeTournament?.logo ?? '🏆'}</span>
        <span className="ts-name">{activeTournament?.name ?? 'Select Tournament'}</span>
        <svg
          className={`ts-chevron ${open ? 'ts-chevron--open' : ''}`}
          width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="ts-dropdown">
          <div className="ts-dropdown-label">My Tournaments</div>
          {joinedTournaments.map(t => (
            <button
              key={t.id}
              className={`ts-option ${t.id === activeTournamentId ? 'ts-option--active' : ''}`}
              onClick={() => { setActiveTournamentId(t.id); setOpen(false) }}
              type="button"
            >
              <span className="ts-option-logo">{t.logo}</span>
              <div className="ts-option-info">
                <span className="ts-option-name">{t.name}</span>
                <span className="ts-option-status">{t.status}</span>
              </div>
              {t.id === activeTournamentId && (
                <span className="ts-option-check">✓</span>
              )}
            </button>
          ))}
          <div className="ts-dropdown-divider" />
          <NavLink
            to="/tournaments"
            className="ts-manage-link"
            onClick={() => setOpen(false)}
          >
            ⚙ Manage Tournaments
          </NavLink>
        </div>
      )}
    </div>
  )
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export function AppShell({ children }: AppShellProps) {
  const { user, userProfile, logout } = useAuth()
  const navigate = useNavigate()
  const { activeTournamentId } = useActiveTournament()
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs]       = useState(false)
  const notifsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToNotifications(user.uid, setNotifications)
    return unsub
  }, [user])

  // Close notification panel on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

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
    { to: '/dashboard',                              label: 'Home',        icon: '🏠' },
    { to: '/matches',                                label: 'Matches',     icon: '🏏' },
    { to: '/teams',                                  label: 'Teams',       icon: '🏆' },
    { to: '/leaderboard',                            label: 'Leaderboard', icon: '🥇' },
    { to: '/tournaments',                            label: 'Tournaments', icon: '🎯' },
    { to: '/profile',                                label: 'Profile',     icon: '👤' },
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

          {/* Tournament Switcher */}
          <TournamentSwitcher />

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

          {/* Right side: search + notifications + avatar + logout */}
          <div className="shell-nav-right">
            {/* Search */}
            <button
              className="shell-icon-btn"
              onClick={() => navigate('/search')}
              title="Search"
              aria-label="Search"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Notification bell */}
            <div className="shell-notifs-wrap" ref={notifsRef}>
              <button
                className="shell-icon-btn shell-bell-btn"
                onClick={() => { setShowNotifs(v => !v); if (!showNotifs && user) markAllNotificationsRead(user.uid) }}
                title="Notifications"
                aria-label="Notifications"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="shell-notif-badge">
                    {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="shell-notifs-panel">
                  <div className="shell-notifs-header">
                    <span className="shell-notifs-title">🔔 Notifications</span>
                    {notifications.length > 0 && (
                      <button className="shell-notifs-clear" onClick={() => user && markAllNotificationsRead(user.uid)}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="shell-notifs-empty">No notifications yet</div>
                  ) : (
                    <div className="shell-notifs-list">
                      {notifications.slice(0, 12).map(n => (
                        <div key={n.id} className={`shell-notif-item${n.read ? ' shell-notif-item--read' : ''}`}>
                          <span className="shell-notif-icon">{NOTIF_ICON[n.type]}</span>
                          <div className="shell-notif-body">
                            <div className="shell-notif-item-title">{n.title}</div>
                            <div className="shell-notif-item-msg">{n.message}</div>
                          </div>
                          <button
                            className="shell-notif-del"
                            onClick={() => user && deleteNotification(user.uid, n.id)}
                            aria-label="Dismiss"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

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

        {/* Tournament banner — shows active tournament name on mobile */}
        {activeTournamentId && (
          <div className="shell-tournament-bar">
            <TournamentSwitcher />
          </div>
        )}

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
