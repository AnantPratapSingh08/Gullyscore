// src/pages/Teams/TeamsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Browse ALL Teams page — real-time, searchable, with Join by Invite Code
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { TeamCard } from '../../components/team/TeamCard'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useAllTeams } from '../../hooks/useTeams'
import { useAuth } from '../../context/AuthContext'
import { useActiveTournament } from '../../context/ActiveTournamentContext'
import { findTeamByInviteCode, joinTeam } from '../../services/teamService'
import '../../styles/teams.css'

export default function TeamsPage() {
  const { teams, loading } = useAllTeams()
  const { user } = useAuth()
  const { activeTournament } = useActiveTournament()
  const navigate = useNavigate()
  const { toasts, showToast, dismissToast } = useToast()

  const [search, setSearch]             = useState('')
  const [inviteCode, setInviteCode]     = useState('')
  const [joiningCode, setJoiningCode]   = useState(false)
  const [showJoinPanel, setShowJoinPanel] = useState(false)

  // Filter to active tournament teams only
  const tournamentTeams = activeTournament?.teamIds?.length
    ? teams.filter(t => activeTournament.teamIds.includes(t.id))
    : teams

  // ── Search filter ────────────────────────────────────────────────────────
  const filtered = tournamentTeams.filter(t =>
    t.teamName.toLowerCase().includes(search.toLowerCase()) ||
    t.captain.toLowerCase().includes(search.toLowerCase())
  )

  // ── Join by Invite Code ───────────────────────────────────────────────────
  async function handleJoin() {
    const code = inviteCode.trim().toUpperCase()
    if (!code) { showToast('Enter an invite code first.', 'warning'); return }
    if (code.length !== 6) { showToast('Invite codes are 6 characters long.', 'warning'); return }
    if (!user) { showToast('Please log in first.', 'error'); return }

    setJoiningCode(true)
    try {
      const team = await findTeamByInviteCode(code)
      if (!team) {
        showToast('No team found with that invite code.', 'error')
        return
      }
      await joinTeam(user.uid, team.id)
      showToast(`Joined "${team.teamName}" successfully! 🎉`, 'success')
      setInviteCode('')
      setShowJoinPanel(false)
      setTimeout(() => navigate(`/teams/${team.id}`), 1200)
    } catch {
      showToast('Failed to join team. Please try again.', 'error')
    } finally {
      setJoiningCode(false)
    }
  }

  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="teams-page">
        {/* Page header */}
        <div className="teams-page-header">
          <div className="teams-page-title-block">
            <h1 className="teams-page-title">
              <span className="teams-page-title-icon">🏆</span>
              All Teams
            </h1>
            <p className="teams-page-subtitle">
              Discover gully cricket teams and join with an invite code.
            </p>
          </div>
          <div className="teams-page-actions">
            <button
              id="join-team-btn"
              className="team-btn team-btn--outline"
              onClick={() => setShowJoinPanel(v => !v)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Join with Code
            </button>
            <button
              id="create-team-btn"
              className="team-btn team-btn--primary"
              onClick={() => navigate('/teams/create')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Team
            </button>
          </div>
        </div>

        {/* Join by Invite Code panel */}
        {showJoinPanel && (
          <div className="join-panel">
            <div className="join-panel-inner">
              <h3 className="join-panel-title">🔑 Join with Invite Code</h3>
              <p className="join-panel-sub">Enter the 6-character code shared by your team captain.</p>
              <div className="join-panel-input-row">
                <input
                  id="invite-code-input"
                  className="join-code-input"
                  type="text"
                  placeholder="e.g. AB12CD"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />
                <button
                  id="join-code-submit-btn"
                  className="team-btn team-btn--primary"
                  onClick={handleJoin}
                  disabled={joiningCode}
                >
                  {joiningCode ? <span className="team-spinner" /> : 'Join Team'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search bar */}
        <div className="teams-search-bar">
          <svg className="teams-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="teams-search-input"
            className="teams-search-input"
            type="text"
            placeholder="Search teams by name or captain…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="teams-search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="teams-loading">
            <div className="team-spinner team-spinner--lg" />
            <p>Loading teams…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="teams-empty">
            <div className="teams-empty-icon">
              {search ? '🔍' : '🏏'}
            </div>
            <h2 className="teams-empty-title">
              {search ? 'No teams match your search' : 'No teams yet'}
            </h2>
            <p className="teams-empty-sub">
              {search
                ? `Try a different name or captain.`
                : 'Be the first to create a team and start your gully cricket journey!'}
            </p>
            {!search && (
              <button
                className="team-btn team-btn--primary"
                onClick={() => navigate('/teams/create')}
              >
                Create the First Team
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="teams-count">{filtered.length} team{filtered.length !== 1 ? 's' : ''} found</p>
            <div className="teams-grid">
              {filtered.map(team => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
