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
import { subscribeToTournament, setTournamentStatus } from '../../services/tournamentService'
import { getTournamentByCode } from '../../services/tournamentService'
import { subscribeToAllMatches } from '../../services/matchService'
import type { Tournament, PointsTableEntry } from '../../types/tournament'
import type { Match } from '../../types/match'
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

  async function handleJoin() {
    if (code.trim().length !== 6) { setError('Code must be 6 characters.'); return }
    const t = await getTournamentByCode(code.trim())
    if (!t) { setError('Invalid code. Please check and try again.'); return }
    if (t.id !== tournamentId) { setError('This code is for a different tournament.'); return }
    grantAccess(tournamentId, code.trim())
    onAccess()
  }

  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 24, padding: '40px 20px',
    }}>
      <div style={{ fontSize: 48 }}>🔐</div>
      <h2 style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 800, margin: 0, textAlign: 'center' }}>
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

function PointsTable({ table }: { table: PointsTableEntry[] }) {
  if (table.length === 0) {
    return <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>Points table will update after matches are played.</p>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="live-scorecard-table" style={{ width: '100%', minWidth: 480 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>#</th>
            <th style={{ textAlign: 'left' }}>Team</th>
            <th>P</th><th>W</th><th>L</th><th>T</th>
            <th>NRR</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => (
            <tr key={row.teamId} style={{ background: i === 0 ? 'rgba(34,211,238,0.05)' : undefined }}>
              <td style={{ color: i < 2 ? '#22d3ee' : '#64748b', fontWeight: 700 }}>{i + 1}</td>
              <td>
                <span style={{ marginRight: 8 }}>{row.teamLogo}</span>
                <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{row.teamName}</span>
              </td>
              <td>{row.played}</td>
              <td style={{ color: '#34d399', fontWeight: 700 }}>{row.won}</td>
              <td style={{ color: '#f87171' }}>{row.lost}</td>
              <td>{row.tied}</td>
              <td style={{ color: row.nrr >= 0 ? '#34d399' : '#f87171' }}>
                {row.nrr >= 0 ? '+' : ''}{row.nrr.toFixed(3)}
              </td>
              <td style={{ color: '#f59e0b', fontWeight: 800 }}>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>{item.name}</div>
          {item.stat && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{item.stat}</div>}
        </div>
      ))}
    </div>
  )
}

// ── Match Fixtures ─────────────────────────────────────────────────────────────

function FixturesList({ matches, tournamentId }: { matches: Match[]; tournamentId: string }) {
  const navigate = useNavigate()
  const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId)

  if (tournamentMatches.length === 0) {
    return <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No fixtures scheduled yet.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {tournamentMatches.map(m => (
        <div
          key={m.id}
          onClick={() => navigate(`/matches/${m.id}`)}
          style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '14px 18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(34,211,238,0.3)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
        >
          <div>
            <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>{m.title}</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
              {m.team1Name} vs {m.team2Name} · {m.venue}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {m.status === 'live' && (
              <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>🔴 LIVE</span>
            )}
            {m.status === 'upcoming' && (
              <span style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>📅 Upcoming</span>
            )}
            {m.status === 'completed' && (
              <span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>✅ Done</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'fixtures' | 'points' | 'awards'

export default function TournamentDetailPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toasts, showToast, dismissToast } = useToast()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [accessGranted, setAccessGranted] = useState(false)

  // Check access on mount
  useEffect(() => {
    if (!tournamentId) return
    // Owner always has access — check after tournament loads
  }, [tournamentId])

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
        } else if (hasAccess(tournamentId, t.tournamentCode)) {
          setAccessGranted(true)
        }
      }
    })
    return unsub
  }, [tournamentId, user?.uid])

  // Subscribe to all matches (filter by tournamentId in render)
  useEffect(() => {
    const unsub = subscribeToAllMatches(setMatches)
    return unsub
  }, [])

  const isOwner = !!user && !!tournament && user.uid === tournament.adminId

  const handleStatusChange = useCallback(async (status: Tournament['status']) => {
    if (!tournament || !isOwner) return
    try {
      await setTournamentStatus(tournament.id, status)
      showToast(`Tournament ${status}!`, 'success')
    } catch { showToast('Failed to update status.', 'error') }
  }, [tournament, isOwner, showToast])

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
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24, padding: '28px 32px', marginTop: 16, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 52 }}>{tournament.logo}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                <h1 style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 800, margin: 0 }}>{tournament.name}</h1>
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
            {/* Code display (owner only) */}
            {isOwner && (
              <div style={{
                background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)',
                borderRadius: 14, padding: '12px 20px', textAlign: 'center', minWidth: 160,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Tournament Code</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#f1f5f9', letterSpacing: 8, fontFamily: 'monospace' }}>
                  {tournament.tournamentCode}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Share to invite players</div>
              </div>
            )}
          </div>

          {/* Owner controls */}
          {isOwner && (
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
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16, padding: '16px 20px',
              }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{stat.icon}</div>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'fixtures' && <FixturesList matches={matches} tournamentId={tournament.id} />}
        {tab === 'points' && <PointsTable table={tournament.pointsTable} />}
        {tab === 'awards' && <AwardsSection tournament={tournament} />}
      </div>
    </AppShell>
  )
}
