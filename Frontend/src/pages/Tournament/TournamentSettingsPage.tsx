// src/pages/Tournament/TournamentSettingsPage.tsx
import { useState, useEffect, createContext, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { ConfirmModal } from '../../components/common/ConfirmModal'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { TournamentProvider, useTournamentContext } from '../../context/TournamentContext'
import {
  updateTournament,
  deleteTournament,
  setTournamentStatus,
  addTeamToTournament,
  removeTeamFromTournament,
  addMatchToTournament,
  removeMatchFromTournament,
  declareTournamentWinner,
} from '../../services/tournamentService'
import { assertTournamentAdmin, adminActionBlockReason, isTournamentAdmin } from '../../utils/tournamentGuard'
import { subscribeToTeamsByTournament } from '../../services/teamService'
import { subscribeToMatchesByTournament } from '../../services/matchService'
import { useAuth } from '../../context/AuthContext'
import { useActiveTournament } from '../../context/ActiveTournamentContext'
import type { Tournament, TournamentFormat, TournamentStatus } from '../../types/tournament'
import type { Team } from '../../types/team'
import type { Match } from '../../types/match'
import '../../styles/teams.css'
import '../../styles/matches.css'

const FORMATS: TournamentFormat[] = ['League', 'Knockout', 'Double Knockout', 'League + Knockout', 'Custom']
const STATUSES: TournamentStatus[] = ['draft', 'registration', 'active', 'completed', 'cancelled']
const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: '📝 Draft', registration: '📅 Registration', active: '🟢 Active',
  completed: '✅ Completed', cancelled: '❌ Cancelled',
}

// ── Admin-only guard banner ───────────────────────────────────────────────────
function ReadOnlyBanner() {
  return (
    <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
      🔒 Read-only view. Only the tournament admin can make changes.
    </div>
  )
}

// ── Settings form ─────────────────────────────────────────────────────────────
function SettingsForm({ tournament, isAdmin }: { tournament: Tournament; isAdmin: boolean }) {
  const { user } = useAuth()
  const { showToast } = useToastCtx()
  const [name,        setName]        = useState(tournament.name)
  const [description, setDescription] = useState(tournament.description)
  const [format,      setFormat]      = useState<TournamentFormat>(tournament.format)
  const [venue,       setVenue]       = useState(tournament.venue)
  const [startDate,   setStartDate]   = useState(tournament.startDate)
  const [endDate,     setEndDate]     = useState(tournament.endDate)
  const [maxTeams,    setMaxTeams]    = useState(tournament.maxTeams)
  const [prizePool,   setPrizePool]   = useState(tournament.prizePool)
  const [saving,      setSaving]      = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    try {
      assertTournamentAdmin(tournament, user.uid)
      setSaving(true)
      await updateTournament(tournament.id, { name: name.trim(), description: description.trim(), format, venue: venue.trim(), startDate, endDate, maxTeams, prizePool: prizePool.trim() })
      showToast('Settings saved! ✅', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save.', 'error')
    } finally { setSaving(false) }
  }

  return (
    <form className="team-form" onSubmit={handleSave} noValidate>
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="ts-name">Tournament Name</label>
        <input id="ts-name" type="text" className="team-form-input" value={name} maxLength={60}
          onChange={e => setName(e.target.value)} disabled={!isAdmin} />
      </div>
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="ts-desc">Description</label>
        <textarea id="ts-desc" className="team-form-input" rows={2} value={description} maxLength={200}
          onChange={e => setDescription(e.target.value)} disabled={!isAdmin}
          style={{ resize: 'vertical', fontFamily: 'inherit' }} />
      </div>
      <div className="team-form-field">
        <label className="team-form-label">Format</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FORMATS.map(f => (
            <button key={f} type="button" disabled={!isAdmin}
              className={`player-form-chip${format === f ? ' player-form-chip--active' : ''}`}
              onClick={() => isAdmin && setFormat(f)}>{f}</button>
          ))}
        </div>
      </div>
      <div className="match-form-row">
        <div className="team-form-field">
          <label className="team-form-label" htmlFor="ts-venue">Venue</label>
          <input id="ts-venue" type="text" className="team-form-input" value={venue}
            onChange={e => setVenue(e.target.value)} disabled={!isAdmin} />
        </div>
        <div className="team-form-field">
          <label className="team-form-label" htmlFor="ts-maxteams">Max Teams</label>
          <input id="ts-maxteams" type="number" className="team-form-input" value={maxTeams}
            min={2} max={64} onChange={e => setMaxTeams(parseInt(e.target.value) || 2)} disabled={!isAdmin} />
        </div>
      </div>
      <div className="match-form-row">
        <div className="team-form-field">
          <label className="team-form-label" htmlFor="ts-start">Start Date</label>
          <input id="ts-start" type="date" className="team-form-input" value={startDate}
            onChange={e => setStartDate(e.target.value)} disabled={!isAdmin} />
        </div>
        <div className="team-form-field">
          <label className="team-form-label" htmlFor="ts-end">End Date</label>
          <input id="ts-end" type="date" className="team-form-input" value={endDate}
            onChange={e => setEndDate(e.target.value)} disabled={!isAdmin} />
        </div>
      </div>
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="ts-prize">Prize Pool</label>
        <input id="ts-prize" type="text" className="team-form-input" value={prizePool} maxLength={100}
          onChange={e => setPrizePool(e.target.value)} disabled={!isAdmin} />
      </div>
      {isAdmin && (
        <div className="team-form-actions">
          <button id="ts-save-btn" type="submit" className="team-btn team-btn--primary" disabled={saving}>
            {saving ? <><span className="team-spinner" />Saving…</> : 'Save Settings'}
          </button>
        </div>
      )}
    </form>
  )
}

