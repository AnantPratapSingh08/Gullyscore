// src/pages/Dashboard/DashboardPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Tournament-centric home dashboard.
// Shows ONLY data for the active tournament:
//   Live match, upcoming fixtures, points table, top players, join prompt.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useActiveTournament } from '../../context/ActiveTournamentContext'
import { AppShell } from '../../components/team/AppShell'
import { subscribeToAllMatches } from '../../services/matchService'
import { getPlayersByTeam } from '../../services/playerService'
import type { Match } from '../../types/match'
import type { Player } from '../../types/player'
import type { PointsTableEntry } from '../../types/tournament'
import '../../styles/dashboard.css'

// ── Join-by-code prompt ───────────────────────────────────────────────────────
function JoinPrompt() {
  const { joinByCode } = useActiveTournament()
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState('')

  async function handleJoin() {
    if (!code.trim()) return
    setStatus('loading')
    const res = await joinByCode(code)
    if (res.ok) {
      setStatus('ok')
      setMsg(`Joined "${res.tournament?.name}"!`)
    } else {
      setStatus('err')
      setMsg(res.error ?? 'Unknown error')
    }
  }

  return (
    <div className="dash-join-prompt">
      <div className="dash-join-icon">🎯</div>
      <h2 className="dash-join-title">Join a Tournament</h2>
      <p className="dash-join-sub">Enter the 6-character code shared by your tournament admin.</p>
      <div className="dash-join-row">
        <input
          id="join-code-input"
          type="text"
          className="dash-join-input"
          placeholder="e.g. ABC123"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
        />
        <button
          id="join-code-btn"
          className="dash-join-btn"
          onClick={handleJoin}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? <span className="team-spinner" /> : 'Join'}
        </button>
      </div>
      {status === 'ok' && <div className="dash-join-success">✓ {msg}</div>}
      {status === 'err' && <div className="dash-join-error">✗ {msg}</div>}
    </div>
  )
}

// ── Live match card ───────────────────────────────────────────────────────────
function LiveMatchCard({ match }: { match: Match }) {
  const navigate = useNavigate()
  return (
    <div className="dash-live-card" onClick={() => navigate(`/matches/${match.id}/live`)}>
      <div className="dash-live-badge"><span className="dash-live-dot" />LIVE</div>
      <div className="dash-live-teams">
        <div className="dash-live-team">
          <span className="dash-live-logo">{match.team1Logo}</span>
          <span className="dash-live-name">{match.team1Name}</span>
          <span className="dash-live-score">{match.team1Score}/{match.team1Wickets}</span>
          <span className="dash-live-overs">({match.team1Overs} ov)</span>
        </div>
        <div className="dash-live-vs">VS</div>
        <div className="dash-live-team">
          <span className="dash-live-logo">{match.team2Logo}</span>
          <span className="dash-live-name">{match.team2Name}</span>
          <span className="dash-live-score">{match.team2Score}/{match.team2Wickets}</span>
          <span className="dash-live-overs">({match.team2Overs} ov)</span>
        </div>
      </div>
      <div className="dash-live-cta">Watch Live →</div>
    </div>
  )
}

// ── Upcoming match ────────────────────────────────────────────────────────────
function UpcomingCard({ match }: { match: Match }) {
  const navigate = useNavigate()
  const date = new Date(match.scheduledAt)
  const dateStr = isNaN(date.getTime()) ? match.scheduledAt : date.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  return (
    <div className="dash-upcoming-card" onClick={() => navigate(`/matches/${match.id}`)}>
      <div className="dash-upcoming-format">{match.format} · {match.totalOvers} ov</div>
      <div className="dash-upcoming-matchup">
        {match.team1Logo} {match.team1Name} <span>vs</span> {match.team2Logo} {match.team2Name}
      </div>
      <div className="dash-upcoming-meta">{match.venue} · {dateStr}</div>
    </div>
  )
}

