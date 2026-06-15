// src/components/team/TeamCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable team card for grid/list views
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate } from 'react-router-dom'
import type { Team } from '../../types/team'

interface TeamCardProps {
  team: Team
  isOwner?: boolean
  onEdit?: (team: Team) => void
  onDelete?: (team: Team) => void
  /** If true, show invite code chip */
  showInviteCode?: boolean
}

export function TeamCard({
  team,
  isOwner = false,
  onEdit,
  onDelete,
  showInviteCode = false,
}: TeamCardProps) {
  const navigate = useNavigate()

  return (
    <div className="team-card" tabIndex={0} onClick={() => navigate(`/teams/${team.id}`)}>
      {/* Card glow orb */}
      <div className="team-card-glow" />

      {/* Logo + name row */}
      <div className="team-card-header">
        <div className="team-card-logo">{team.logo}</div>
        <div className="team-card-info">
          <h3 className="team-card-name">{team.teamName}</h3>
          <p className="team-card-captain">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            {team.captain}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="team-card-stats">
        <div className="team-card-stat">
          <span className="team-card-stat-value">{team.playerCount}</span>
          <span className="team-card-stat-label">Players</span>
        </div>
        <div className="team-card-stat-divider" />
        <div className="team-card-stat">
          <span className="team-card-stat-value">🏏</span>
          <span className="team-card-stat-label">Cricket</span>
        </div>
      </div>

      {/* Invite code chip */}
      {showInviteCode && (
        <div className="team-card-invite" onClick={e => {
          e.stopPropagation()
          navigator.clipboard?.writeText(team.inviteCode)
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {team.inviteCode}
        </div>
      )}

      {/* Owner actions */}
      {isOwner && (
        <div className="team-card-actions" onClick={e => e.stopPropagation()}>
          <button
            id={`edit-team-${team.id}`}
            className="team-card-action-btn team-card-action-btn--edit"
            onClick={() => onEdit?.(team)}
            title="Edit team"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
          <button
            id={`delete-team-${team.id}`}
            className="team-card-action-btn team-card-action-btn--delete"
            onClick={() => onDelete?.(team)}
            title="Delete team"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
