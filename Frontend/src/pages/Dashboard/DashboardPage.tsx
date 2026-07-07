// src/pages/Dashboard/DashboardPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Tournament-centric home dashboard — V3 complete implementation.
// Shows ONLY data for the active tournament:
//   Live match · Upcoming fixtures · Recent results · Points Table
//   Top Batsman · Top Bowler · Top Fielder · My Teams · My Stats
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useActiveTournament } from '../../context/ActiveTournamentContext'
import { AppShell } from '../../components/team/AppShell'
import { subscribeToMatchesByTournament } from '../../services/matchService'
import { subscribeToTournamentLeaderboard } from '../../services/leaderboardService'
import { subscribeToMyTeams } from '../../services/teamService'
import { exportPointsTablePDF } from '../../services/pdfService'
import type { Match } from '../../types/match'
import type { Team } from '../../types/team'
import type { PointsTableEntry } from '../../types/tournament'
import type { LeaderboardData } from '../../services/leaderboardService'
import '../../styles/dashboard.css'
import '../../styles/teams.css'

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
      setMsg(`Joined "${res.tournament?.name}"! 🎉`)
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
      {status === 'ok'  && <div className="dash-join-success">✓ {msg}</div>}
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

// ── Upcoming match card ────────────────────────────────────────────────────────
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

