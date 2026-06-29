// src/pages/Tournament/TournamentsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Tournament list page — browse all, create new, tab by status.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { ConfirmModal } from '../../components/common/ConfirmModal'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useAuth } from '../../context/AuthContext'
import { useActiveTournament } from '../../context/ActiveTournamentContext'
import { doc, setDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../../services/firebase'
import {
  createTournament,
  deleteTournament,
} from '../../services/tournamentService'
import { isTournamentAdmin } from '../../utils/tournamentGuard'
import type { Tournament, TournamentFormat, TournamentStatus } from '../../types/tournament'
import '../../styles/teams.css'
import '../../styles/matches.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const FORMATS: TournamentFormat[] = ['League', 'Knockout', 'Double Knockout', 'League + Knockout', 'Custom']

const STATUS_COLOR: Record<TournamentStatus, string> = {
  draft:        '#475569',
  registration: '#38bdf8',
  active:       '#4ade80',
  completed:    '#a78bfa',
  cancelled:    '#f87171',
}

const LOGOS = ['🏆', '🥇', '🏏', '⚡', '🔥', '🌟', '👑', '🎯', '🚀', '💥']

// ── Create Form (inline slide panel) ─────────────────────────────────────────

interface CreateFormProps {
  onSubmit: (data: {
    name: string; description: string; format: TournamentFormat
    venue: string; startDate: string; endDate: string
    maxTeams: number; prizePool: string; logo: string
  }) => Promise<void>
  onCancel: () => void
}

function CreateTournamentForm({ onSubmit, onCancel }: CreateFormProps) {
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [format,      setFormat]      = useState<TournamentFormat>('League')
  const [venue,       setVenue]       = useState('')
  const [startDate,   setStartDate]   = useState('')
  const [endDate,     setEndDate]     = useState('')
  const [maxTeams,    setMaxTeams]    = useState(8)
  const [prizePool,   setPrizePool]   = useState('')
  const [logo,        setLogo]        = useState('🏆')
  const [errors,      setErrors]      = useState<Record<string, string>>({})
  const [loading,     setLoading]     = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim())      e.name      = 'Name is required.'
    if (name.length > 60)  e.name      = 'Max 60 characters.'
    if (!venue.trim())     e.venue     = 'Venue is required.'
    if (!startDate)        e.startDate = 'Start date required.'
    if (!endDate)          e.endDate   = 'End date required.'
    if (endDate && startDate && endDate < startDate) e.endDate = 'End must be after start.'
    if (maxTeams < 2 || maxTeams > 64) e.maxTeams = '2–64 teams.'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), format, venue: venue.trim(), startDate, endDate, maxTeams, prizePool: prizePool.trim(), logo })
    } finally { setLoading(false) }
  }

  return (
    <form className="team-form" onSubmit={handleSubmit} noValidate>
      {/* Logo picker */}
      <div className="team-form-field">
        <label className="team-form-label">Logo</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {LOGOS.map(l => (
            <button key={l} type="button"
              className={`player-form-chip${logo === l ? ' player-form-chip--active' : ''}`}
              onClick={() => setLogo(l)} style={{ fontSize: 18, padding: '4px 10px' }}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="t-name">
          Tournament Name <span className="team-form-required">*</span>
        </label>
        <input id="t-name" type="text" className={`team-form-input${errors.name ? ' team-form-input--error' : ''}`}
          placeholder="e.g. Gully Premier League 2025" value={name} maxLength={60}
          onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })) }} autoFocus />
        {errors.name && <p className="team-form-error">{errors.name}</p>}
        <p className="team-form-hint">{name.length}/60</p>
      </div>

      {/* Description */}
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="t-desc">Description</label>
        <textarea id="t-desc" className="team-form-input" rows={2}
          placeholder="Short description of the tournament…" value={description} maxLength={200}
          onChange={e => setDescription(e.target.value)}
          style={{ resize: 'vertical', minHeight: 64, fontFamily: 'inherit' }} />
      </div>

      {/* Format */}
      <div className="team-form-field">
        <label className="team-form-label">Format <span className="team-form-required">*</span></label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FORMATS.map(f => (
            <button key={f} type="button"
              className={`player-form-chip${format === f ? ' player-form-chip--active' : ''}`}
              onClick={() => setFormat(f)}>{f}</button>
          ))}
        </div>
      </div>

      {/* Venue + Max Teams */}
      <div className="match-form-row">
        <div className="team-form-field">
          <label className="team-form-label" htmlFor="t-venue">Venue <span className="team-form-required">*</span></label>
          <input id="t-venue" type="text" className={`team-form-input${errors.venue ? ' team-form-input--error' : ''}`}
            placeholder="City / Ground" value={venue}
            onChange={e => { setVenue(e.target.value); setErrors(p => ({ ...p, venue: '' })) }} />
          {errors.venue && <p className="team-form-error">{errors.venue}</p>}
        </div>
        <div className="team-form-field">
          <label className="team-form-label" htmlFor="t-maxteams">Max Teams <span className="team-form-required">*</span></label>
          <input id="t-maxteams" type="number" className={`team-form-input${errors.maxTeams ? ' team-form-input--error' : ''}`}
            value={maxTeams} min={2} max={64}
            onChange={e => { setMaxTeams(parseInt(e.target.value) || 2); setErrors(p => ({ ...p, maxTeams: '' })) }} />
          {errors.maxTeams && <p className="team-form-error">{errors.maxTeams}</p>}
        </div>
      </div>

      {/* Dates */}
      <div className="match-form-row">
        <div className="team-form-field">
          <label className="team-form-label" htmlFor="t-start">Start Date <span className="team-form-required">*</span></label>
          <input id="t-start" type="date" className={`team-form-input${errors.startDate ? ' team-form-input--error' : ''}`}
            value={startDate} onChange={e => { setStartDate(e.target.value); setErrors(p => ({ ...p, startDate: '' })) }} />
          {errors.startDate && <p className="team-form-error">{errors.startDate}</p>}
        </div>
        <div className="team-form-field">
          <label className="team-form-label" htmlFor="t-end">End Date <span className="team-form-required">*</span></label>
          <input id="t-end" type="date" className={`team-form-input${errors.endDate ? ' team-form-input--error' : ''}`}
            value={endDate} onChange={e => { setEndDate(e.target.value); setErrors(p => ({ ...p, endDate: '' })) }} />
          {errors.endDate && <p className="team-form-error">{errors.endDate}</p>}
        </div>
      </div>

      {/* Prize Pool */}
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="t-prize">Prize Pool <span className="team-form-optional">(optional)</span></label>
        <input id="t-prize" type="text" className="team-form-input"
          placeholder="e.g. ₹10,000 cash + trophy" value={prizePool}
          onChange={e => setPrizePool(e.target.value)} maxLength={100} />
      </div>

      <div className="team-form-actions">
        <button type="button" className="team-btn team-btn--ghost" onClick={onCancel} disabled={loading}>Cancel</button>
        <button id="create-tournament-submit" type="submit" className="team-btn team-btn--primary" disabled={loading}>
          {loading ? <><span className="team-spinner" />Creating…</> : 'Create Tournament'}
        </button>
      </div>
    </form>
  )
}

