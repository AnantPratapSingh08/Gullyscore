import { useState, useEffect, useRef } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { LoginPage }    from './pages/Login'
import { SignupPage }   from './pages/Signup'
import { DashboardPage } from './pages/Dashboard'
import TeamsPage          from './pages/Teams/TeamsPage'
import MyTeamsPage        from './pages/Teams/MyTeamsPage'
import CreateTeamPage     from './pages/Teams/CreateTeamPage'
import TeamDetailPage     from './pages/Teams/TeamDetailPage'
import PlayersPage        from './pages/Players/PlayersPage'
import PlayerDetailPage   from './pages/Players/PlayerDetailPage'
import MatchesPage             from './pages/Matches/MatchesPage'
import MatchDetailPage         from './pages/Matches/MatchDetailPage'
import TournamentsPage         from './pages/Tournament/TournamentsPage'
import TournamentSettingsPage  from './pages/Tournament/TournamentSettingsPage'
import LiveScorePage           from './pages/LiveScore/LiveScorePage'
import LeaderboardPage         from './pages/Leaderboard/LeaderboardPage'
import ProfilePage             from './pages/Profile/ProfilePage'
import TournamentDetailPage    from './pages/Tournament/TournamentDetailPage'
import './App.css'

// ─────────────────────────────────────────────────────────────────────────────
// Landing page components (UNCHANGED from original)
// ─────────────────────────────────────────────────────────────────────────────

// ── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
      <div className="navbar__inner">
        <a href="#" className="navbar__logo">
          <span className="logo-icon">🏏</span>
          <span className="logo-text">GullyScore</span>
        </a>

        <ul className={`navbar__links${menuOpen ? ' open' : ''}`}>
          <li><a href="#home"     onClick={() => setMenuOpen(false)}>Home</a></li>
          <li><a href="#features" onClick={() => setMenuOpen(false)}>Features</a></li>
          <li><a href="#about"    onClick={() => setMenuOpen(false)}>About</a></li>
        </ul>

        <div className="navbar__actions">
          <NavbarAuthButton onMenuClose={() => setMenuOpen(false)} />
          <button
            className="hamburger"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen(v => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>
    </nav>
  )
}

/**
 * Smart auth button inside the navbar:
 * - If logged in  → "Dashboard" link
 * - If logged out → "Login" link
 */
function NavbarAuthButton({ onMenuClose }: { onMenuClose: () => void }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) return null

  if (user) {
    return (
      <button
        className="btn btn--outline"
        onClick={() => { onMenuClose(); navigate('/dashboard') }}
      >
        Dashboard
      </button>
    )
  }

  return (
    <button
      className="btn btn--outline"
      onClick={() => { onMenuClose(); navigate('/login') }}
    >
      Login
    </button>
  )
}