// ── Recent result card ─────────────────────────────────────────────────────────
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
function PointsTable({ tournament, entries }: { tournament: { name: string, logo: string }, entries: PointsTableEntry[] }) {
  if (entries.length === 0) return null
  const sorted = [...entries].sort((a, b) => b.points - a.points || b.nrr - a.nrr)

  // Render form dot badges
  const renderFormDot = (outcome: 'W' | 'L' | 'T' | 'NR', idx: number) => {
    let bg = '#475569' // grey for T/NR
    let color = '#ffffff'
    let text: string = outcome

    if (outcome === 'W') {
      bg = '#10b981' // Green
    } else if (outcome === 'L') {
      bg = '#ef4444' // Red
    } else if (outcome === 'T') {
      text = 'T'
      bg = '#64748b'
    } else {
      text = 'N'
      bg = '#64748b'
    }

    return (
      <span
        key={idx}
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          backgroundColor: bg,
          color: color,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          fontWeight: 900,
          marginRight: 3,
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        {text}
      </span>
    )
  }

  return (
    <div className="dash-table-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="dash-section-title" style={{ marginBottom: 0 }}>🏅 Points Table</div>
        <button
          className="team-btn team-btn--outline team-btn--sm"
          onClick={() => exportPointsTablePDF(
            tournament.name,
            tournament.logo,
            sorted.map((r, i) => ({
              rank: i + 1, team: r.teamName, logo: r.teamLogo, played: r.played, won: r.won, lost: r.lost,
              nr: (r.nr || 0) + (r.tied || 0), nrr: (Number(r.nrr) || 0).toFixed(3), points: r.points, form: r.form?.join('') || ''
            }))
          )}
        >
          📄 Download PDF
        </button>
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid rgba(31, 41, 55, 0.05)' }}>
        <table className="dash-table" style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(31, 41, 55, 0.05)' }}>
              <th style={{ padding: '12px 14px', textAlign: 'left', width: 40 }}>#</th>
              <th style={{ padding: '12px 14px', textAlign: 'left' }}>Team</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', width: 45 }}>P</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', width: 45 }}>W</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', width: 45 }}>L</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', width: 45 }}>NR</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', width: 85 }}>NRR</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', width: 60 }}>Pts</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', width: 130 }}>Form</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const isPlayoffs = i < 4
              const rowBg = i % 2 === 0 ? '#f8fafc' : 'transparent'
              const borderLeftStyle = isPlayoffs 
                ? '4px solid #10b981' // Green indicator for playoffs
                : '4px solid transparent'

              return (
                <tr 
                  key={row.teamId} 
                  style={{ 
                    background: isPlayoffs ? 'rgba(16,185,129,0.02)' : rowBg,
                    transition: 'background 0.2s',
                    borderBottom: '1px solid rgba(31, 41, 55, 0.05)'
                  }}
                >
                  <td style={{ 
                    padding: '12px 14px',
                    fontWeight: 700, 
                    color: isPlayoffs ? '#10b981' : '#64748b',
                    borderLeft: borderLeftStyle,
                    textAlign: 'left'
                  }}>
                    {i + 1}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>{row.teamLogo}</span>
                      <span style={{ color: '#1f2937', fontWeight: 700 }}>{row.teamName}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>{row.played}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{row.won}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: '#ef4444' }}>{row.lost}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: '#94a3b8' }}>{(row.nr || 0) + (row.tied || 0)}</td>
                  <td style={{ 
                    padding: '12px 14px', 
                    textAlign: 'center', 
                    color: row.nrr >= 0 ? '#10b981' : '#f87171',
                    fontWeight: 600
                  }}>
                    {row.nrr >= 0 ? '+' : ''}{row.nrr.toFixed(3)}
                  </td>
                  <td style={{ 
                    padding: '12px 14px', 
                    textAlign: 'center', 
                    color: '#f59e0b', 
                    fontWeight: 900, 
                    fontSize: 14 
                  }}>
                    {row.points}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'left' }}>
                    {row.form && row.form.length > 0 ? (
                      <div style={{ display: 'flex' }}>
                        {row.form.map((outcome, idx) => renderFormDot(outcome, idx))}
                      </div>
                    ) : (
                      <span style={{ color: '#475569', fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ 
          padding: '8px 14px', 
          fontSize: 10, 
          color: '#64748b', 
          background: '#ffffff', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 5,
          borderTop: '1px solid rgba(31, 41, 55, 0.05)'
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
          <span>Top 4 qualify for Playoffs</span>
        </div>
      </div>
    </div>
  )
}

// ── Stat award card ────────────────────────────────────────────────────────────
function AwardCard({ icon, label, name, sub }: { icon: string; label: string; name: string; sub: string }) {
  return (
    <div className="dash-stat-card">
      <div className="dash-stat-icon">{icon}</div>
      <div className="dash-stat-label">{label}</div>
      <div className="dash-stat-value">{name}</div>
      <div className="dash-stat-sub">{sub}</div>
    </div>
  )
}

// ── My Teams mini-card ─────────────────────────────────────────────────────────
function MyTeamCard({ team }: { team: Team }) {
  const navigate = useNavigate()
  return (
    <div className="dash-my-team-card" onClick={() => navigate(`/teams/${team.id}`)}>
      <span className="dash-my-team-logo">{team.logo ?? '🏏'}</span>
      <div className="dash-my-team-info">
        <div className="dash-my-team-name">{team.teamName}</div>
        <div className="dash-my-team-meta">{team.playerCount ?? 0} players</div>
      </div>
      <span className="dash-my-team-arrow">›</span>
    </div>
  )
}

// ── My Stats card ──────────────────────────────────────────────────────────────
interface MyStats {
  matches: number
  runs: number
  wickets: number
  catches: number
  strikeRate: number
  economy: number
  average: number
}

function MyStatsPanel({ stats }: { stats: MyStats }) {
  const items = [
    { label: 'Matches',  value: stats.matches },
    { label: 'Runs',     value: stats.runs },
    { label: 'Wickets',  value: stats.wickets },
    { label: 'Avg',      value: stats.average.toFixed(1) },
    { label: 'SR',       value: stats.strikeRate.toFixed(1) },
    { label: 'Eco',      value: stats.economy > 0 ? stats.economy.toFixed(1) : '—' },
    { label: 'Catches',  value: stats.catches },
  ]
  return (
    <div className="dash-mystats-grid">
      {items.map(item => (
        <div key={item.label} className="dash-mystats-cell">
          <span className="dash-mystats-value">{item.value}</span>
          <span className="dash-mystats-label">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, userProfile } = useAuth()
  const { activeTournament, activeTournamentId, joinedTournaments, loading: tournamentLoading } = useActiveTournament()
  const navigate = useNavigate()

  const [allMatches,   setAllMatches]   = useState<Match[]>([])
  const [lb,           setLb]           = useState<LeaderboardData | null>(null)
  const [myTeams,      setMyTeams]      = useState<Team[]>([])

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

  // ── Real-time: tournament-scoped matches ─────────────────────────────────
  useEffect(() => {
    if (!activeTournamentId) { setAllMatches([]); return }
    const unsub = subscribeToMatchesByTournament(activeTournamentId, setAllMatches)
    return unsub
  }, [activeTournamentId])

  // ── Real-time: tournament-scoped leaderboard ──────────────────────────────
  const teamIds = useMemo(() => activeTournament?.teamIds ?? [], [activeTournament])
  useEffect(() => {
    const unsub = subscribeToTournamentLeaderboard(activeTournamentId, teamIds, setLb)
    return unsub
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(teamIds)])

  // ── Real-time: my teams ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setMyTeams([]); return }
    const unsub = subscribeToMyTeams(user.uid, teams => {
      // Filter to only teams in the active tournament
      const tournTeamIds = activeTournament?.teamIds ?? []
      setMyTeams(tournTeamIds.length > 0
        ? teams.filter(t => tournTeamIds.includes(t.id))
        : teams
      )
    })
    return unsub
  }, [user, activeTournament])

  // ── Derived data ──────────────────────────────────────────────────────────
  const liveMatch       = allMatches.find(m => m.status === 'live')
  const upcomingMatches = allMatches.filter(m => m.status === 'upcoming').slice(0, 3)
  const recentResults   = allMatches.filter(m => m.status === 'completed').slice(0, 3)

  const topBatter  = lb?.topRunScorers[0]
  const topBowler  = lb?.topWicketTakers[0]
  const topFielder = lb ? [...(lb.mostCatches ?? []), ...(lb.mostRunOuts ?? [])]
    .sort((a, b) => b.value - a.value)[0] : undefined

  // My stats: aggregate across all players in my teams for this tournament
  const myStats = useMemo<MyStats>(() => {
    if (!lb || myTeams.length === 0) return { matches: 0, runs: 0, wickets: 0, catches: 0, strikeRate: 0, economy: 0, average: 0 }
    // Collect my player entries from leaderboard (by teamId match)
    const myTeamIds = new Set(myTeams.map(t => t.id))
    const allEntries = [
      ...(lb.topRunScorers ?? []),
      ...(lb.topWicketTakers ?? []),
    ]
    const seen = new Set<string>()
    let runs = 0, wickets = 0, catches = 0, matches = 0, totalSR = 0, totalEco = 0, srCount = 0, ecoCount = 0

    for (const e of allEntries) {
      if (!myTeamIds.has(e.teamId)) continue
      if (seen.has(e.playerId)) continue
      seen.add(e.playerId)
      if (e.secondary !== undefined) { runs += e.value; matches = Math.max(matches, e.secondary) }
    }
    for (const e of lb.bestStrikeRate ?? []) {
      if (!myTeamIds.has(e.teamId)) continue
      totalSR += e.value; srCount++
    }
    for (const e of lb.bestEconomy ?? []) {
      if (!myTeamIds.has(e.teamId)) continue
      totalEco += e.value; ecoCount++
    }
    for (const e of [...(lb.mostCatches ?? []), ...(lb.mostRunOuts ?? [])]) {
      if (myTeamIds.has(e.teamId)) catches += e.value
    }
    for (const e of lb.topWicketTakers ?? []) {
      if (myTeamIds.has(e.teamId)) wickets += e.value
    }
    const average = matches > 0 ? parseFloat((runs / matches).toFixed(1)) : 0
    return {
      matches,
      runs,
      wickets,
      catches,
      strikeRate: srCount > 0 ? parseFloat((totalSR / srCount).toFixed(1)) : 0,
      economy:    ecoCount > 0 ? parseFloat((totalEco / ecoCount).toFixed(1)) : 0,
      average,
    }
  }, [lb, myTeams])

  // ── No tournaments joined yet — show join prompt ──────────────────────────
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

        {/* ── Welcome ──────────────────────────────────────────────────── */}
        <div className="dash-welcome">
          <div className="dash-welcome-avatar">{initials}</div>
          <div className="dash-welcome-text">
            <h1 className="dash-welcome-greeting">
              {greeting}, <span className="dash-welcome-name">{displayName}</span> 🏏
            </h1>
            <p className="dash-welcome-sub">
              {activeTournament
                ? `${activeTournament.name} · ${activeTournament.format} · ${activeTournament.status}`
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
            {/* ── Quick Actions ──────────────────────────────────────────── */}
            <div className="dash-actions-row">
              <button className="dash-action-btn" onClick={() => navigate('/matches/new' as string) || navigate('/matches')}>
                🏏 Schedule Match
              </button>
              <button className="dash-action-btn" onClick={() => navigate('/leaderboard')}>
                🥇 Leaderboard
              </button>
              <button className="dash-action-btn" onClick={() => navigate('/tournaments')}>
                🎯 My Tournaments
              </button>
              <button className="dash-action-btn" onClick={() => navigate('/teams')}>
                👥 Teams
              </button>
            </div>

            {/* ── Live Match ─────────────────────────────────────────────── */}
            {liveMatch && (
              <div className="dash-section">
                <div className="dash-section-title">⚡ Live Now</div>
                <LiveMatchCard match={liveMatch} />
              </div>
            )}

            {/* ── Upcoming Fixtures ──────────────────────────────────────── */}
            {upcomingMatches.length > 0 && (
              <div className="dash-section">
                <div className="dash-section-title">📅 Upcoming</div>
                <div className="dash-upcoming-list">
                  {upcomingMatches.map(m => <UpcomingCard key={m.id} match={m} />)}
                </div>
              </div>
            )}

            {/* ── Recent Results ─────────────────────────────────────────── */}
            {recentResults.length > 0 && (
              <div className="dash-section">
                <div className="dash-section-title">🏁 Recent Results</div>
                <div className="dash-results-list">
                  {recentResults.map(m => <ResultCard key={m.id} match={m} />)}
                </div>
              </div>
            )}

            {/* ── Points Table ───────────────────────────────────────────── */}
            {(activeTournament.pointsTable?.length ?? 0) > 0 && (
              <div className="dash-section">
                <PointsTable tournament={activeTournament} entries={activeTournament.pointsTable!} />
              </div>
            )}

            {/* ── Tournament Leaders ─────────────────────────────────────── */}
            {(topBatter || topBowler || topFielder) && (
              <div className="dash-section">
                <div className="dash-section-title">🏅 Tournament Leaders</div>
                <div className="dash-stats-grid">
                  {topBatter && (
                    <AwardCard
                      icon="🟠"
                      label="Orange Cap"
                      name={topBatter.playerName}
                      sub={`${topBatter.value} runs · ${topBatter.teamName}`}
                    />
                  )}
                  {topBowler && (
                    <AwardCard
                      icon="🟣"
                      label="Purple Cap"
                      name={topBowler.playerName}
                      sub={`${topBowler.value} wickets · ${topBowler.teamName}`}
                    />
                  )}
                  {topFielder && (
                    <AwardCard
                      icon="🧤"
                      label="Best Fielder"
                      name={topFielder.playerName}
                      sub={`${topFielder.value} dismissals · ${topFielder.teamName}`}
                    />
                  )}
                  {activeTournament.awards?.bestEconomy && (
                    <AwardCard
                      icon="🎯"
                      label="Best Economy"
                      name={activeTournament.awards.bestEconomy.playerName}
                      sub={`Eco ${activeTournament.awards.bestEconomy.economy.toFixed(2)}`}
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── My Teams ───────────────────────────────────────────────── */}
            {myTeams.length > 0 && (
              <div className="dash-section">
                <div className="dash-section-title">👥 My Teams</div>
                <div className="dash-my-teams-list">
                  {myTeams.map(t => <MyTeamCard key={t.id} team={t} />)}
                </div>
              </div>
            )}

            {/* ── My Stats (aggregated from tournament teams) ─────────────── */}
            {(myStats.matches > 0 || myStats.runs > 0) && (
              <div className="dash-section">
                <div className="dash-section-title">📊 My Stats <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>· This Tournament</span></div>
                <MyStatsPanel stats={myStats} />
              </div>
            )}

            {/* ── No content yet ─────────────────────────────────────────── */}
            {allMatches.length === 0 && (
              <div className="teams-empty" style={{ marginTop: 40 }}>
                <div className="teams-empty-icon">🏏</div>
                <h2 className="teams-empty-title">No matches yet</h2>
                <p className="teams-empty-sub">Schedule the first match to begin the tournament.</p>
                <button
                  className="team-btn team-btn--primary"
                  onClick={() => navigate('/matches')}
                >
                  Go to Matches
                </button>
              </div>
            )}
          </>
        )}

        {/* ── No active tournament selected ──────────────────────────────── */}
        {!tournamentLoading && !activeTournament && joinedTournaments.length > 0 && (
          <JoinPrompt />
        )}

      </div>
    </AppShell>
  )
}
