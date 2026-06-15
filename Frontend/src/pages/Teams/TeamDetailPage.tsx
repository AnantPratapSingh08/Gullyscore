// src/pages/Teams/TeamDetailPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Team Detail page — shows full team info, invite code, player roster.
// Real-time updates via Firestore subscriptions.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { TeamForm } from '../../components/team/TeamForm'
import { ConfirmModal } from '../../components/common/ConfirmModal'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useTeam, usePlayers } from '../../hooks/useTeams'
import { useAuth } from '../../context/AuthContext'
import {
  updateTeam,
  deleteTeam,
  addPlayer,
  removePlayer,
  regenerateInviteCode,
} from '../../services/teamService'
import type { Player } from '../../types/team'
import '../../styles/teams.css'

const ROLE_COLORS: Record<Player['role'], string> = {
  'Batsman':        'rgba(34,211,238,0.15)',
  'Bowler':         'rgba(167,139,250,0.15)',
  'All-Rounder':    'rgba(52,211,153,0.15)',
  'Wicket-Keeper':  'rgba(245,158,11,0.15)',
}
const ROLE_TEXT: Record<Player['role'], string> = {
  'Batsman':       '#22d3ee',
  'Bowler':        '#a78bfa',
  'All-Rounder':   '#34d399',
  'Wicket-Keeper': '#f59e0b',
}

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toasts, showToast, dismissToast } = useToast()

  const { team, loading: teamLoading } = useTeam(teamId)
  const { players, loading: playersLoading } = usePlayers(teamId)

  const isOwner = user?.uid === team?.createdBy

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false)

  // ── Delete state ───────────────────────────────────────────────────────────
  const [showDelete, setShowDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── Add player state ───────────────────────────────────────────────────────
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [playerName, setPlayerName]       = useState('')
  const [playerRole, setPlayerRole]       = useState<Player['role']>('Batsman')
  const [addingPlayer, setAddingPlayer]   = useState(false)
  const [playerError, setPlayerError]     = useState('')

  // ── Remove player state ────────────────────────────────────────────────────
  const [removingPlayer, setRemovingPlayer] = useState<Player | null>(null)
  const [removeLoading, setRemoveLoading]   = useState(false)

  // ── Invite code copy ───────────────────────────────────────────────────────
  const [codeCopied, setCodeCopied] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)

  async function copyInviteCode() {
    if (!team) return
    await navigator.clipboard?.writeText(team.inviteCode)
    setCodeCopied(true)
    showToast('Invite code copied!', 'success')
    setTimeout(() => setCodeCopied(false), 2000)
  }

  async function handleRegenCode() {
    if (!team) return
    setRegenLoading(true)
    try {
      const newCode = await regenerateInviteCode(team.id)
      showToast(`New invite code: ${newCode}`, 'success')
    } catch {
      showToast('Failed to regenerate code.', 'error')
    } finally {
      setRegenLoading(false)
    }
  }

  // ── Edit submit ────────────────────────────────────────────────────────────
  async function handleEdit(data: { teamName: string; logo: string; captain: string }) {
    if (!team) return
    try {
      await updateTeam(team.id, data)
      showToast(`Team updated! ✅`, 'success')
      setShowEdit(false)
    } catch {
      showToast('Failed to update. Try again.', 'error')
      throw new Error('fail')
    }
  }

  // ── Delete submit ──────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!team) return
    setDeleteLoading(true)
    try {
      await deleteTeam(team.id)
      showToast(`Team deleted.`, 'info')
      navigate('/my-teams', { replace: true })
    } catch {
      showToast('Failed to delete team. Try again.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Add player ─────────────────────────────────────────────────────────────
  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!playerName.trim()) { setPlayerError('Player name is required.'); return }
    if (playerName.trim().length < 2) { setPlayerError('Name must be at least 2 characters.'); return }
    if (!team || !user) return
    setPlayerError('')
    setAddingPlayer(true)
    try {
      await addPlayer(team.id, { name: playerName.trim(), role: playerRole, addedBy: user.uid })
      showToast(`${playerName.trim()} added to the squad! 🏏`, 'success')
      setPlayerName('')
      setPlayerRole('Batsman')
      setShowAddPlayer(false)
    } catch {
      showToast('Failed to add player. Try again.', 'error')
    } finally {
      setAddingPlayer(false)
    }
  }

  // ── Remove player ──────────────────────────────────────────────────────────
  async function handleRemovePlayer() {
    if (!removingPlayer || !team) return
    setRemoveLoading(true)
    try {
      await removePlayer(team.id, removingPlayer.id)
      showToast(`${removingPlayer.name} removed from squad.`, 'info')
      setRemovingPlayer(null)
    } catch {
      showToast('Failed to remove player.', 'error')
    } finally {
      setRemoveLoading(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (teamLoading) {
    return (
      <AppShell>
        <div className="teams-loading">
          <div className="team-spinner team-spinner--lg" />
          <p>Loading team…</p>
        </div>
      </AppShell>
    )
  }

  if (!team) {
    return (
      <AppShell>
        <div className="teams-empty">
          <div className="teams-empty-icon">😕</div>
          <h2 className="teams-empty-title">Team not found</h2>
          <p className="teams-empty-sub">This team may have been deleted or the link is incorrect.</p>
          <button className="team-btn team-btn--primary" onClick={() => navigate('/teams')}>
            Browse Teams
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Edit side panel */}
      {showEdit && (
        <div className="team-side-panel-overlay" onClick={() => setShowEdit(false)}>
          <div className="team-side-panel" onClick={e => e.stopPropagation()}>
            <div className="team-side-panel-header">
              <h2 className="team-side-panel-title">✏️ Edit Team</h2>
              <button className="team-side-panel-close" onClick={() => setShowEdit(false)}>×</button>
            </div>
            <TeamForm existing={team} onSubmit={handleEdit} onCancel={() => setShowEdit(false)} submitLabel="Save Changes" />
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={showDelete}
        title="Delete Team"
        message={`Delete "${team.teamName}"? All players will be removed. This cannot be undone.`}
        confirmLabel="Delete Team"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
        dangerous
        loading={deleteLoading}
      />

      {/* Remove player confirm */}
      <ConfirmModal
        isOpen={!!removingPlayer}
        title="Remove Player"
        message={`Remove "${removingPlayer?.name}" from the squad?`}
        confirmLabel="Remove"
        onConfirm={handleRemovePlayer}
        onCancel={() => setRemovingPlayer(null)}
        dangerous
        loading={removeLoading}
      />

      <div className="team-detail-page">
        {/* Back button */}
        <button className="team-back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        {/* Team hero */}
        <div className="team-detail-hero">
          <div className="team-detail-logo">{team.logo}</div>
          <div className="team-detail-info">
            <div className="team-detail-name-row">
              <h1 className="team-detail-name">{team.teamName}</h1>
              {isOwner && (
                <div className="team-detail-owner-actions">
                  <button
                    id="detail-edit-btn"
                    className="team-icon-btn team-icon-btn--edit"
                    onClick={() => setShowEdit(true)}
                    title="Edit team"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    id="detail-delete-btn"
                    className="team-icon-btn team-icon-btn--delete"
                    onClick={() => setShowDelete(true)}
                    title="Delete team"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
            <div className="team-detail-meta">
              <div className="team-detail-meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                Captain: <strong>{team.captain}</strong>
              </div>
              <div className="team-detail-meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {team.playerCount} Player{team.playerCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Invite Code section (owner only) */}
        {isOwner && (
          <div className="team-invite-section">
            <div className="team-invite-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Invite Code (share with your squad)
            </div>
            <div className="team-invite-row">
              <div className="team-invite-code">{team.inviteCode}</div>
              <button
                id="copy-invite-btn"
                className="team-btn team-btn--outline team-btn--sm"
                onClick={copyInviteCode}
              >
                {codeCopied ? '✅ Copied!' : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
              <button
                id="regen-invite-btn"
                className="team-btn team-btn--ghost team-btn--sm"
                onClick={handleRegenCode}
                disabled={regenLoading}
                title="Generate a new invite code"
              >
                {regenLoading ? <span className="team-spinner" style={{ width: 14, height: 14 }} /> : '↺ New Code'}
              </button>
            </div>
          </div>
        )}

        {/* Player Roster */}
        <div className="team-roster-section">
          <div className="team-roster-header">
            <h2 className="team-roster-title">
              <span>Squad</span>
              <span className="team-roster-count">{players.length}</span>
            </h2>
            {isOwner && (
              <button
                id="add-player-btn"
                className="team-btn team-btn--primary team-btn--sm"
                onClick={() => setShowAddPlayer(v => !v)}
              >
                {showAddPlayer ? '✕ Cancel' : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Player
                  </>
                )}
              </button>
            )}
          </div>

          {/* Add player inline form */}
          {showAddPlayer && (
            <form className="add-player-form" onSubmit={handleAddPlayer}>
              <input
                id="player-name-input"
                className={`team-form-input ${playerError ? 'team-form-input--error' : ''}`}
                type="text"
                placeholder="Player name"
                value={playerName}
                onChange={e => { setPlayerName(e.target.value); setPlayerError('') }}
                maxLength={50}
                autoFocus
              />
              <select
                id="player-role-select"
                className="team-form-input team-form-select"
                value={playerRole}
                onChange={e => setPlayerRole(e.target.value as Player['role'])}
              >
                <option value="Batsman">Batsman</option>
                <option value="Bowler">Bowler</option>
                <option value="All-Rounder">All-Rounder</option>
                <option value="Wicket-Keeper">Wicket-Keeper</option>
              </select>
              {playerError && <p className="team-form-error" style={{ gridColumn: '1/-1' }}>{playerError}</p>}
              <button
                id="add-player-submit"
                type="submit"
                className="team-btn team-btn--primary"
                disabled={addingPlayer}
              >
                {addingPlayer ? <span className="team-spinner" /> : 'Add'}
              </button>
            </form>
          )}

          {/* Player list */}
          {playersLoading ? (
            <div className="teams-loading" style={{ padding: '40px 0' }}>
              <div className="team-spinner" />
              <p>Loading squad…</p>
            </div>
          ) : players.length === 0 ? (
            <div className="teams-empty" style={{ padding: '48px 24px' }}>
              <div className="teams-empty-icon" style={{ fontSize: 40 }}>👤</div>
              <h3 className="teams-empty-title" style={{ fontSize: '18px' }}>No players yet</h3>
              <p className="teams-empty-sub">
                {isOwner
                  ? 'Add your first player using the button above.'
                  : "The captain hasn't added any players yet."}
              </p>
            </div>
          ) : (
            <div className="player-list">
              {players.map(player => (
                <div key={player.id} className="player-row">
                  <div className="player-avatar" style={{ background: ROLE_COLORS[player.role] }}>
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="player-info">
                    <span className="player-name">{player.name}</span>
                    <span
                      className="player-role-badge"
                      style={{
                        background: ROLE_COLORS[player.role],
                        color: ROLE_TEXT[player.role],
                        border: `1px solid ${ROLE_TEXT[player.role]}40`,
                      }}
                    >
                      {player.role}
                    </span>
                  </div>
                  <div className="player-stats">
                    <div className="player-stat">
                      <span className="player-stat-v">{player.stats.matches}</span>
                      <span className="player-stat-l">M</span>
                    </div>
                    <div className="player-stat">
                      <span className="player-stat-v">{player.stats.runs}</span>
                      <span className="player-stat-l">R</span>
                    </div>
                    <div className="player-stat">
                      <span className="player-stat-v">{player.stats.wickets}</span>
                      <span className="player-stat-l">W</span>
                    </div>
                  </div>
                  {isOwner && (
                    <button
                      id={`remove-player-${player.id}`}
                      className="player-remove-btn"
                      onClick={() => setRemovingPlayer(player)}
                      title={`Remove ${player.name}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