// ── Status panel ──────────────────────────────────────────────────────────────
function StatusPanel({ tournament, isAdmin }: { tournament: Tournament; isAdmin: boolean }) {
  const { user } = useAuth()
  const { showToast } = useToastCtx()
  const [saving, setSaving] = useState(false)

  async function handleStatus(s: TournamentStatus) {
    if (!user) return
    if (!isTournamentAdmin(tournament, user.uid)) { showToast('Admin only.', 'error'); return }
    setSaving(true)
    try { await setTournamentStatus(tournament.id, s); showToast(`Status → ${s}`, 'success') }
    catch { showToast('Failed to update status.', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="match-section">
      <h3 className="match-section-title">🚦 Tournament Status</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button key={s} type="button" disabled={!isAdmin || saving || tournament.status === s}
            className={`player-form-chip${tournament.status === s ? ' player-form-chip--active' : ''}`}
            onClick={() => handleStatus(s)}>{STATUS_LABELS[s]}</button>
        ))}
      </div>
      {!isAdmin && <p style={{ fontSize: 12, color: '#475569', marginTop: 10 }}>Only the admin can change status.</p>}
    </div>
  )
}

// ── Teams panel ───────────────────────────────────────────────────────────────
function TeamsPanel({ tournament, isAdmin }: { tournament: Tournament; isAdmin: boolean }) {
  const { user } = useAuth()
  const { showToast } = useToastCtx()
  const [allTeams,  setAllTeams]  = useState<Team[]>([])
  const [selected,  setSelected]  = useState('')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (!tournament.id) return
    const unsub = subscribeToTeamsByTournament(tournament.id, [], setAllTeams)
    return unsub
  }, [tournament.id])

  const available = allTeams.filter(t => !tournament.teamIds.includes(t.id))
  const enrolled  = allTeams.filter(t => tournament.teamIds.includes(t.id))

  async function handleAdd() {
    if (!selected || !user) return
    if (!isTournamentAdmin(tournament, user.uid)) { showToast('Admin only.', 'error'); return }
    setSaving(true)
    try { await addTeamToTournament(tournament.id, selected); setSelected(''); showToast('Team added!', 'success') }
    catch { showToast('Failed.', 'error') }
    finally { setSaving(false) }
  }

  async function handleRemove(teamId: string) {
    if (!user || !isTournamentAdmin(tournament, user.uid)) { showToast('Admin only.', 'error'); return }
    try { await removeTeamFromTournament(tournament.id, teamId); showToast('Team removed.', 'info') }
    catch { showToast('Failed.', 'error') }
  }

  return (
    <div className="match-section">
      <h3 className="match-section-title">👥 Teams ({tournament.teamIds.length}/{tournament.maxTeams})</h3>
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <select className="team-form-input" style={{ flex: 1 }} value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">— Add a team —</option>
            {available.map(t => <option key={t.id} value={t.id}>{t.logo} {t.teamName}</option>)}
          </select>
          <button className="team-btn team-btn--primary" onClick={handleAdd} disabled={!selected || saving}>Add</button>
        </div>
      )}
      {enrolled.length === 0
        ? <p style={{ fontSize: 13, color: '#475569' }}>No teams enrolled yet.</p>
        : enrolled.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 14, color: '#cbd5e1' }}>{t.logo} {t.teamName}</span>
            {isAdmin && (
              <button className="team-icon-btn team-icon-btn--delete" style={{ padding: '4px 8px' }} onClick={() => handleRemove(t.id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            )}
          </div>
        ))
      }
    </div>
  )
}

