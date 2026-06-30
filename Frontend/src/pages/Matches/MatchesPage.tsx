// src/pages/Matches/MatchesPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Matches listing page — real-time, tabbed by status, searchable.
// Tournament-isolated: only shows matches for the active tournament.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { MatchCard } from '../../components/match/MatchCard'
import { MatchForm, type MatchFormData } from '../../components/match/MatchForm'
import { ConfirmModal } from '../../components/common/ConfirmModal'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useAuth } from '../../context/AuthContext'
import { useActiveTournament } from '../../context/ActiveTournamentContext'
import { useRole } from '../../context/RoleContext'
import { createMatch, updateMatch, deleteMatch, cloneMatch, abandonMatch, subscribeToMatchesByTournament } from '../../services/matchService'
import { subscribeToTeamsByTournament } from '../../services/teamService'
import type { Match, MatchStatus } from '../../types/match'
import type { Team } from '../../types/team'

import '../../styles/teams.css'
import '../../styles/matches.css'

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS: Array<{ label: string; value: MatchStatus | 'all'; icon: string }> = [
  { label: 'All',       value: 'all',       icon: '📋' },
  { label: 'Live',      value: 'live',      icon: '🔴' },
  { label: 'Upcoming',  value: 'upcoming',  icon: '📅' },
  { label: 'Completed', value: 'completed', icon: '✅' },
  { label: 'Abandoned', value: 'abandoned', icon: '❌' },
]

// ── Hook: fetch tournament-scoped matches + teams ─────────────────────────────

function useMatchesData(tournamentId: string, teamIds: string[]) {
  const [matches, setMatches] = useState<Match[]>([])
  const [teams,   setTeams]   = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    // Subscribe to tournament-scoped matches (real-time)
    const unsubMatches = subscribeToMatchesByTournament(tournamentId, data => {
      setMatches(data)
      setLoading(false)
    })
    // Subscribe to tournament-scoped teams (real-time)
    const unsubTeams = subscribeToTeamsByTournament(tournamentId, teamIds, data => setTeams(data))
    return () => { unsubMatches(); unsubTeams() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, JSON.stringify(teamIds)])

  return { matches, teams, loading }
}


