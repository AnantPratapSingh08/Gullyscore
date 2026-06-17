// src/pages/Dashboard/DashboardPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Main dashboard — wrapped in AppShell, shows feature nav cards + quick stats.
// Every card has a working onClick → navigate() call.
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { AppShell } from '../../components/team/AppShell'
import '../../styles/dashboard.css'

// ── Nav Card data ─────────────────────────────────────────────────────────────

interface NavCard {
  id:       string
  icon:     string
  label:    string
  desc:     string
  route:    string
  accent:   string
  badge?:   string
}

const NAV_CARDS: NavCard[] = [
  {
    id:     'card-teams',
    icon:   '🏆',
    label:  'Team Management',
    desc:   'Create, edit, and manage your cricket teams. View rosters and invite codes.',
    route:  '/teams',
    accent: '#22d3ee',
  },
  {
    id:     'card-my-teams',
    icon:   '👥',
    label:  'My Teams',
    desc:   'See all teams you own or belong to. Join a new team via invite code.',
    route:  '/my-teams',
    accent: '#34d399',
  },
  {
    id:     'card-players',
    icon:   '🧑‍🤝‍🧑',
    label:  'Player Management',
    desc:   'Add, edit, and remove players. Track batting & bowling statistics per player.',
    route:  '/teams',
    accent: '#a78bfa',
  },
  {
    id:     'card-matches',
    icon:   '🏏',
    label:  'Match Management',
    desc:   'Schedule matches, record results, and track head-to-head records.',
    route:  '/matches',
    accent: '#f59e0b',
  },
  {
    id:     'card-live',
    icon:   '⚡',
    label:  'Live Scoring',
    desc:   'Ball-by-ball live scoring console. Open from any in-progress match.',
    route:  '/matches',
    accent: '#ef4444',
    badge:  'LIVE',
  },
  {
    id:     'card-leaderboard',
    icon:   '🥇',
    label:  'Leaderboard',
    desc:   'Real-time rankings — top scorers, wicket-takers, strike rates, and more.',
    route:  '/leaderboard',
    accent: '#a78bfa',
  },
  {
    id:     'card-tournaments',
    icon:   '🎯',
    label:  'Tournament Admin',
    desc:   'Organise and manage tournaments. Control brackets, teams, and schedules.',
    route:  '/tournaments',
    accent: '#22d3ee',
  },
  {
    id:     'card-profile',
    icon:   '👤',
    label:  'User Profile',
    desc:   'View your career stats, update your display name, and manage your account.',
    route:  '/profile',
    accent: '#f59e0b',
  },
]


// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, userProfile } = useAuth()
  const navigate = useNavigate()

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

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <AppShell>
      <div className="dash-page">

        {/* ── Welcome banner ───────────────────────────────────────────── */}
        <div className="dash-welcome">
          <div className="dash-welcome-avatar">{initials}</div>
          <div className="dash-welcome-text">
            <h1 className="dash-welcome-greeting">
              {greeting}, <span className="dash-welcome-name">{displayName}</span> 🏏
            </h1>
            <p className="dash-welcome-sub">
              {user?.email} · Ready to score some runs?
            </p>
          </div>
          <div className="dash-welcome-badge">GullyScore HQ</div>
        </div>

        {/* ── Section heading ──────────────────────────────────────────── */}
        <div className="dash-section-header">
          <h2 className="dash-section-title">Quick Access</h2>
          <p className="dash-section-sub">Click any card to navigate</p>
        </div>

        {/* ── Navigation cards grid ────────────────────────────────────── */}
        <div className="dash-cards-grid">
          {NAV_CARDS.map(card => (
            <button
              key={card.id}
              id={card.id}
              className="dash-nav-card"
              style={{ '--card-accent': card.accent } as React.CSSProperties}
              onClick={() => navigate(card.route)}
              type="button"
            >
              {/* Glow orb */}
              <div className="dash-nav-card-glow" />

              {/* Top row */}
              <div className="dash-nav-card-top">
                <div className="dash-nav-card-icon">{card.icon}</div>
                {card.badge && (
                  <span className="dash-nav-card-badge">{card.badge}</span>
                )}
              </div>

              {/* Label */}
              <h3 className="dash-nav-card-label">{card.label}</h3>

              {/* Description */}
              <p className="dash-nav-card-desc">{card.desc}</p>

              {/* Arrow */}
              <div className="dash-nav-card-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

      </div>
    </AppShell>
  )
}
