// src/pages/Tournament/TournamentDetailPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Full tournament detail page: overview, fixtures, points table, awards.
// Access-gated: only users who have the tournament code can view this page.
// The code is stored in localStorage after joining.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useAuth } from '../../context/AuthContext'
import { subscribeToTournament, setTournamentStatus, addTeamToTournament } from '../../services/tournamentService'
import { subscribeToMatchesByTournament, createMatch } from '../../services/matchService'
import { createTeam } from '../../services/teamService'
import { subscribeToTeamsByTournament } from '../../services/teamService'
import { useActiveTournament } from '../../context/ActiveTournamentContext'
import { useRole } from '../../context/RoleContext'
import type { Tournament, PointsTableEntry } from '../../types/tournament'
import type { Match } from '../../types/match'
import type { Team } from '../../types/team'
import { exportPointsTablePDF } from '../../services/pdfService'
import '../../styles/teams.css'
import '../../styles/matches.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function storageKey(id: string) { return `gs_tournament_access_${id}` }

function hasAccess(tournamentId: string, code: string): boolean {
  return localStorage.getItem(storageKey(tournamentId)) === code.toUpperCase()
}

function grantAccess(tournamentId: string, code: string) {
  localStorage.setItem(storageKey(tournamentId), code.toUpperCase())
}

// ── Code Gate ─────────────────────────────────────────────────────────────────

function CodeGate({ tournamentId, onAccess }: { tournamentId: string; onAccess: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { joinByCode } = useActiveTournament()

  async function handleJoin() {
    if (code.trim().length !== 6) { setError('Code must be 6 characters.'); return }
    const res = await joinByCode(code.trim())
    if (!res.ok) { setError(res.error || 'Failed to join tournament.'); return }
    grantAccess(tournamentId, code.trim())
    onAccess()
  }

  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 24, padding: '40px 20px',
    }}>
      <div style={{ fontSize: 48 }}>🔐</div>
      <h2 style={{ color: '#1f2937', fontSize: 24, fontWeight: 800, margin: 0, textAlign: 'center' }}>
        Private Tournament
      </h2>
      <p style={{ color: '#64748b', textAlign: 'center', margin: 0, maxWidth: 340 }}>
        This tournament is private. Enter the 6-character tournament code to access it.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
        <input
          id="tournament-code-input"
          type="text"
          className="team-form-input"
          placeholder="Enter code (e.g. ABC123)"
          value={code}
          maxLength={6}
          onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
          style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, letterSpacing: 8, textTransform: 'uppercase' }}
        />
        {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', margin: 0 }}>{error}</p>}
        <button id="join-tournament-btn" className="team-btn team-btn--primary" onClick={handleJoin}>
          🔓 Enter Tournament
        </button>
        <button className="team-btn team-btn--ghost" onClick={() => navigate('/tournaments')}>
          ← Back to Tournaments
        </button>
      </div>
    </div>
  )
}

// ── Points Table ──────────────────────────────────────────────────────────────