// ── Page ──────────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeTournamentId, activeTournament } = useActiveTournament()
  const { toasts, showToast, dismissToast } = useToast()
  const { canManageMatches } = useRole()

  // matches and teams are already tournament-scoped from the hook
  const { matches, teams, loading } = useMatchesData(activeTournamentId, activeTournament?.teamIds ?? [])

  const [tab,     setTab]     = useState<MatchStatus | 'all'>('all')
  const [search,  setSearch]  = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const [editingMatch,  setEditingMatch]  = useState<Match | null>(null)
  const [deletingMatch, setDeletingMatch] = useState<Match | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── Filtered matches ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return matches.filter(m => {
      const matchesTab    = tab === 'all' || m.status === tab
      const matchesSearch = !q ||
        m.title.toLowerCase().includes(q)      ||
        m.team1Name.toLowerCase().includes(q)  ||
        m.team2Name.toLowerCase().includes(q)  ||
        m.venue.toLowerCase().includes(q)
      return matchesTab && matchesSearch
    })
  }, [matches, tab, search])

  const countByTab = useMemo(() => ({
    all:       matches.length,
    live:      matches.filter(m => m.status === 'live').length,
    upcoming:  matches.filter(m => m.status === 'upcoming').length,
    completed: matches.filter(m => m.status === 'completed').length,
    abandoned: matches.filter(m => m.status === 'abandoned' || m.status === 'no_result' || m.status === 'cancelled').length,
  }), [matches])


  // ── Create ──────────────────────────────────────────────────────────────
  async function handleCreate(data: MatchFormData) {
    if (!user) { showToast('Please log in.', 'error'); return }
    try {
      const id = await createMatch({ ...data, tournamentId: activeTournamentId || '', createdBy: user.uid })
      showToast('Match created! 🏏', 'success')
      setShowAdd(false)
      setTimeout(() => navigate(`/matches/${id}`), 600)
    } catch {
      showToast('Failed to create match.', 'error')
      throw new Error('create failed')
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────
  async function handleEdit(data: MatchFormData) {
    if (!editingMatch) return
    try {
      await updateMatch(editingMatch.id, data)
      showToast('Match updated! ✅', 'success')
      setEditingMatch(null)
    } catch {
      showToast('Failed to update match.', 'error')
      throw new Error('update failed')
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deletingMatch) return
    setDeleteLoading(true)
    try {
      await deleteMatch(deletingMatch.id)
      showToast('Match deleted.', 'info')
      setDeletingMatch(null)
    } catch {
      showToast('Failed to delete match.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Clone ───────────────────────────────────────────────────────────────
  async function handleClone(match: Match) {
    try {
      const newId = await cloneMatch(match.id)
      showToast(`Cloned "${match.title}" — new fixture ready! 📋`, 'success')
      setTimeout(() => navigate(`/matches/${newId}`), 800)
    } catch {
      showToast('Failed to clone match.', 'error')
    }
  }

  // ── Abandon ─────────────────────────────────────────────────────────────
  async function handleAbandon(match: Match) {
    if (!window.confirm(`Abandon "${match.title}"? This will void the result.`)) return
    try {
      await abandonMatch(match.id)
      showToast('Match abandoned.', 'info')
    } catch {
      showToast('Failed to abandon match.', 'error')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Create match slide-in panel */}
      {showAdd && (
        <div className="team-side-panel-overlay" onClick={() => setShowAdd(false)}>
          <div className="team-side-panel" onClick={e => e.stopPropagation()}>
            <div className="team-side-panel-header">
              <h2 className="team-side-panel-title">🏏 Create Match</h2>
              <button className="team-side-panel-close" onClick={() => setShowAdd(false)}>×</button>
            </div>
            <MatchForm teams={teams} onSubmit={handleCreate} onCancel={() => setShowAdd(false)} submitLabel="Create Match" />
          </div>
        </div>
      )}

      {/* Edit match slide-in panel */}
      {editingMatch && (
        <div className="team-side-panel-overlay" onClick={() => setEditingMatch(null)}>
          <div className="team-side-panel" onClick={e => e.stopPropagation()}>
            <div className="team-side-panel-header">
              <h2 className="team-side-panel-title">✏️ Edit Match</h2>
              <button className="team-side-panel-close" onClick={() => setEditingMatch(null)}>×</button>
            </div>
            <MatchForm existing={editingMatch} teams={teams} onSubmit={handleEdit} onCancel={() => setEditingMatch(null)} submitLabel="Save Changes" />
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deletingMatch}
        title="Delete Match"
        message={`Delete "${deletingMatch?.title}"? This cannot be undone.`}
        confirmLabel="Delete Match"
        onConfirm={handleDelete}
        onCancel={() => setDeletingMatch(null)}
        dangerous
        loading={deleteLoading}
      />

      <div className="matches-page">
        {/* Header */}
        <div className="matches-page-header">
          <div className="matches-page-title-block">
            <h1 className="matches-page-title">
              <span className="matches-page-title-icon">🏏</span>
              Matches
              {activeTournament && <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b', marginLeft: 8 }}>· {activeTournament.name}</span>}
            </h1>
            <p className="matches-page-subtitle">Browse, track, and manage cricket matches.</p>
          </div>
          {canManageMatches && (
            <div className="matches-page-actions">
              <button
                id="create-match-btn"
                className="team-btn team-btn--primary"
                onClick={() => setShowAdd(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Create Match
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="match-tabs" role="tablist">
          {TABS.map(t => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              className={`match-tab${tab === t.value ? ' match-tab--active' : ''}`}
              onClick={() => setTab(t.value)}
            >
              {t.icon} {t.label}
              <span className="match-tab-count">
                {t.value === 'all' ? countByTab.all : countByTab[t.value as keyof typeof countByTab] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="teams-search-bar" style={{ marginBottom: 24 }}>
          <svg className="teams-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="matches-search-input"
            className="teams-search-input"
            type="text"
            placeholder="Search by title, team, or venue…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="teams-search-clear" onClick={() => setSearch('')}>×</button>}
        </div>

        {/* Content */}
        {loading ? (
          <div className="teams-loading">
            <div className="team-spinner team-spinner--lg" />
            <p>Loading matches…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="teams-empty">
            <div className="teams-empty-icon">{search ? '🔍' : '🏏'}</div>
            <h2 className="teams-empty-title">
              {search ? 'No matches found' : 'No matches yet'}
            </h2>
            <p className="teams-empty-sub">
              {search ? 'Try a different search term.' : 'Create the first match to get started!'}
            </p>
            {!search && canManageMatches && (
              <button className="team-btn team-btn--primary" onClick={() => setShowAdd(true)}>
                Create First Match
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="teams-count">{filtered.length} match{filtered.length !== 1 ? 'es' : ''}</p>
            <div className="matches-grid">
              {filtered.map(m => (
                <MatchCard
                  key={m.id}
                  match={m}
                  isOwner={canManageMatches}
                  onEdit={setEditingMatch}
                  onDelete={setDeletingMatch}
                  onClone={canManageMatches ? handleClone : undefined}
                  onAbandon={canManageMatches && (m.status === 'live' || m.status === 'upcoming') ? handleAbandon : undefined}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