// ── Tournament Card ───────────────────────────────────────────────────────────

function TournamentCard({
  t, isOwner, onDelete,
}: { t: Tournament; isOwner: boolean; onDelete: (t: Tournament) => void }) {
  const navigate = useNavigate()
  const color = STATUS_COLOR[t.status]

  return (
    <div className="match-card" onClick={() => navigate(`/tournaments/${t.id}`)}
      role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate(`/tournaments/${t.id}`)}>
      {/* Top */}
      <div className="match-card-top">
        <span style={{ fontSize: 24 }}>{t.logo}</span>
        <span className="match-status" style={{ color, background: `${color}18`, borderColor: `${color}40` }}>
          <span className="match-status-dot" style={{ background: color }} />
          {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
        </span>
        {isOwner && (
          <button className="team-icon-btn team-icon-btn--delete"
            style={{ marginLeft: 'auto', padding: '4px 8px' }}
            onClick={e => { e.stopPropagation(); onDelete(t) }}
            title="Delete tournament"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        )}
      </div>

      {/* Name */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>{t.name}</h3>
        {t.description && <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>{t.description}</p>}
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>📋 {t.format}</span>
        <span style={{ fontSize: 12, color: '#64748b' }}>👥 {t.teamIds.length}/{t.maxTeams} teams</span>
        <span style={{ fontSize: 12, color: '#64748b' }}>📍 {t.venue || 'TBD'}</span>
      </div>

      {/* Footer */}
      <div className="match-card-footer">
        <span className="match-card-date">
          {t.startDate} → {t.endDate}
        </span>
        {isOwner && (
          <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>👑 Admin</span>
        )}
      </div>
    </div>
  )
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS: Array<{ label: string; value: TournamentStatus | 'all' }> = [
  { label: '📋 All',          value: 'all' },
  { label: '📝 Draft',        value: 'draft' },
  { label: '📅 Registration', value: 'registration' },
  { label: '🟢 Active',       value: 'active' },
  { label: '✅ Completed',    value: 'completed' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TournamentsPage() {
  const navigate = useNavigate()
  const { user, userProfile } = useAuth()
  const { joinedTournaments, joinByCode, setActiveTournamentId } = useActiveTournament()
  const { toasts, showToast, dismissToast } = useToast()

  const [loading,     setLoading]     = useState(false)
  const [tab,         setTab]         = useState<TournamentStatus | 'all'>('all')
  const [search,      setSearch]      = useState('')
  const [showCreate,  setShowCreate]  = useState(false)
  const [deleting,    setDeleting]    = useState<Tournament | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Join by code
  const [joinCode,   setJoinCode]   = useState('')
  const [joinStatus, setJoinStatus] = useState<'idle'|'loading'|'ok'|'err'>('idle')
  const [joinMsg,    setJoinMsg]    = useState('')

  async function handleJoin() {
    if (!joinCode.trim()) return
    setJoinStatus('loading')
    const res = await joinByCode(joinCode)
    if (res.ok) {
      setJoinStatus('ok')
      setJoinMsg(`Joined "${res.tournament?.name}"!`)
      setJoinCode('')
      if (res.tournament) setActiveTournamentId(res.tournament.id)
    } else {
      setJoinStatus('err')
      setJoinMsg(res.error ?? 'Unknown error')
    }
  }

  // Use joined tournaments from context
  const tournaments = joinedTournaments

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return tournaments.filter(t => {
      const matchTab    = tab === 'all' || t.status === tab
      const matchSearch = !q || t.name.toLowerCase().includes(q) || t.venue.toLowerCase().includes(q)
      return matchTab && matchSearch
    })
  }, [tournaments, tab, search])

  // Create
  async function handleCreate(data: Parameters<CreateFormProps['onSubmit']>[0]) {
    if (!user) { showToast('Please log in.', 'error'); return }
    try {
      setLoading(true)
      const { id, code } = await createTournament({
        ...data,
        adminId:   user.uid,
        adminName: userProfile?.name || user.displayName || user.email || 'Admin',
      })
      // Auto-join the creator & grant tournament_admin role
      // Use setDoc+merge so it works even if the user doc was created without joinedTournamentIds
      await setDoc(
        doc(db, 'users', user.uid),
        { joinedTournamentIds: arrayUnion(id) },
        { merge: true }
      )
      // Persist tournament_admin role so RoleContext can read it on next load
      await setDoc(
        doc(db, 'users', user.uid, 'tournamentRoles', id),
        { role: 'tournament_admin', grantedAt: new Date().toISOString() },
        { merge: true }
      )
      // ⬇ CRITICAL: make this the active tournament immediately so RoleContext
      // sees activeTournament.adminId === user.uid on the very next render.
      setActiveTournamentId(id)
      showToast(`Tournament created! 🏆 Code: ${code}`, 'success')
      setShowCreate(false)
      setTimeout(() => navigate(`/tournaments/${id}`), 600)
    } catch {
      showToast('Failed to create tournament.', 'error')
      throw new Error('create failed')
    } finally {
      setLoading(false)
    }
  }

  // Delete
  async function handleDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteTournament(deleting.id)
      showToast('Tournament deleted.', 'info')
      setDeleting(null)
    } catch {
      showToast('Failed to delete.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Create panel */}
      {showCreate && (
        <div className="team-side-panel-overlay" onClick={() => setShowCreate(false)}>
          <div className="team-side-panel" onClick={e => e.stopPropagation()}>
            <div className="team-side-panel-header">
              <h2 className="team-side-panel-title">🏆 New Tournament</h2>
              <button className="team-side-panel-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <CreateTournamentForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleting}
        title="Delete Tournament"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        dangerous
        loading={deleteLoading}
      />

      <div className="matches-page">
        <div className="matches-page-header">
          <div className="matches-page-title-block">
            <h1 className="matches-page-title">
              <span className="matches-page-title-icon">🏆</span>
              My Tournaments
            </h1>
            <p className="matches-page-subtitle">Tournaments you have joined or created.</p>
          </div>
          <button id="create-tournament-btn" className="team-btn team-btn--primary" onClick={() => setShowCreate(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Tournament
          </button>
        </div>

        {/* Join by code */}
        <div className="dash-join-prompt" style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🔑 Join via Code</div>
          <div className="dash-join-row">
            <input
              id="join-code-input"
              type="text"
              className="dash-join-input"
              placeholder="Enter 6-char code…"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <button
              id="join-by-code-btn"
              className="dash-join-btn"
              onClick={handleJoin}
              disabled={joinStatus === 'loading'}
            >
              {joinStatus === 'loading' ? <span className="team-spinner" /> : 'Join'}
            </button>
          </div>
          {joinStatus === 'ok'  && <div className="dash-join-success">✓ {joinMsg}</div>}
          {joinStatus === 'err' && <div className="dash-join-error">✗ {joinMsg}</div>}
        </div>

        {/* Tabs */}
        <div className="match-tabs" role="tablist">
          {TABS.map(t => (
            <button key={t.value} role="tab" aria-selected={tab === t.value}
              className={`match-tab${tab === t.value ? ' match-tab--active' : ''}`}
              onClick={() => setTab(t.value)}>
              {t.label}
              <span className="match-tab-count">
                {t.value === 'all' ? tournaments.length : tournaments.filter(x => x.status === t.value).length}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="teams-search-bar" style={{ marginBottom: 24 }}>
          <svg className="teams-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input id="tournament-search" className="teams-search-input" type="text"
            placeholder="Search by name or venue…" value={search}
            onChange={e => setSearch(e.target.value)} />
          {search && <button className="teams-search-clear" onClick={() => setSearch('')}>×</button>}
        </div>

        {/* Content */}
        {loading ? (
          <div className="teams-loading">
            <div className="team-spinner team-spinner--lg" /><p>Loading tournaments…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="teams-empty">
            <div className="teams-empty-icon">{search ? '🔍' : '🏆'}</div>
            <h2 className="teams-empty-title">{search ? 'No tournaments found' : 'No tournaments yet'}</h2>
            <p className="teams-empty-sub">{search ? 'Try a different search.' : 'Be the first to organise a tournament!'}</p>
            {!search && <button className="team-btn team-btn--primary" onClick={() => setShowCreate(true)}>Create First Tournament</button>}
          </div>
        ) : (
          <>
            <p className="teams-count">{filtered.length} tournament{filtered.length !== 1 ? 's' : ''}</p>
            <div className="matches-grid">
              {filtered.map(t => (
                <TournamentCard
                  key={t.id} t={t}
                  isOwner={isTournamentAdmin(t, user?.uid)}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