// ── Matches panel ─────────────────────────────────────────────────────────────
function MatchesPanel({ tournament, isAdmin }: { tournament: Tournament; isAdmin: boolean }) {
  const { user } = useAuth()
  const { showToast } = useToastCtx()
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [selected,   setSelected]   = useState('')

  useEffect(() => {
    if (!tournament.id) return
    const unsub = subscribeToMatchesByTournament(tournament.id, setAllMatches)
    return unsub
  }, [tournament.id])

  const available = allMatches.filter(m => !tournament.matchIds.includes(m.id))
  const enrolled  = allMatches.filter(m => tournament.matchIds.includes(m.id))

  async function handleAdd() {
    if (!selected || !user || !isTournamentAdmin(tournament, user.uid)) { showToast('Admin only.', 'error'); return }
    try { await addMatchToTournament(tournament.id, selected); setSelected(''); showToast('Match added!', 'success') }
    catch { showToast('Failed.', 'error') }
  }

  async function handleRemove(matchId: string) {
    if (!user || !isTournamentAdmin(tournament, user.uid)) { showToast('Admin only.', 'error'); return }
    try { await removeMatchFromTournament(tournament.id, matchId); showToast('Match removed.', 'info') }
    catch { showToast('Failed.', 'error') }
  }

  return (
    <div className="match-section">
      <h3 className="match-section-title">🏏 Matches ({tournament.matchIds.length})</h3>
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <select className="team-form-input" style={{ flex: 1 }} value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">— Add a match —</option>
            {available.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
          <button className="team-btn team-btn--primary" onClick={handleAdd} disabled={!selected}>Add</button>
        </div>
      )}
      {enrolled.length === 0
        ? <p style={{ fontSize: 13, color: '#475569' }}>No matches added yet.</p>
        : enrolled.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 14, color: '#cbd5e1' }}>🏏 {m.title}</span>
            {isAdmin && (
              <button className="team-icon-btn team-icon-btn--delete" style={{ padding: '4px 8px' }} onClick={() => handleRemove(m.id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            )}
          </div>
        ))
      }
    </div>
  )
}

// ── Winner panel ──────────────────────────────────────────────────────────────
function WinnerPanel({ tournament, isAdmin }: { tournament: Tournament; isAdmin: boolean }) {
  const { user } = useAuth()
  const { showToast } = useToastCtx()
  const [winnerId, setWinnerId] = useState(tournament.winnerId)
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!tournament.id) return
    const unsub = subscribeToTeamsByTournament(tournament.id, [], setAllTeams)
    return unsub
  }, [tournament.id])

  const enrolled = allTeams.filter(t => tournament.teamIds.includes(t.id))
  const winner   = allTeams.find(t => t.id === tournament.winnerId)

  async function handleDeclare() {
    if (!winnerId || !user) return
    const block = adminActionBlockReason(tournament, user.uid)
    if (block) { showToast(block, 'error'); return }
    setSaving(true)
    try { await declareTournamentWinner(tournament.id, winnerId); showToast('Winner declared! 🏆', 'success') }
    catch { showToast('Failed.', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="match-section">
      <h3 className="match-section-title">🏆 Winner</h3>
      {winner
        ? <p style={{ fontSize: 15, color: '#f1f5f9', fontWeight: 700 }}>🥇 {winner.logo} {winner.teamName}</p>
        : isAdmin && tournament.status === 'active'
          ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="team-form-input" style={{ flex: 1 }} value={winnerId} onChange={e => setWinnerId(e.target.value)}>
                <option value="">— Select winner —</option>
                {enrolled.map(t => <option key={t.id} value={t.id}>{t.logo} {t.teamName}</option>)}
              </select>
              <button id="declare-winner-btn" className="team-btn team-btn--primary" onClick={handleDeclare} disabled={!winnerId || saving}>
                {saving ? <span className="team-spinner" /> : 'Declare'}
              </button>
            </div>
          )
          : <p style={{ fontSize: 13, color: '#475569' }}>Winner will be declared when the tournament is active.</p>
      }
    </div>
  )
}

