// src/pages/Players/PlayersPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Players listing page for a given team.
// Route: /teams/:teamId/players
//
// Features:
//   • Fetch players from Firestore via playerService (one-time + manual refresh)
//   • Live search by name, email, or jersey number
//   • Filter chips by Role
//   • Player cards with stats summary
//   • Add Player slide-in panel using PlayerForm
//   • Empty state (no players / no search results)
//   • Loading skeleton state
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { PlayerForm, type PlayerFormData } from '../../components/player/PlayerForm'
import { ConfirmModal } from '../../components/common/ConfirmModal'
import { useRole } from '../../context/RoleContext'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useAuth } from '../../context/AuthContext'
import { useActiveTournament } from '../../context/ActiveTournamentContext'
import {
  getPlayersByTeam,
  createPlayer,
  deletePlayer,
} from '../../services/playerService'
import type { Player, PlayerRole } from '../../types/player'
import { emptyBattingStats, emptyBowlingStats, emptyFieldingStats } from '../../types/player'
import '../../styles/teams.css'

// ── Role filter options ───────────────────────────────────────────────────────

const ROLE_FILTERS: Array<{ label: string; value: PlayerRole | 'All' }> = [
  { label: 'All',            value: 'All' },
  { label: '🏏 Batsman',     value: 'Batsman' },
  { label: '⚡ Bowler',      value: 'Bowler' },
  { label: '🌟 All-Rounder', value: 'All-Rounder' },
  { label: '🧤 Keeper',      value: 'Wicket-Keeper' },
]

// ── Role accent colours ───────────────────────────────────────────────────────