function PointsTable({ tournament, table }: { tournament: Tournament, table: PointsTableEntry[] }) {
  if (table.length === 0) {
    return (
      <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>
        Points table will update after matches are played.
      </p>
    )
  }

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
          width: 20,
          height: 20,
          borderRadius: '50%',
          backgroundColor: bg,
          color: color,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 900,
          marginRight: 4,
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        {text}
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="team-btn team-btn--outline team-btn--sm"
          onClick={() => exportPointsTablePDF(
            tournament.name,
            tournament.logo,
            table.map((r, i) => ({
              rank: i + 1, team: r.teamName, logo: r.teamLogo, played: r.played, won: r.won, lost: r.lost,
              nr: (r.nr || 0) + (r.tied || 0), nrr: (Number(r.nrr) || 0).toFixed(3), points: r.points, form: r.form?.join('') || ''
            }))
          )}
        >
          📄 Download PDF
        </button>
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
      <table className="live-scorecard-table" style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(15,23,42,0.4)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', width: 40 }}>#</th>
            <th style={{ padding: '12px 16px', textAlign: 'left' }}>Team</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', width: 45 }}>P</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', width: 45 }}>W</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', width: 45 }}>L</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', width: 45 }}>NR</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', width: 80 }}>NRR</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', width: 60 }}>Pts</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', width: 140 }}>Form</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => {
            const isPlayoffs = i < 4
            const rowBg = i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'
            const borderLeftStyle = isPlayoffs 
              ? '4px solid #10b981' // IPL Green glow for Top 4 playoffs spots
              : '4px solid transparent'

            return (
              <tr 
                key={row.teamId} 
                style={{ 
                  background: isPlayoffs ? 'rgba(16,185,129,0.02)' : rowBg,
                  transition: 'background 0.2s',
                  borderBottom: '1px solid rgba(255,255,255,0.04)'
                }}
              >
                <td style={{ 
                  padding: '14px 16px',
                  fontWeight: 700, 
                  color: isPlayoffs ? '#10b981' : '#64748b',
                  borderLeft: borderLeftStyle,
                  textAlign: 'left'
                }}>
                  {i + 1}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{row.teamLogo}</span>
                    <span style={{ color: '#1f2937', fontWeight: 700 }}>{row.teamName}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>{row.played}</td>
                <td style={{ padding: '14px 16px', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{row.won}</td>
                <td style={{ padding: '14px 16px', textAlign: 'center', color: '#ef4444' }}>{row.lost}</td>
                <td style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8' }}>{(row.nr || 0) + (row.tied || 0)}</td>
                <td style={{ 
                  padding: '14px 16px', 
                  textAlign: 'center', 
                  color: row.nrr >= 0 ? '#10b981' : '#f87171',
                  fontWeight: 600
                }}>
                  {row.nrr >= 0 ? '+' : ''}{row.nrr.toFixed(3)}
                </td>
                <td style={{ 
                  padding: '14px 16px', 
                  textAlign: 'center', 
                  color: '#f59e0b', 
                  fontWeight: 900, 
                  fontSize: 15 
                }}>
                  {row.points}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'left' }}>
                  {row.form && row.form.length > 0 ? (
                    <div style={{ display: 'flex' }}>
                      {row.form.map((outcome, idx) => renderFormDot(outcome, idx))}
                    </div>
                  ) : (
                    <span style={{ color: '#475569', fontSize: 12 }}>—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ 
        padding: '10px 16px', 
        fontSize: 11, 
        color: '#64748b', 
        background: 'rgba(0,0,0,0.2)', 
        display: 'flex', 
        alignItems: 'center', 
        gap: 6,
        borderTop: '1px solid rgba(255,255,255,0.04)'
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
        <span>Top 4 qualify for Playoffs</span>
      </div>
    </div>
    </div>
  )
}

// ── Awards Section ────────────────────────────────────────────────────────────

function AwardsSection({ tournament }: { tournament: Tournament }) {
  const { awards } = tournament
  const hasAwards = awards.orangeCap || awards.purpleCap || awards.bestFielder ||
    awards.playerOfTournament || awards.bestEconomy || awards.highestStrikeRate

  if (!hasAwards) {
    return <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>Awards will be announced when the tournament concludes.</p>
  }

  const items = [
    awards.orangeCap && { icon: '🧡', label: 'Orange Cap', name: awards.orangeCap.playerName, stat: `${awards.orangeCap.runs} runs` },
    awards.purpleCap && { icon: '💜', label: 'Purple Cap', name: awards.purpleCap.playerName, stat: `${awards.purpleCap.wickets} wickets` },
    awards.bestFielder && { icon: '🥊', label: 'Best Fielder', name: awards.bestFielder.playerName, stat: `${awards.bestFielder.dismissals} dismissals` },
    awards.playerOfTournament && { icon: '🏆', label: 'Player of Tournament', name: awards.playerOfTournament.playerName, stat: '' },
    awards.bestEconomy && { icon: '💰', label: 'Best Economy', name: awards.bestEconomy.playerName, stat: `${awards.bestEconomy.economy.toFixed(2)} econ` },
    awards.highestStrikeRate && { icon: '⚡', label: 'Highest Strike Rate', name: awards.highestStrikeRate.playerName, stat: `${awards.highestStrikeRate.strikeRate.toFixed(2)} SR` },
  ].filter(Boolean) as { icon: string; label: string; name: string; stat: string }[]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
      {items.map(item => (
        <div key={item.label} style={{
          background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 16, padding: '16px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{item.icon}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{item.label}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1f2937' }}>{item.name}</div>
          {item.stat && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{item.stat}</div>}
        </div>
      ))}
    </div>
  )
}