const ToastCtx = createContext<{ showToast: (msg: string, type: 'success'|'error'|'info'|'warning') => void }>({ showToast: () => {} })
function useToastCtx() { return useContext(ToastCtx) }

// ── Inner page (uses context) ─────────────────────────────────────────────────
function TournamentSettingsInner() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { tournament, loading, isAdmin, error } = useTournamentContext()
  const { toasts, showToast, dismissToast } = useToast()
  const [showDelete, setShowDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const { activeTournamentId, setActiveTournamentId } = useActiveTournament()

  useEffect(() => {
    if (tournament?.id && tournament.id !== activeTournamentId) {
      setActiveTournamentId(tournament.id)
    }
  }, [tournament?.id, activeTournamentId, setActiveTournamentId])

  async function handleDelete() {
    if (!tournament || !user) return
    try {
      assertTournamentAdmin(tournament, user.uid)
      setDeleteLoading(true)
      await deleteTournament(tournament.id)
      navigate('/tournaments', { replace: true })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed.', 'error')
    } finally { setDeleteLoading(false) }
  }

  if (loading) return (
    <AppShell>
      <div className="teams-loading"><div className="team-spinner team-spinner--lg" /><p>Loading…</p></div>
    </AppShell>
  )
  if (error || !tournament) return (
    <AppShell>
      <div className="teams-empty">
        <div className="teams-empty-icon">😕</div>
        <h2 className="teams-empty-title">{error ?? 'Not found'}</h2>
        <button className="team-btn team-btn--primary" onClick={() => navigate('/tournaments')}>All Tournaments</button>
      </div>
    </AppShell>
  )

  return (
    <ToastCtx.Provider value={{ showToast }}>
      <AppShell>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        <ConfirmModal
          isOpen={showDelete}
          title="Delete Tournament"
          message={`Delete "${tournament.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          dangerous
          loading={deleteLoading}
        />

        <div className="match-detail-page">
          {/* Back */}
          <button className="team-back-btn" onClick={() => navigate('/tournaments')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Tournaments
          </button>

          {/* Hero */}
          <div className="match-detail-hero" style={{ marginTop: 16 }}>
            <div className="match-detail-hero-bar" style={{ background: '#a78bfa' }} />
            <div className="match-detail-hero-inner">
              <div className="match-detail-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 32 }}>{tournament.logo}</span>
                    <h1 style={{ fontSize: 'clamp(18px,3vw,24px)', fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
                      {tournament.name}
                    </h1>
                  </div>
                  {tournament.description && (
                    <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 8px' }}>{tournament.description}</p>
                  )}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>📋 {tournament.format}</span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>📍 {tournament.venue || 'TBD'}</span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>👥 {tournament.teamIds.length}/{tournament.maxTeams} teams</span>
                    {tournament.prizePool && <span style={{ fontSize: 12, color: '#f59e0b' }}>🏅 {tournament.prizePool}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 999, padding: '3px 10px' }}>
                    {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                  </span>
                  {isAdmin && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>👑 You are Admin</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Role banner for non-admins */}
          {!isAdmin && <ReadOnlyBanner />}

          {/* Settings sections */}
          <div className="match-section">
            <h3 className="match-section-title">⚙️ Settings</h3>
            <SettingsForm tournament={tournament} isAdmin={isAdmin} />
          </div>

          <StatusPanel   tournament={tournament} isAdmin={isAdmin} />
          <TeamsPanel    tournament={tournament} isAdmin={isAdmin} />
          <MatchesPanel  tournament={tournament} isAdmin={isAdmin} />
          <WinnerPanel   tournament={tournament} isAdmin={isAdmin} />

          {/* Danger zone */}
          {isAdmin && (
            <div className="match-section" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
              <h3 className="match-section-title" style={{ color: '#f87171' }}>⚠️ Danger Zone</h3>
              <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
                Permanently delete this tournament. This action cannot be undone.
              </p>
              <button id="delete-tournament-btn" className="team-btn team-btn--delete" onClick={() => setShowDelete(true)}>
                Delete Tournament
              </button>
            </div>
          )}
        </div>
      </AppShell>
    </ToastCtx.Provider>
  )
}

// ── Public export: wraps inner page with TournamentProvider ───────────────────
export default function TournamentSettingsPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()
  if (!tournamentId) { navigate('/tournaments', { replace: true }); return null }

  return (
    <TournamentProvider tournamentId={tournamentId}>
      <TournamentSettingsInner />
    </TournamentProvider>
  )
}