// ── Cricket Illustration ─────────────────────────────────────────────────────
function CricketIllustration() {
  return (
    <div className="cricket-glass">
      <div className="glass-glow" />
      <div className="cricket-scene">
        {/* Pitch */}
        <div className="pitch" />
        {/* Stumps */}
        <div className="stumps">
          <div className="stump" /><div className="stump" /><div className="stump" />
        </div>
        {/* Bat SVG */}
        <svg className="bat floating" viewBox="0 0 80 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="28" y="10" width="24" height="130" rx="12" fill="url(#batGrad)" />
          <rect x="33" y="140" width="14" height="50" rx="7" fill="#a16207" />
          <defs>
            <linearGradient id="batGrad" x1="28" y1="10" x2="52" y2="140" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fef9c3" />
              <stop offset="1" stopColor="#d97706" />
            </linearGradient>
          </defs>
        </svg>
        {/* Ball */}
        <div className="ball bouncing">
          <div className="ball-seam" />
        </div>
        {/* Score display */}
        <div className="score-chip">
          <span className="score-runs">247</span>
          <span className="score-sep">/</span>
          <span className="score-wkts">4</span>
          <span className="score-overs">(38.2 ov)</span>
        </div>
        {/* Live badge */}
        <div className="live-badge">
          <span className="live-dot" />
          LIVE
        </div>
      </div>
    </div>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function HeroSection() {
  const navigate = useNavigate()
  return (
    <section id="home" className="hero-section">
      <div className="hero-bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <div className="hero-inner">
        <div className="hero-text fade-in-up">
          <div className="hero-badge">🏏 Gully Cricket, Reimagined</div>
          <h1 className="hero-title">
            Track Every <span className="highlight">Run.</span><br />
            Every <span className="highlight">Wicket.</span><br />
            Every <span className="highlight-gold">Match.</span>
          </h1>
          <p className="hero-sub">
            The ultimate stats platform built for gully cricket legends.
            Record scores, track performance, and relive every moment.
          </p>
          <div className="hero-buttons">
            <button className="btn btn--primary" onClick={() => navigate('/signup')}>
              Get Started
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <a href="#features" className="btn btn--ghost">
              Explore Stats
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </a>
          </div>
          <div className="hero-trust">
            <div className="trust-avatars">
              {['A','R','M','S'].map((l,i) => (
                <div key={i} className="avatar" style={{background: ['#22d3ee','#f59e0b','#a78bfa','#34d399'][i]}}>{l}</div>
              ))}
            </div>
            <span>Trusted by <strong>1000+</strong> players</span>
          </div>
        </div>
        <div className="hero-visual fade-in-right">
          <CricketIllustration />
        </div>
      </div>
    </section>
  )
}

// ── Feature Card ─────────────────────────────────────────────────────────────
interface FeatureCardProps {
  icon: string
  title: string
  desc: string
  color: string
  delay: string
}

function FeatureCard({ icon, title, desc, color, delay }: FeatureCardProps) {
  return (
    <div className="feature-card fade-in-up" style={{ animationDelay: delay }}>
      <div className="feature-icon-wrap" style={{ background: color }}>
        <span className="feature-icon">{icon}</span>
      </div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{desc}</p>
      <div className="feature-arrow">→</div>
    </div>
  )
}

function FeaturesSection() {
  const features = [
    { icon: '📊', title: 'Player Stats', desc: 'Deep-dive batting & bowling analytics for every player in your squad.', color: 'rgba(34,211,238,0.15)', delay: '0s' },
    { icon: '🏆', title: 'Team Rankings', desc: 'Dynamic leaderboards that update in real-time as matches conclude.', color: 'rgba(245,158,11,0.15)', delay: '0.1s' },
    { icon: '⚡', title: 'Live Score', desc: 'Ball-by-ball live scoring with run rate and required rate tracking.', color: 'rgba(167,139,250,0.15)', delay: '0.2s' },
    { icon: '👥', title: 'Team Management', desc: 'Create teams, manage rosters, and schedule fixtures with ease.', color: 'rgba(52,211,153,0.15)', delay: '0.3s' },
  ]

  return (
    <section id="features" className="features-section">
      <div className="section-header fade-in-up">
        <span className="section-badge">Features</span>
        <h2 className="section-title">Everything Gully Cricket Needs</h2>
        <p className="section-sub">Powerful tools built for the streets, alleys, and grounds.</p>
      </div>
      <div className="features-grid">
        {features.map(f => <FeatureCard key={f.title} {...f} />)}
      </div>
    </section>
  )
}

// ── Stat Counter ─────────────────────────────────────────────────────────────
function StatCounter({ end, label, suffix }: { end: number; label: string; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        let start = 0
        const step = Math.ceil(end / 60)
        const timer = setInterval(() => {
          start += step
          if (start >= end) { setCount(end); clearInterval(timer) }
          else setCount(start)
        }, 20)
      }
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end])

  return (
    <div className="stat-item" ref={ref}>
      <span className="stat-number">{count}{suffix}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function StatsSection() {
  return (
    <section id="about" className="stats-section">
      <div className="stats-inner">
        <div className="stats-text fade-in-up">
          <span className="section-badge">By the Numbers</span>
          <h2 className="section-title">Gully Cricket at Scale</h2>
          <p className="section-sub">From local lanes to inter-colony tournaments, GullyScore powers them all.</p>
        </div>
        <div className="stats-grid">
          <StatCounter end={1000} label="Players Registered" suffix="+" />
          <StatCounter end={100}  label="Teams Active"       suffix="+" />
          <StatCounter end={500}  label="Matches Recorded"   suffix="+" />
        </div>
      </div>
    </section>
  )
}

// ── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const navigate = useNavigate()
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-logo">
          <span className="logo-icon">🏏</span>
          <span className="logo-text">GullyScore</span>
        </div>
        <p className="footer-tagline">Made with ❤️ for Gully Cricket</p>
        <div className="footer-links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <button
            style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', font:'inherit', padding:0 }}
            onClick={() => navigate('/login')}
          >
            Login
          </button>
        </div>
        <p className="footer-copy">© 2026 GullyScore. All rights reserved.</p>
      </div>
    </footer>
  )
}

// ── Landing Page (assembled) ──────────────────────────────────────────────────
function LandingPage() {
  return (
    <div className="app">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <Footer />
    </div>
  )
}

// ── Auth-aware redirect for / ─────────────────────────────────────────────────
/**
 * If a logged-in user visits "/" directly, keep them on the landing page.
 * Routing: logged-in users manually navigate to /dashboard via the Navbar button.
 */

// ── App shell with router ─────────────────────────────────────────────────────
function AppRoutes() {
  const { user, loading } = useAuth()

  // Show full-screen spinner while Firebase resolves initial auth state
  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <span className="app-loading-text">Loading GullyScore…</span>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth pages — redirect to dashboard if already logged in */}
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/signup"
        element={user ? <Navigate to="/dashboard" replace /> : <SignupPage />}
      />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard"              element={<DashboardPage />} />
        <Route path="/teams"                  element={<TeamsPage />} />
        <Route path="/teams/create"           element={<CreateTeamPage />} />
        <Route path="/teams/:teamId"          element={<TeamDetailPage />} />
        <Route path="/my-teams"               element={<MyTeamsPage />} />
        <Route path="/teams/:teamId/players"  element={<PlayersPage />} />
        <Route path="/players/:playerId"      element={<PlayerDetailPage />} />
        <Route path="/matches"                        element={<MatchesPage />} />
        <Route path="/matches/:matchId"               element={<MatchDetailPage />} />
        <Route path="/matches/:matchId/live"           element={<LiveScorePage />} />
        <Route path="/leaderboard"                    element={<LeaderboardPage />} />
        <Route path="/tournaments"                          element={<TournamentsPage />} />
        <Route path="/tournaments/:tournamentId"            element={<TournamentDetailPage />} />
        <Route path="/tournaments/:tournamentId/settings"   element={<TournamentSettingsPage />} />
        <Route path="/profile"                        element={<ProfilePage />} />
        {/* Alias routes — required by spec */}
        <Route path="/players"                        element={<Navigate to="/teams" replace />} />
        <Route path="/live-score"                     element={<Navigate to="/matches" replace />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