// ── Recent result ─────────────────────────────────────────────────────────────
function ResultCard({ match }: { match: Match }) {
  const navigate = useNavigate()
  return (
    <div className="dash-result-card" onClick={() => navigate(`/matches/${match.id}`)}>
      <div className="dash-result-teams">
        {match.team1Logo} {match.team1Name} {match.team1Score}/{match.team1Wickets}
        <span className="dash-result-vs">vs</span>
        {match.team2Logo} {match.team2Name} {match.team2Score}/{match.team2Wickets}
      </div>
      <div className="dash-result-summary">{match.resultSummary || 'Result recorded'}</div>
    </div>
  )
}

// ── Points table ──────────────────────────────────────────────────────────────
function PointsTable({ entries }: { entries: PointsTableEntry[] }) {
  if (entries.length === 0) return null
  return (
    <div className="dash-table-wrap">
      <div className="dash-section-title">🏅 Points Table</div>
      <table className="dash-table">
        <thead>
          <tr>
            <th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>NRR</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {[...entries].sort((a, b) => b.points - a.points || b.nrr - a.nrr).map((e, i) => (
            <tr key={e.teamId} className={i === 0 ? 'dash-table-leader' : ''}>
              <td>{i + 1}</td>
              <td><span>{e.teamLogo}</span> {e.teamName}</td>
              <td>{e.played}</td>
              <td>{e.won}</td>
              <td>{e.lost}</td>
              <td className={e.nrr >= 0 ? 'pos' : 'neg'}>{e.nrr >= 0 ? '+' : ''}{e.nrr.toFixed(3)}</td>
              <td className="dash-table-pts">{e.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Player stat card ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub: string; icon: string }) {
  return (
    <div className="dash-stat-card">
      <div className="dash-stat-icon">{icon}</div>
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
      <div className="dash-stat-sub">{sub}</div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, userProfile } = useAuth()
  const { activeTournament, activeTournamentId, joinedTournaments, loading: tournamentLoading } = useActiveTournament()
  const navigate = useNavigate()

  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [topPlayers, setTopPlayers] = useState<Player[]>([])

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

  // Subscribe to all matches, then filter by tournament
  useEffect(() => {
    const unsub = subscribeToAllMatches(matches => {
      const filtered = activeTournamentId
        ? matches.filter(m => m.tournamentId === activeTournamentId)
        : []
      setAllMatches(filtered)
    })
    return unsub
  }, [activeTournamentId])

  // Load top players from tournament teams
  useEffect(() => {
    if (!activeTournament?.teamIds?.length) { setTopPlayers([]); return }
    Promise.all(activeTournament.teamIds.map(tid => getPlayersByTeam(tid)))
      .then(all => {
        const flat = all.flat()
        flat.sort((a, b) => b.runs - a.runs)
        setTopPlayers(flat.slice(0, 5))
      })
  }, [activeTournament])

  const liveMatch     = allMatches.find(m => m.status === 'live')
  const upcomingMatches = allMatches.filter(m => m.status === 'upcoming').slice(0, 3)
  const recentResults   = allMatches.filter(m => m.status === 'completed').slice(0, 3)
  const topBatter   = topPlayers[0]
  const topWickets  = [...topPlayers].sort((a, b) => b.wickets - a.wickets)[0]

  // Show join prompt if no tournaments joined
  if (!tournamentLoading && joinedTournaments.length === 0) {
    return (
      <AppShell>
        <div className="dash-page">
          <div className="dash-welcome">
            <div className="dash-welcome-avatar">{initials}</div>
            <div className="dash-welcome-text">
              <h1 className="dash-welcome-greeting">{greeting}, <span className="dash-welcome-name">{displayName}</span> 🏏</h1>
              <p className="dash-welcome-sub">Welcome to GullyScore — join a tournament to get started.</p>
            </div>
          </div>
          <JoinPrompt />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="dash-page">

        {/* ── Welcome ────────────────────────────────────────────────────── */}
        <div className="dash-welcome">
          <div className="dash-welcome-avatar">{initials}</div>
          <div className="dash-welcome-text">
            <h1 className="dash-welcome-greeting">
              {greeting}, <span className="dash-welcome-name">{displayName}</span> 🏏
            </h1>
            <p className="dash-welcome-sub">
              {activeTournament
                ? `${activeTournament.name} · ${activeTournament.status}`
                : 'Select a tournament from the top bar'}
            </p>
          </div>
          <div className="dash-welcome-badge">
            {activeTournament?.tournamentCode && (
              <span className="dash-code-badge">🔑 {activeTournament.tournamentCode}</span>
            )}
          </div>
        </div>

        {tournamentLoading && (
          <div className="teams-loading">
            <div className="team-spinner team-spinner--lg" />
            <p>Loading tournament data…</p>
          </div>
        )}

        {!tournamentLoading && activeTournament && (
          <>
            {/* ── Join another tournament ──────────────────────────────── */}
            <div className="dash-actions-row">
              <button className="dash-action-btn" onClick={() => navigate('/tournaments')}>
                🎯 My Tournaments
              </button>
              <button className="dash-action-btn" onClick={() => navigate('/matches')}>
                🏏 All Matches
              </button>
              <button className="dash-action-btn" onClick={() => navigate('/leaderboard')}>
                🥇 Leaderboard
              </button>
            </div>

            {/* ── Live Match ───────────────────────────────────────────── */}
            {liveMatch && (
              <div className="dash-section">
                <div className="dash-section-title">⚡ Live Now</div>
                <LiveMatchCard match={liveMatch} />
              </div>
            )}

            {/* ── Upcoming Fixtures ────────────────────────────────────── */}
            {upcomingMatches.length > 0 && (
              <div className="dash-section">
                <div className="dash-section-title">📅 Upcoming</div>
                <div className="dash-upcoming-list">
                  {upcomingMatches.map(m => <UpcomingCard key={m.id} match={m} />)}
                </div>
              </div>
            )}

            {/* ── Recent Results ───────────────────────────────────────── */}
            {recentResults.length > 0 && (
              <div className="dash-section">
                <div className="dash-section-title">🏁 Recent Results</div>
                <div className="dash-results-list">
                  {recentResults.map(m => <ResultCard key={m.id} match={m} />)}
                </div>
              </div>
            )}

            {/* ── Awards ──────────────────────────────────────────────── */}
            {(topBatter || topWickets) && (
              <div className="dash-section">
                <div className="dash-section-title">🏅 Tournament Leaders</div>
                <div className="dash-stats-grid">
                  {topBatter && (
                    <StatCard
                      icon="🟠"
                      label="Orange Cap"
                      value={topBatter.name}
                      sub={`${topBatter.runs} runs`}
                    />
                  )}
                  {topWickets && (
                    <StatCard
                      icon="🟣"
                      label="Purple Cap"
                      value={topWickets.name}
                      sub={`${topWickets.wickets} wickets`}
                    />
                  )}
                  {activeTournament.awards?.bestFielder && (
                    <StatCard
                      icon="🧤"
                      label="Best Fielder"
                      value={activeTournament.awards.bestFielder.playerName}
                      sub={`${activeTournament.awards.bestFielder.dismissals} dismissals`}
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── Points Table ─────────────────────────────────────────── */}
            {activeTournament.pointsTable?.length > 0 && (
              <div className="dash-section">
                <PointsTable entries={activeTournament.pointsTable} />
              </div>
            )}

            {/* ── No matches yet ───────────────────────────────────────── */}
            {allMatches.length === 0 && (
              <div className="teams-empty" style={{ marginTop: 40 }}>
                <div className="teams-empty-icon">🏏</div>
                <h2 className="teams-empty-title">No matches yet</h2>
                <p className="teams-empty-sub">The tournament admin will schedule matches soon.</p>
              </div>
            )}
          </>
        )}

        {/* ── No active tournament selected ────────────────────────────── */}
        {!tournamentLoading && !activeTournament && joinedTournaments.length > 0 && (
          <JoinPrompt />
        )}

      </div>
    </AppShell>
  )
}