// ── Match Fixtures ─────────────────────────────────────────────────────────────

function FixturesList({ matches, isAdmin }: { matches: Match[]; isAdmin: boolean }) {
  const navigate = useNavigate()

  if (matches.length === 0) {
    return <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No fixtures scheduled yet.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {matches.map(m => (
        <div
          key={m.id}
          style={{
            background: 'rgba(31,41,55,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            transition: 'all 0.2s ease',
          }}
        >
          <div
            style={{ flex: 1, cursor: 'pointer' }}
            onClick={() => navigate(`/matches/${m.id}`)}
          >
            <div style={{ fontWeight: 700, color: '#1f2937', fontSize: 14 }}>{m.title}</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
              {m.team1Name} vs {m.team2Name} · {m.venue}
            </div>
            {m.scheduledAt && (
              <div style={{ color: '#475569', fontSize: 11, marginTop: 3 }}>🕐 {new Date(m.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            {m.status === 'live' && (
              <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>🔴 LIVE</span>
            )}
            {m.status === 'upcoming' && (
              <span style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>📅 Upcoming</span>
            )}
            {m.status === 'completed' && (
              <span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>✅ Done</span>
            )}
            {/* Quick-action buttons for admin */}
            {isAdmin && m.status === 'upcoming' && (
              <button
                className="team-btn team-btn--primary team-btn--sm"
                style={{ fontSize: 11, padding: '4px 10px', background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
                onClick={() => navigate(`/matches/${m.id}`)}
              >
                🪙 Do Toss
              </button>
            )}
            {isAdmin && m.status === 'live' && (
              <button
                className="team-btn team-btn--primary team-btn--sm"
                style={{ fontSize: 11, padding: '4px 10px', background: 'linear-gradient(135deg,#4ade80,#16a34a)' }}
                onClick={() => navigate(`/matches/${m.id}/live`)}
              >
                ⚡ Score
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TEAM_LOGOS = ['🏏', '⚡', '🔥', '🦁', '🐯', '🦅', '🐉', '💥', '🌟', '🚀', '🎯', '🏆', '👑', '🦊', '🐺', '🦈']

type Tab = 'overview' | 'fixtures' | 'points' | 'awards'

export default function TournamentDetailPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toasts, showToast, dismissToast } = useToast()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [teams,   setTeams]   = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [accessGranted, setAccessGranted] = useState(false)

  // ── Inline Team Create state ────────────────────────────────────────────────
  const [showTeamCreate,  setShowTeamCreate]  = useState(false)
  const [newTeamName,     setNewTeamName]     = useState('')
  const [newTeamLogo,     setNewTeamLogo]     = useState('🏏')
  const [teamCreateLoading, setTeamCreateLoading] = useState(false)

  // ── Inline Fixture Create state ─────────────────────────────────────────────
  const [showFixCreate,   setShowFixCreate]   = useState(false)
  const [fixTeam1Id,      setFixTeam1Id]      = useState('')
  const [fixTeam2Id,      setFixTeam2Id]      = useState('')
  const [fixVenue,        setFixVenue]        = useState('')
  const [fixDate,         setFixDate]         = useState('')
  const [fixOvers,        setFixOvers]        = useState(20)
  const [fixFormat,       setFixFormat]       = useState<'T20' | 'ODI' | 'T10' | 'Test' | 'Custom'>('T20')
  const [fixCreateLoading, setFixCreateLoading] = useState(false)
  const { joinedIds, activeTournamentId, setActiveTournamentId } = useActiveTournament()
  const { canManageTournament } = useRole()

  // Sync active tournament context with current route
  useEffect(() => {
    if (tournamentId && tournamentId !== activeTournamentId) {
      setActiveTournamentId(tournamentId)
    }
  }, [tournamentId, activeTournamentId, setActiveTournamentId])

  // Subscribe to tournament
  useEffect(() => {
    if (!tournamentId) return
    const unsub = subscribeToTournament(tournamentId, t => {
      setTournament(t)
      setLoading(false)
      if (t) {
        // Owner always has access; others need code
        if (user?.uid === t.adminId) {
          setAccessGranted(true)
        } else if (hasAccess(tournamentId, t.tournamentCode) || joinedIds.includes(tournamentId)) {
          setAccessGranted(true)
        }
      }
    })
    return unsub
  }, [tournamentId, user?.uid, joinedIds])

  // Subscribe to tournament-scoped matches only (prevents cross-tournament leakage)
  useEffect(() => {
    if (!tournamentId) return
    const unsub = subscribeToMatchesByTournament(tournamentId, setMatches)
    return unsub
  }, [tournamentId])

  // Subscribe to teams for this tournament (needed for inline fixture form)
  useEffect(() => {
    if (!tournamentId) return
    const unsub = subscribeToTeamsByTournament(tournamentId, [], setTeams)
    return unsub
  }, [tournamentId])

  const isAdmin = canManageTournament || (!!user && !!tournament && user.uid === tournament.adminId)

  const handleStatusChange = useCallback(async (status: Tournament['status']) => {
    if (!tournament || !isAdmin) return
    try {
      await setTournamentStatus(tournament.id, status)
      showToast(`Tournament ${status}!`, 'success')
    } catch { showToast('Failed to update status.', 'error') }
  }, [tournament, isAdmin, showToast])

  // ── Inline team creation ─────────────────────────────────────────────────────
  async function handleCreateTeam() {
    if (!user || !tournament || !newTeamName.trim()) return
    setTeamCreateLoading(true)
    try {
      const teamId = await createTeam({
        teamName: newTeamName.trim(), logo: newTeamLogo,
        captain: '', createdBy: user.uid, tournamentId: tournament.id,
      })
      await addTeamToTournament(tournament.id, teamId)
      showToast(`Team "${newTeamName.trim()}" created! 🎉`, 'success')
      setNewTeamName(''); setNewTeamLogo('🏏'); setShowTeamCreate(false)
      setTimeout(() => navigate(`/teams/${teamId}`), 600)
    } catch { showToast('Failed to create team.', 'error') }
    finally { setTeamCreateLoading(false) }
  }

  // ── Inline fixture creation ──────────────────────────────────────────────────
  async function handleCreateFixture() {
    if (!user || !tournament || !fixTeam1Id || !fixTeam2Id || !fixVenue.trim() || !fixDate) return
    const t1 = teams.find(t => t.id === fixTeam1Id)!
    const t2 = teams.find(t => t.id === fixTeam2Id)!
    setFixCreateLoading(true)
    try {
      const id = await createMatch({
        title: `${t1.teamName} vs ${t2.teamName}`,
        format: fixFormat, totalOvers: fixOvers, venue: fixVenue.trim(),
        scheduledAt: fixDate, team1Id: fixTeam1Id, team1Name: t1.teamName, team1Logo: t1.logo,
        team2Id: fixTeam2Id, team2Name: t2.teamName, team2Logo: t2.logo,
        tournamentId: tournament.id, createdBy: user.uid,
      })
      showToast('Fixture created! 🏏', 'success')
      setFixTeam1Id(''); setFixTeam2Id(''); setFixVenue(''); setFixDate(''); setShowFixCreate(false)
      navigate(`/matches/${id}`)
    } catch { showToast('Failed to create fixture.', 'error') }
    finally { setFixCreateLoading(false) }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="teams-loading">
          <div className="team-spinner team-spinner--lg" /><p>Loading tournament…</p>
        </div>
      </AppShell>
    )
  }

  if (!tournament) {
    return (
      <AppShell>
        <div className="teams-empty">
          <div className="teams-empty-icon">😕</div>
          <h2 className="teams-empty-title">Tournament not found</h2>
          <button className="team-btn team-btn--primary" onClick={() => navigate('/tournaments')}>All Tournaments</button>
        </div>
      </AppShell>
    )
  }

  if (!accessGranted) {
    return (
      <AppShell>
        <CodeGate tournamentId={tournament.id} onAccess={() => setAccessGranted(true)} />
      </AppShell>
    )
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview',  icon: '📋' },
    { id: 'fixtures', label: 'Fixtures',  icon: '📅' },
    { id: 'points',   label: 'Points',    icon: '🏅' },
    { id: 'awards',   label: 'Awards',    icon: '🏆' },
  ]

  const statusColor: Record<Tournament['status'], string> = {
    draft: '#64748b', registration: '#22d3ee', active: '#34d399', completed: '#f59e0b', cancelled: '#f87171',
  }

  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="teams-page">

        {/* Back */}
        <button className="team-back-btn" onClick={() => navigate('/tournaments')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Tournaments
        </button>

        {/* Hero */}
        <div style={{
          background: 'rgba(31,41,55,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24, padding: '28px 32px', marginTop: 16, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 52 }}>{tournament.logo}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                <h1 style={{ color: '#1f2937', fontSize: 28, fontWeight: 800, margin: 0 }}>{tournament.name}</h1>
                <span style={{
                  background: `${statusColor[tournament.status]}22`, color: statusColor[tournament.status],
                  border: `1px solid ${statusColor[tournament.status]}44`, borderRadius: 999,
                  padding: '3px 12px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                }}>{tournament.status}</span>
              </div>
              <p style={{ color: '#64748b', margin: '0 0 12px', fontSize: 14 }}>{tournament.description}</p>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>📍 {tournament.venue || '—'}</span>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>📅 {tournament.startDate || '—'}</span>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>🏆 {tournament.format}</span>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>👥 {tournament.teamIds.length}/{tournament.maxTeams} teams</span>
              </div>
            </div>
            {/* Code display (admin only) */}
            {isAdmin && (
              <div style={{
                background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)',
                borderRadius: 14, padding: '12px 20px', textAlign: 'center', minWidth: 160,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Tournament Code</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#1f2937', letterSpacing: 8, fontFamily: 'monospace' }}>
                  {tournament.tournamentCode}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Share to invite players</div>
              </div>
            )}
          </div>

          {/* Admin controls */}
          {isAdmin && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {tournament.status === 'draft' && (
                <button className="team-btn team-btn--primary team-btn--sm" onClick={() => handleStatusChange('registration')}>
                  📢 Open Registration
                </button>
              )}
              {tournament.status === 'registration' && (
                <button className="team-btn team-btn--primary team-btn--sm" onClick={() => handleStatusChange('active')}>
                  ▶ Start Tournament
                </button>
              )}
              {tournament.status === 'active' && (
                <button className="team-btn team-btn--outline team-btn--sm" onClick={() => handleStatusChange('completed')}>
                  🏁 Complete Tournament
                </button>
              )}
              <button className="team-btn team-btn--ghost team-btn--sm" onClick={() => navigate(`/tournaments/${tournament.id}/settings`)}>
                ⚙️ Settings
              </button>
            </div>
          )}
        </div>

        {/* ── Admin Workflow Guide ─────────────────────────────────────── */}
        {isAdmin && (
          <div style={{
            background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.15)',
            borderRadius: 20, padding: '20px 24px', marginBottom: 24,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
              🗺️ Admin Setup Checklist
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Step 1: Teams */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(31,41,55,0.05)', borderRadius: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, background: tournament.teamIds.length >= 2 ? 'rgba(52,211,153,0.2)' : 'rgba(245,158,11,0.2)', color: tournament.teamIds.length >= 2 ? '#34d399' : '#f59e0b', flexShrink: 0 }}>
                  {tournament.teamIds.length >= 2 ? '✓' : '1'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>Create Teams</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{tournament.teamIds.length} team{tournament.teamIds.length !== 1 ? 's' : ''} created</div>
                </div>
                <button className="team-btn team-btn--outline team-btn--sm" onClick={() => setShowTeamCreate(true)}>
                  + Team
                </button>
              </div>

              {/* Step 2: Players */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(31,41,55,0.05)', borderRadius: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, background: 'rgba(167,139,250,0.2)', color: '#a78bfa', flexShrink: 0 }}>2</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>Add Players to Teams</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Go into each team → Add Player</div>
                </div>
                {tournament.teamIds.length > 0 && (
                  <button className="team-btn team-btn--outline team-btn--sm" onClick={() => setTab('overview')}>
                    View Teams
                  </button>
                )}
              </div>

              {/* Step 3: Captain */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(31,41,55,0.05)', borderRadius: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', flexShrink: 0 }}>3</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>Set Captain</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Edit team → select captain from added players</div>
                </div>
              </div>

              {/* Step 4: Fixtures */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(31,41,55,0.05)', borderRadius: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, background: matches.length > 0 ? 'rgba(52,211,153,0.2)' : 'rgba(34,211,238,0.2)', color: matches.length > 0 ? '#34d399' : '#22d3ee', flexShrink: 0 }}>
                  {matches.length > 0 ? '✓' : '4'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>Create Fixtures</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{matches.length} fixture{matches.length !== 1 ? 's' : ''} scheduled</div>
                </div>
                <button className="team-btn team-btn--primary team-btn--sm" onClick={() => { setTab('fixtures'); setShowFixCreate(true) }}>
                  + Fixture
                </button>
              </div>

              {/* Step 5: Toss & Play */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(31,41,55,0.05)', borderRadius: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, background: 'rgba(239,68,68,0.15)', color: '#f87171', flexShrink: 0 }}>5</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>Toss → Bat/Bowl → Live Score</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Click any fixture → "Do Toss & Start Match"</div>
                </div>
                {matches.length > 0 && (
                  <button className="team-btn team-btn--ghost team-btn--sm" onClick={() => setTab('fixtures')}>
                    Fixtures
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="match-tabs" role="tablist" style={{ marginBottom: 24 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`match-tab${tab === t.id ? ' match-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {[
              { icon: '📅', label: 'Start Date', value: tournament.startDate || '—' },
              { icon: '📅', label: 'End Date', value: tournament.endDate || '—' },
              { icon: '🏟', label: 'Format', value: tournament.format },
              { icon: '👥', label: 'Max Teams', value: String(tournament.maxTeams) },
              { icon: '🏆', label: 'Teams Joined', value: String(tournament.teamIds.length) },
              { icon: '🏏', label: 'Matches', value: String(tournament.matchIds.length) },
              { icon: '💰', label: 'Prize Pool', value: tournament.prizePool || '—' },
              { icon: '👤', label: 'Organizer', value: tournament.adminName },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'rgba(31,41,55,0.05)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16, padding: '16px 20px',
              }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{stat.icon}</div>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'fixtures' && (
          <div>
            {isAdmin && (
              <div style={{ marginBottom: 16 }}>
                {!showFixCreate ? (
                  <button
                    className="team-btn team-btn--primary team-btn--sm"
                    onClick={() => setShowFixCreate(true)}
                    disabled={teams.length < 2}
                    title={teams.length < 2 ? 'Create at least 2 teams first' : ''}
                  >
                    + Create Fixture
                  </button>
                ) : (
                  <div style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
                    <div style={{ fontWeight: 800, color: '#22d3ee', fontSize: 14, marginBottom: 16 }}>📅 New Fixture</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <select className="team-form-input" value={fixTeam1Id} onChange={e => setFixTeam1Id(e.target.value)}>
                        <option value="">— Team 1 —</option>
                        {teams.map(t => <option key={t.id} value={t.id} disabled={t.id === fixTeam2Id}>{t.logo} {t.teamName}</option>)}
                      </select>
                      <select className="team-form-input" value={fixTeam2Id} onChange={e => setFixTeam2Id(e.target.value)}>
                        <option value="">— Team 2 —</option>
                        {teams.map(t => <option key={t.id} value={t.id} disabled={t.id === fixTeam1Id}>{t.logo} {t.teamName}</option>)}
                      </select>
                      <input className="team-form-input" type="text" placeholder="Venue / Ground" value={fixVenue} onChange={e => setFixVenue(e.target.value)} />
                      <input className="team-form-input" type="datetime-local" value={fixDate} onChange={e => setFixDate(e.target.value)} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(['T10','T20','ODI'] as const).map(f => (
                          <button key={f} type="button"
                            className={`player-form-chip${fixFormat === f ? ' player-form-chip--active' : ''}`}
                            onClick={() => { setFixFormat(f); setFixOvers(f === 'T10' ? 10 : f === 'T20' ? 20 : 50) }}>
                            {f}
                          </button>
                        ))}
                      </div>
                      <input className="team-form-input" type="number" min={1} max={90} value={fixOvers} onChange={e => setFixOvers(parseInt(e.target.value) || 20)} placeholder="Overs" />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button className="team-btn team-btn--ghost" onClick={() => setShowFixCreate(false)}>Cancel</button>
                      <button
                        className="team-btn team-btn--primary"
                        disabled={!fixTeam1Id || !fixTeam2Id || !fixVenue.trim() || !fixDate || fixCreateLoading}
                        onClick={handleCreateFixture}
                      >
                        {fixCreateLoading ? <><span className="team-spinner" /> Creating…</> : '✅ Create Fixture'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <FixturesList matches={matches} isAdmin={isAdmin} />
          </div>
        )}
        {tab === 'points' && <PointsTable tournament={tournament} table={tournament.pointsTable} />}
        {tab === 'awards' && <AwardsSection tournament={tournament} />}

        {/* ── Inline Team Create Modal ──────────────────────────────── */}
        {showTeamCreate && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setShowTeamCreate(false)}>
            <div style={{ background: 'linear-gradient(160deg,#0f172a,#1e293b)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 20, padding: '28px 24px', maxWidth: 420, width: '100%' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight: 900, fontSize: 20, color: '#1f2937', marginBottom: 20 }}>🏏 Create Team</div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 6, display: 'block' }}>Team Name *</label>
                <input className="team-form-input" placeholder="e.g. Thunder XI" value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)} maxLength={40} autoFocus />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 6, display: 'block' }}>Logo</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TEAM_LOGOS.map(l => (
                    <button key={l} type="button"
                      style={{ fontSize: 20, padding: '6px 10px', borderRadius: 8, border: `2px solid ${newTeamLogo === l ? '#22d3ee' : 'transparent'}`, background: newTeamLogo === l ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.05)', cursor: 'pointer' }}
                      onClick={() => setNewTeamLogo(l)}>{l}
                    </button>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#475569', margin: '0 0 16px' }}>💡 After creating, add players and set captain from the team page.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="team-btn team-btn--ghost" style={{ flex: 1 }} onClick={() => setShowTeamCreate(false)}>Cancel</button>
                <button className="team-btn team-btn--primary" style={{ flex: 2 }}
                  disabled={!newTeamName.trim() || teamCreateLoading} onClick={handleCreateTeam}>
                  {teamCreateLoading ? <><span className="team-spinner" /> Creating…</> : '✅ Create Team'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
