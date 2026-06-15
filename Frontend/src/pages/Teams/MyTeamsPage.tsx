// src/pages/Teams/MyTeamsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// "My Teams" page — shows only the current user's teams with Edit / Delete
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { TeamCard } from '../../components/team/TeamCard'
import { TeamForm } from '../../components/team/TeamForm'
import { ConfirmModal } from '../../components/common/ConfirmModal'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useMyTeams } from '../../hooks/useTeams'
import { useAuth } from '../../context/AuthContext'
import { updateTeam, deleteTeam } from '../../services/teamService'
import type { Team } from '../../types/team'
import '../../styles/teams.css'

export default function MyTeamsPage() {
  const { user } = useAuth()
  const { teams, loading } = useMyTeams(user?.uid)
  const navigate = useNavigate()
  const { toasts, showToast, dismissToast } = useToast()

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)

  // ── Delete confirm state ───────────────────────────────────────────────────
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── Edit team ──────────────────────────────────────────────────────────────
  async function handleEdit(data: { teamName: string; logo: string; captain: string }) {
    if (!editingTeam) return
    try {
      await updateTeam(editingTeam.id, data)
      showToast(`"${data.teamName}" updated! ✅`, 'success')
      setEditingTeam(null)
    } catch {
      showToast('Failed to update team. Please try again.', 'error')
      throw new Error('Update failed') // keeps TeamForm in loading state briefly
    }
  }

  // ── Delete team ────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deletingTeam) return
    setDeleteLoading(true)
    try {
      await deleteTeam(deletingTeam.id)
      showToast(`"${deletingTeam.teamName}" has been deleted.`, 'info')
      setDeletingTeam(null)
    } catch {
      showToast('Failed to delete team. Please try again.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Edit Team slide-in panel */}
      {editingTeam && (
        <div className="team-side-panel-overlay" onClick={() => setEditingTeam(null)}>
          <div className="team-side-panel" onClick={e => e.stopPropagation()}>
            <div className="team-side-panel-header">
              <h2 className="team-side-panel-title">✏️ Edit Team</h2>
              <button
                className="team-side-panel-close"
                onClick={() => setEditingTeam(null)}
                aria-label="Close panel"
              >
                ×
              </button>
            </div>
            <TeamForm
              existing={editingTeam}
              onSubmit={handleEdit}
              onCancel={() => setEditingTeam(null)}
              submitLabel="Save Changes"
            />
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deletingTeam}
        title="Delete Team"
        message={`Are you sure you want to delete "${deletingTeam?.teamName}"? This will also remove all players in the team. This action cannot be undone.`}
        confirmLabel="Delete Team"
        onConfirm={handleDelete}
        onCancel={() => setDeletingTeam(null)}
        dangerous
        loading={deleteLoading}
      />

      <div className="teams-page">
        {/* Page header */}
        <div className="teams-page-header">
          <div className="teams-page-title-block">
            <h1 className="teams-page-title">
              <span className="teams-page-title-icon">👥</span>
              My Teams
            </h1>
            <p className="teams-page-subtitle">
              Teams you've created. Edit rosters, share invite codes, and manage your squad.
            </p>
          </div>
          <button
            id="create-my-team-btn"
            className="team-btn team-btn--primary"
            onClick={() => navigate('/teams/create')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Team
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="teams-loading">
            <div className="team-spinner team-spinner--lg" />
            <p>Loading your teams…</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="teams-empty">
            <div className="teams-empty-icon">🏏</div>
            <h2 className="teams-empty-title">You haven't created any teams yet</h2>
            <p className="teams-empty-sub">
              Create your first team, add players, and share the invite code with your squad!
            </p>
            <button
              className="team-btn team-btn--primary"
              onClick={() => navigate('/teams/create')}
            >
              Create Your First Team
            </button>
          </div>
        ) : (
          <>
            <p className="teams-count">
              {teams.length} team{teams.length !== 1 ? 's' : ''} — <span style={{ color: '#94a3b8' }}>showing invite codes so you can share them</span>
            </p>
            <div className="teams-grid">
              {teams.map(team => (
                <TeamCard
                  key={team.id}
                  team={team}
                  isOwner
                  showInviteCode
                  onEdit={setEditingTeam}
                  onDelete={setDeletingTeam}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