const ROLE_COLOR: Record<PlayerRole, string> = {
  'Batsman':       '#22d3ee',
  'Bowler':        '#f59e0b',
  'All-Rounder':   '#a78bfa',
  'Wicket-Keeper': '#34d399',
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function PlayerSkeleton() {
  return (
    <div className="player-card player-card--skeleton" aria-hidden="true">
      <div className="player-card-skeleton-avatar" />
      <div className="player-card-skeleton-lines">
        <div className="player-card-skeleton-line" style={{ width: '60%' }} />
        <div className="player-card-skeleton-line" style={{ width: '40%' }} />
      </div>
    </div>
  )
}

// ── Player Card ───────────────────────────────────────────────────────────────

interface PlayerCardProps {
  player: Player
  canManageTeams?: boolean
  onDelete: (player: Player) => void
}

function PlayerCard({ player, canManageTeams, onDelete }: PlayerCardProps) {
  const color = ROLE_COLOR[player.role] ?? '#22d3ee'
  const initials = player.name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="player-card" style={{ '--player-accent': color } as React.CSSProperties}>
      {/* Avatar */}
      <div className="player-card-avatar" style={{ background: `linear-gradient(135deg, ${color}33, ${color}11)`, border: `1.5px solid ${color}44` }}>
        <span className="player-card-initials" style={{ color }}>{initials}</span>
        {player.jerseyNumber > 0 && (
          <span className="player-card-jersey" style={{ color }}>#{player.jerseyNumber}</span>
        )}
      </div>

      {/* Info */}
      <div className="player-card-body">
        <h3 className="player-card-name">{player.name}</h3>

        <span className="player-card-role" style={{ color, borderColor: `${color}44`, background: `${color}11` }}>
          {player.role}
        </span>

        {(player.battingStyle !== 'Right-Handed' || player.bowlingStyle !== 'N/A') && (
          <p className="player-card-styles">
            {player.battingStyle}
            {player.bowlingStyle !== 'N/A' && ` · ${player.bowlingStyle}`}
          </p>
        )}

        {/* Stats row */}
        <div className="player-card-stats">
          <div className="player-card-stat">
            <span className="player-card-stat-val">{player.matches}</span>
            <span className="player-card-stat-lbl">M</span>
          </div>
          <div className="player-card-stat">
            <span className="player-card-stat-val">{player.runs}</span>
            <span className="player-card-stat-lbl">Runs</span>
          </div>
          <div className="player-card-stat">
            <span className="player-card-stat-val">{player.wickets}</span>
            <span className="player-card-stat-lbl">Wkts</span>
          </div>
          {player.average > 0 && (
            <div className="player-card-stat">
              <span className="player-card-stat-val">{player.average.toFixed(1)}</span>
              <span className="player-card-stat-lbl">Avg</span>
            </div>
          )}
        </div>

        {/* Contact (optional) */}
        {player.email && (
          <p className="player-card-contact">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            {player.email}
          </p>
        )}
      </div>

      {/* Delete button */}
      {canManageTeams && (
        <button
          className="player-card-delete"
          onClick={() => onDelete(player)}
          aria-label={`Remove ${player.name}`}
          title="Remove player"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlayersPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const { activeTournamentId } = useActiveTournament()
  const { toasts, showToast, dismissToast } = useToast()
  const { canManageTeams } = useRole()

  // ── Data state ──────────────────────────────────────────────────────────────
  const [players, setPlayers]   = useState<Player[]>([])
  const [loading, setLoading]   = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // ── UI state ────────────────────────────────────────────────────────────────
  const [search, setSearch]           = useState('')
  const [roleFilter, setRoleFilter]   = useState<PlayerRole | 'All'>('All')
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [deletingPlayer, setDeletingPlayer] = useState<Player | null>(null)
  const [deleteLoading, setDeleteLoading]   = useState(false)

  // ── Fetch players ───────────────────────────────────────────────────────────
  const fetchPlayers = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    setFetchError(null)
    try {
      const data = await getPlayersByTeam(teamId)
      setPlayers(data)
    } catch {
      setFetchError('Failed to load players. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => { fetchPlayers() }, [fetchPlayers])

  // ── Guard: no teamId ────────────────────────────────────────────────────────
  if (!teamId) {
    navigate('/teams', { replace: true })
    return null
  }

  // ── Derived: filtered list ──────────────────────────────────────────────────
  const filtered = players.filter(p => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      String(p.jerseyNumber).includes(q)
    const matchesRole = roleFilter === 'All' || p.role === roleFilter
    return matchesSearch && matchesRole
  })

  // ── Add player ──────────────────────────────────────────────────────────────
  async function handleAddPlayer(data: PlayerFormData) {
    if (!user) { showToast('Please log in to add a player.', 'error'); return }
    try {
      await createPlayer({
        ...data,
        userId:     '',
        bio:        '',
        avatarUrl:  '',
        teamId:     teamId ?? '',
        tournamentId: activeTournamentId || '',
        matches:    0,
        runs:       0,
        wickets:    0,
        average:    0,
        strikeRate: 0,
        economy:    0,
        batting:    emptyBattingStats(),
        bowling:    emptyBowlingStats(),
        fielding:   emptyFieldingStats(),
        battingT20:  emptyBattingStats(),
        bowlingT20:  emptyBowlingStats(),
        battingODI:  emptyBattingStats(),
        bowlingODI:  emptyBowlingStats(),
        battingTest: emptyBattingStats(),
        bowlingTest: emptyBowlingStats(),
        createdBy:  user.uid,
      })
      showToast(`${data.name} added to the squad! 🎉`, 'success')
      setShowAddPanel(false)
      await fetchPlayers()
    } catch {
      showToast('Failed to add player. Please try again.', 'error')
      throw new Error('Add failed')
    }
  }

  // ── Delete player ───────────────────────────────────────────────────────────
  async function handleDeleteConfirm() {
    if (!deletingPlayer) return
    setDeleteLoading(true)
    try {
      await deletePlayer(deletingPlayer.id)
      showToast(`${deletingPlayer.name} removed from squad.`, 'info')
      setDeletingPlayer(null)
      await fetchPlayers()
    } catch {
      showToast('Failed to remove player. Please try again.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Add Player slide-in panel */}
      {showAddPanel && (
        <div
          className="team-side-panel-overlay"
          onClick={() => setShowAddPanel(false)}
        >
          <div className="team-side-panel" onClick={e => e.stopPropagation()}>
            <div className="team-side-panel-header">
              <h2 className="team-side-panel-title">➕ Add Player</h2>
              <button
                className="team-side-panel-close"
                onClick={() => setShowAddPanel(false)}
                aria-label="Close panel"
              >
                ×
              </button>
            </div>
            <PlayerForm
              onSubmit={handleAddPlayer}
              onCancel={() => setShowAddPanel(false)}
              submitLabel="Add to Squad"
            />
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      <ConfirmModal
        isOpen={!!deletingPlayer}
        title="Remove Player"
        message={`Are you sure you want to remove "${deletingPlayer?.name}" from the squad? Their stats will be permanently deleted.`}
        confirmLabel="Remove Player"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingPlayer(null)}
        dangerous
        loading={deleteLoading}
      />

      <div className="teams-page">
        {/* ── Page header ────────────────────────────────────────────────── */}
        <div className="teams-page-header">
          <div className="teams-page-title-block">
            {/* Back link */}
            <button className="team-back-btn" onClick={() => navigate(`/teams/${teamId}`)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Team
            </button>

            <h1 className="teams-page-title" style={{ marginTop: 8 }}>
              <span className="teams-page-title-icon">👥</span>
              Squad Players
            </h1>
            <p className="teams-page-subtitle">
              Manage your team roster, track performance, and build your squad.
            </p>
          </div>

          {canManageTeams && (
            <button
              id="add-player-btn"
              className="team-btn team-btn--primary"
              onClick={() => setShowAddPanel(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              Add Player
            </button>
          )}
        </div>

        {/* ── Search bar ─────────────────────────────────────────────────── */}
        <div className="teams-search-bar">
          <svg className="teams-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="players-search-input"
            className="teams-search-input"
            type="text"
            placeholder="Search by name, email, or jersey number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="teams-search-clear"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* ── Role filter chips ───────────────────────────────────────────── */}
        <div className="player-filter-chips" role="group" aria-label="Filter by role">
          {ROLE_FILTERS.map(f => (
            <button
              key={f.value}
              className={`player-filter-chip${roleFilter === f.value ? ' player-filter-chip--active' : ''}`}
              onClick={() => setRoleFilter(f.value)}
              aria-pressed={roleFilter === f.value}
            >
              {f.label}
              {f.value !== 'All' && (
                <span className="player-filter-chip-count">
                  {players.filter(p => p.role === f.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          /* Loading skeletons */
          <div className="teams-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <PlayerSkeleton key={i} />
            ))}
          </div>

        ) : fetchError ? (
          /* Fetch error state */
          <div className="teams-empty">
            <div className="teams-empty-icon">⚠️</div>
            <h2 className="teams-empty-title">Could not load players</h2>
            <p className="teams-empty-sub">{fetchError}</p>
            <button className="team-btn team-btn--outline" onClick={fetchPlayers}>
              Try Again
            </button>
          </div>

        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="teams-empty">
            <div className="teams-empty-icon">
              {players.length === 0 ? '🏏' : '🔍'}
            </div>
            <h2 className="teams-empty-title">
              {players.length === 0
                ? 'No players yet'
                : 'No players match your search'}
            </h2>
            <p className="teams-empty-sub">
              {players.length === 0
                ? 'Add your first player to start building the squad!'
                : 'Try a different name, email, jersey number, or role filter.'}
            </p>
            {players.length === 0 && canManageTeams && (
              <button
                className="team-btn team-btn--primary"
                onClick={() => setShowAddPanel(true)}
              >
                Add First Player
              </button>
            )}
            {players.length > 0 && (search || roleFilter !== 'All') && (
              <button
                className="team-btn team-btn--ghost"
                onClick={() => { setSearch(''); setRoleFilter('All') }}
              >
                Clear Filters
              </button>
            )}
          </div>

        ) : (
          /* Player grid */
          <>
            <p className="teams-count">
              {filtered.length} player{filtered.length !== 1 ? 's' : ''}
              {(search || roleFilter !== 'All') && (
                <span style={{ color: '#64748b' }}> · filtered from {players.length}</span>
              )}
            </p>
            <div className="teams-grid">
              {filtered.map(player => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  canManageTeams={canManageTeams}
                  onDelete={setDeletingPlayer}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Scoped styles for player-specific elements */}
      <style>{PLAYERS_PAGE_STYLES}</style>
    </AppShell>
  )
}

// ── Scoped styles ─────────────────────────────────────────────────────────────
// Uses the same design tokens as teams.css (colours, radius, transitions).
// Only defines primitives that don't exist in teams.css.

const PLAYERS_PAGE_STYLES = `
  /* ── Role filter chips ── */
  .player-filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 24px;
  }
  .player-filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    border-radius: 999px;
    border: 1.5px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    color: #94a3b8;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.18s ease;
    white-space: nowrap;
  }
  .player-filter-chip:hover:not(.player-filter-chip--active) {
    border-color: rgba(34,211,238,0.35);
    color: #e2e8f0;
    background: rgba(34,211,238,0.06);
  }
  .player-filter-chip--active {
    border-color: #22d3ee;
    background: rgba(34,211,238,0.12);
    color: #22d3ee;
  }
  .player-filter-chip-count {
    background: rgba(255,255,255,0.08);
    border-radius: 999px;
    padding: 0 7px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.6;
  }
  .player-filter-chip--active .player-filter-chip-count {
    background: rgba(34,211,238,0.2);
  }

  /* ── Player card ── */
  .player-card {
    position: relative;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: all 0.25s ease;
    overflow: hidden;
  }
  .player-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: var(--player-accent, #22d3ee);
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  .player-card:hover {
    border-color: rgba(255,255,255,0.14);
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.25);
  }
  .player-card:hover::before { opacity: 1; }

  /* Avatar */
  .player-card-avatar {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    flex-shrink: 0;
  }
  .player-card-initials {
    font-size: 18px;
    font-weight: 800;
    line-height: 1;
  }
  .player-card-jersey {
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    opacity: 0.7;
  }

  /* Body */
  .player-card-body { flex: 1; }
  .player-card-name {
    font-size: 15px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .player-card-role {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid;
    border-radius: 999px;
    padding: 2px 10px;
    margin-bottom: 6px;
    letter-spacing: 0.02em;
  }
  .player-card-styles {
    font-size: 11px;
    color: #64748b;
    margin: 0 0 10px;
  }

  /* Stats row */
  .player-card-stats {
    display: flex;
    gap: 12px;
    margin-bottom: 6px;
  }
  .player-card-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  .player-card-stat-val {
    font-size: 15px;
    font-weight: 800;
    color: #e2e8f0;
    line-height: 1;
  }
  .player-card-stat-lbl {
    font-size: 10px;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Contact */
  .player-card-contact {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #475569;
    margin: 4px 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .player-card-contact svg { flex-shrink: 0; }

  /* Delete button */
  .player-card-delete {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1px solid rgba(239,68,68,0);
    background: rgba(239,68,68,0);
    color: #475569;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.18s ease;
    opacity: 0;
  }
  .player-card:hover .player-card-delete { opacity: 1; }
  .player-card-delete:hover {
    background: rgba(239,68,68,0.12);
    border-color: rgba(239,68,68,0.35);
    color: #f87171;
  }

  /* ── Skeleton ── */
  .player-card--skeleton {
    flex-direction: row;
    align-items: center;
    pointer-events: none;
    animation: skeletonPulse 1.6s ease-in-out infinite;
  }
  .player-card-skeleton-avatar {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: rgba(255,255,255,0.06);
    flex-shrink: 0;
  }
  .player-card-skeleton-lines {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-left: 16px;
  }
  .player-card-skeleton-line {
    height: 12px;
    border-radius: 6px;
    background: rgba(255,255,255,0.06);
  }
  @keyframes skeletonPulse {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.5; }
  }

  /* Responsive: single column on very small screens */
  @media (max-width: 400px) {
    .player-card-stats { gap: 8px; }
    .player-card-stat-val { font-size: 13px; }
  }
`
