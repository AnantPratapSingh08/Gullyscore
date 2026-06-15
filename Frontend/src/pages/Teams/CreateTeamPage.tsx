// src/pages/Teams/CreateTeamPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Standalone page for creating a new team
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { TeamForm } from '../../components/team/TeamForm'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useAuth } from '../../context/AuthContext'
import { createTeam } from '../../services/teamService'
import '../../styles/teams.css'

export default function CreateTeamPage() {
  const { user, userProfile } = useAuth()
  const navigate = useNavigate()
  const { toasts, showToast, dismissToast } = useToast()

  const displayName =
    userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'Captain'

  async function handleCreate(data: { teamName: string; logo: string; captain: string }) {
    if (!user) { showToast('Please log in to create a team.', 'error'); return }
    try {
      const teamId = await createTeam({
        teamName: data.teamName,
        logo: data.logo,
        captain: data.captain,
        createdBy: user.uid,
      })
      showToast(`Team "${data.teamName}" created! 🎉`, 'success')
      setTimeout(() => navigate(`/teams/${teamId}`), 800)
    } catch {
      showToast('Failed to create team. Please try again.', 'error')
      throw new Error('Create failed')
    }
  }

  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="create-team-page">
        {/* Back breadcrumb */}
        <button className="team-back-btn" onClick={() => navigate('/my-teams')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          My Teams
        </button>

        <div className="create-team-card">
          <div className="create-team-header">
            <div className="create-team-icon">🏏</div>
            <h1 className="create-team-title">Create a New Team</h1>
            <p className="create-team-sub">
              Set up your team profile. An invite code will be auto-generated for your players.
            </p>
          </div>

          <TeamForm
            onSubmit={handleCreate}
            onCancel={() => navigate('/my-teams')}
            submitLabel="Create Team"
          />

          {/* Info box */}
          <div className="create-team-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              After creating, you'll get a unique <strong>invite code</strong> to share with your squad. You are automatically set as the captain.
            </span>
          </div>

          {/* Pre-fill captain hint */}
          {displayName !== 'Captain' && (
            <p className="create-team-hint">
              💡 Tip: Your name is "<strong>{displayName}</strong>" — use it as the captain!
            </p>
          )}
        </div>
      </div>
    </AppShell>
  )
}
