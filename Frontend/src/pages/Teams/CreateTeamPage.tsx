// src/pages/Teams/CreateTeamPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Standalone page for creating a new team.
// PHASE 1 FIX: stamps activeTournamentId on the team and registers it in the
// tournament's teamIds array. Without this, teams have empty tournamentId and
// are visible across all tournaments.
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { TeamForm } from '../../components/team/TeamForm'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useAuth } from '../../context/AuthContext'
import { useActiveTournament } from '../../context/ActiveTournamentContext'
import { useRole } from '../../context/RoleContext'
import { createTeam } from '../../services/teamService'
import { addTeamToTournament } from '../../services/tournamentService'
import '../../styles/teams.css'

export default function CreateTeamPage() {
  const { user, userProfile } = useAuth()
  const { activeTournamentId, activeTournament } = useActiveTournament()
  const { canManageTeams } = useRole()
  const navigate = useNavigate()
  const { toasts, showToast, dismissToast } = useToast()

  const displayName =
    userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'Captain'

  // Guard: only tournament admins can reach this page
  if (!canManageTeams) {
    return (
      <AppShell>
        <div className="teams-empty">
          <div className="teams-empty-icon">🔒</div>
          <h2 className="teams-empty-title">Permission Denied</h2>
          <p className="teams-empty-sub">Only Tournament Admins can create teams.</p>
          <button className="team-btn team-btn--primary" onClick={() => navigate('/teams')}>
            Browse Teams
          </button>
        </div>
      </AppShell>
    )
  }

  // Guard: must have an active tournament selected
  if (!activeTournamentId) {
    return (
      <AppShell>
        <div className="teams-empty">
          <div className="teams-empty-icon">🏆</div>
          <h2 className="teams-empty-title">No Active Tournament</h2>
          <p className="teams-empty-sub">Select or create a tournament before adding teams.</p>
          <button className="team-btn team-btn--primary" onClick={() => navigate('/tournaments')}>
            My Tournaments
          </button>
        </div>
      </AppShell>
    )
  }

  async function handleCreate(data: { teamName: string; logo: string; captain: string }) {
    if (!user) { showToast('Please log in to create a team.', 'error'); return }
    try {
      // CRITICAL: Pass tournamentId so this team is isolated to the active tournament
      const teamId = await createTeam({
        teamName: data.teamName,
        logo: data.logo,
        captain: data.captain,
        createdBy: user.uid,
        tournamentId: activeTournamentId,
      })
      // Register the team in the tournament's teamIds array so it appears in the
      // tournament's team roster and match dropdowns
      await addTeamToTournament(activeTournamentId, teamId)

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
        <button className="team-back-btn" onClick={() => navigate('/teams')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Teams
        </button>

        <div className="create-team-card">
          <div className="create-team-header">
            <div className="create-team-icon">🏏</div>
            <h1 className="create-team-title">Create a New Team</h1>
            <p className="create-team-sub">
              Creating team for <strong>{activeTournament?.name ?? 'your tournament'}</strong>.
              An invite code will be auto-generated.
            </p>
          </div>

          <TeamForm
            onSubmit={handleCreate}
            onCancel={() => navigate('/teams')}
            submitLabel="Create Team"
          />

          {/* Info box */}
          <div className="create-team-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              After creating, you'll get a unique <strong>invite code</strong> to share with your squad.
              This team will be automatically linked to <strong>{activeTournament?.name ?? 'the active tournament'}</strong>.
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
