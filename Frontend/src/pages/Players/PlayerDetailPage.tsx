// src/pages/Players/PlayerDetailPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Player Detail page — profile + full statistics.
// "Admin" = the user who created the player record (player.createdBy === user.uid),
// mirroring the isOwner pattern used throughout TeamDetailPage.
// Admins see: Edit Stats panel + Delete Player button.
// Everyone else: read-only view.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { ConfirmModal } from '../../components/common/ConfirmModal'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useAuth } from '../../context/AuthContext'
import {
  getPlayer,
  updatePlayerStats,
  deletePlayer,
} from '../../services/playerService'
import type { Player, PlayerRole, PlayerStatsPayload } from '../../types/player'
import '../../styles/teams.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<PlayerRole, string> = {
  'Batsman':       '#22d3ee',
  'Bowler':        '#f59e0b',
  'All-Rounder':   '#a78bfa',
  'Wicket-Keeper': '#34d399',
}

const ROLE_ICON: Record<PlayerRole, string> = {
  'Batsman':       '🏏',
  'Bowler':        '⚡',
  'All-Rounder':   '🌟',
  'Wicket-Keeper': '🧤',
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number | string
  icon: string
  accent: string
  description?: string
}

function StatCard({ label, value, icon, accent, description }: StatCardProps) {
  return (
    <div className="pdetail-stat-card" style={{ '--pdetail-accent': accent } as React.CSSProperties}>
      <div className="pdetail-stat-icon">{icon}</div>
      <div className="pdetail-stat-value">{value}</div>
      <div className="pdetail-stat-label">{label}</div>
      {description && <div className="pdetail-stat-desc">{description}</div>}
    </div>
  )
}

// ── Edit Stats form ───────────────────────────────────────────────────────────

interface EditStatsFormProps {
  player: Player
  onSave: (stats: PlayerStatsPayload) => Promise<void>
  onCancel: () => void
}

function EditStatsForm({ player, onSave, onCancel }: EditStatsFormProps) {
  const [matches,    setMatches]    = useState(player.matches)
  const [runs,       setRuns]       = useState(player.runs)
  const [wickets,    setWickets]    = useState(player.wickets)
  const [average,    setAverage]    = useState(player.average)
  const [strikeRate, setStrikeRate] = useState(player.strikeRate)
  const [economy,    setEconomy]    = useState(player.economy)
  const [loading,    setLoading]    = useState(false)
  const [errors,     setErrors]     = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (matches    < 0) e.matches    = 'Cannot be negative.'
    if (runs       < 0) e.runs       = 'Cannot be negative.'
    if (wickets    < 0) e.wickets    = 'Cannot be negative.'
    if (average    < 0) e.average    = 'Cannot be negative.'
    if (strikeRate < 0) e.strikeRate = 'Cannot be negative.'
    if (economy    < 0) e.economy    = 'Cannot be negative.'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      await onSave({ matches, runs, wickets, average, strikeRate, economy })
    } finally {
      setLoading(false)
    }
  }

  const numField = (
    id: string,
    label: string,
    value: number,
    setter: (v: number) => void,
    step = 1,
  ) => (
    <div className="team-form-field">
      <label className="team-form-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        className={`team-form-input${errors[id] ? ' team-form-input--error' : ''}`}
        value={value}
        min={0}
        step={step}
        onChange={ev => {
          setter(parseFloat(ev.target.value) || 0)
          setErrors(prev => ({ ...prev, [id]: '' }))
        }}
      />
      {errors[id] && <p className="team-form-error">{errors[id]}</p>}
    </div>
  )

  return (
    <form className="team-form" onSubmit={handleSubmit} noValidate>
      <div className="pdetail-edit-grid">
        {numField('matches',    'Matches',     matches,    setMatches)}
        {numField('runs',       'Runs',        runs,       setRuns)}
        {numField('wickets',    'Wickets',     wickets,    setWickets)}
        {numField('average',    'Average',     average,    setAverage,    0.01)}
        {numField('strikeRate', 'Strike Rate', strikeRate, setStrikeRate, 0.01)}
        {numField('economy',    'Economy',     economy,    setEconomy,    0.01)}
      </div>
      <div className="team-form-actions">
        <button type="button" className="team-btn team-btn--ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button id="save-stats-btn" type="submit" className="team-btn team-btn--primary" disabled={loading}>
          {loading ? <><span className="team-spinner" /> Saving…</> : 'Save Stats'}
        </button>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlayerDetailPage() {
  const { playerId } = useParams<{ playerId: string }>()
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const { toasts, showToast, dismissToast } = useToast()

  const [player,      setPlayer]      = useState<Player | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [fetchError,  setFetchError]  = useState<string | null>(null)
  const [showEdit,    setShowEdit]    = useState(false)
  const [showDelete,  setShowDelete]  = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchPlayer = useCallback(async () => {
    if (!playerId) return
    setLoading(true)
    setFetchError(null)
    try {
      const data = await getPlayer(playerId)
      if (!data) { setFetchError('Player not found.'); return }
      setPlayer(data)
    } catch {
      setFetchError('Failed to load player. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [playerId])

  useEffect(() => { fetchPlayer() }, [fetchPlayer])

  if (!playerId) { navigate('/teams', { replace: true }); return null }

  // Admin = the user who created this player record
  const isAdmin = !!user && !!player && user.uid === player.createdBy
  const accent  = player ? ROLE_COLOR[player.role] : '#22d3ee'

  // ── Save stats ──────────────────────────────────────────────────────────
  async function handleSaveStats(stats: PlayerStatsPayload) {
    if (!player) return
    try {
      await updatePlayerStats(player.id, stats)
      showToast('Stats updated! ✅', 'success')
      setShowEdit(false)
      await fetchPlayer()
    } catch {
      showToast('Failed to save stats. Please try again.', 'error')
      throw new Error('save failed')
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!player) return
    setDeleteLoading(true)
    try {
      await deletePlayer(player.id)
      showToast(`${player.name} deleted.`, 'info')
      navigate(-1)
    } catch {
      showToast('Failed to delete player. Please try again.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell>
        <div className="teams-loading">
          <div className="team-spinner team-spinner--lg" />
          <p>Loading player…</p>
        </div>
      </AppShell>
    )
  }

  // ── Error / not found ───────────────────────────────────────────────────
  if (fetchError || !player) {
    return (
      <AppShell>
        <div className="teams-empty">
          <div className="teams-empty-icon">😕</div>
          <h2 className="teams-empty-title">{fetchError ?? 'Player not found'}</h2>
          <p className="teams-empty-sub">The player may have been removed or the link is incorrect.</p>
          <button className="team-btn team-btn--primary" onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </AppShell>
    )
  }

  const initials = player.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Edit Stats slide-in panel */}
      {showEdit && (
        <div className="team-side-panel-overlay" onClick={() => setShowEdit(false)}>
          <div className="team-side-panel" onClick={e => e.stopPropagation()}>
            <div className="team-side-panel-header">
              <h2 className="team-side-panel-title">📊 Edit Stats</h2>
              <button className="team-side-panel-close" onClick={() => setShowEdit(false)} aria-label="Close">×</button>
            </div>
            <EditStatsForm player={player} onSave={handleSaveStats} onCancel={() => setShowEdit(false)} />
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={showDelete}
        title="Delete Player"
        message={`Permanently delete "${player.name}"? All their stats will be lost. This cannot be undone.`}
        confirmLabel="Delete Player"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
        dangerous
        loading={deleteLoading}
      />

      <div className="teams-page">
        {/* Back */}
        <button className="team-back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Squad
        </button>

        {/* ── Hero / Profile card ─────────────────────────────────────────── */}
        <div className="pdetail-hero" style={{ borderColor: `${accent}33` }}>
          {/* Accent top bar */}
          <div className="pdetail-hero-bar" style={{ background: accent }} />

          <div className="pdetail-hero-inner">
            {/* Avatar */}
            <div
              className="pdetail-avatar"
              style={{ background: `linear-gradient(135deg,${accent}33,${accent}11)`, border: `2px solid ${accent}55` }}
            >
              <span className="pdetail-avatar-initials" style={{ color: accent }}>{initials}</span>
              {player.jerseyNumber > 0 && (
                <span className="pdetail-avatar-jersey" style={{ color: accent }}>#{player.jerseyNumber}</span>
              )}
            </div>

            {/* Identity */}
            <div className="pdetail-identity">
              <h1 className="pdetail-name">{player.name}</h1>

              <span className="pdetail-role-badge" style={{ color: accent, borderColor: `${accent}44`, background: `${accent}11` }}>
                {ROLE_ICON[player.role]} {player.role}
              </span>

              <div className="pdetail-meta">
                {player.battingStyle && (
                  <span className="pdetail-meta-item">
                    🏏 {player.battingStyle} bat
                  </span>
                )}
                {player.bowlingStyle && player.bowlingStyle !== 'N/A' && (
                  <span className="pdetail-meta-item">
                    ⚡ {player.bowlingStyle}
                  </span>
                )}
                {player.email && (
                  <span className="pdetail-meta-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                    </svg>
                    {player.email}
                  </span>
                )}
                {player.phone && (
                  <span className="pdetail-meta-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    {player.phone}
                  </span>
                )}
              </div>
            </div>

            {/* Admin actions */}
            {isAdmin && (
              <div className="pdetail-admin-actions">
                <button
                  id="edit-stats-btn"
                  className="team-icon-btn team-icon-btn--edit"
                  onClick={() => setShowEdit(true)}
                  title="Edit stats"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit Stats
                </button>
                <button
                  id="delete-player-btn"
                  className="team-icon-btn team-icon-btn--delete"
                  onClick={() => setShowDelete(true)}
                  title="Delete player"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Statistics grid ─────────────────────────────────────────────── */}
        <div className="pdetail-section">
          <h2 className="pdetail-section-title">
            <span>📊</span> Career Statistics
            {!isAdmin && <span className="pdetail-readonly-badge">Read Only</span>}
          </h2>

          <div className="pdetail-stats-grid">
            <StatCard
              label="Matches"
              value={player.matches}
              icon="🗓️"
              accent="#22d3ee"
              description="Total matches played"
            />
            <StatCard
              label="Runs"
              value={player.runs}
              icon="🏏"
              accent="#f59e0b"
              description="Total runs scored"
            />
            <StatCard
              label="Wickets"
              value={player.wickets}
              icon="⚡"
              accent="#a78bfa"
              description="Total wickets taken"
            />
            <StatCard
              label="Average"
              value={player.average > 0 ? player.average.toFixed(2) : '—'}
              icon="📈"
              accent="#34d399"
              description="Batting average"
            />
            <StatCard
              label="Strike Rate"
              value={player.strikeRate > 0 ? player.strikeRate.toFixed(1) : '—'}
              icon="💥"
              accent="#f87171"
              description="Runs per 100 balls"
            />
            <StatCard
              label="Economy"
              value={player.economy > 0 ? player.economy.toFixed(2) : '—'}
              icon="🎯"
              accent="#fb923c"
              description="Runs per over bowled"
            />
          </div>

          {/* Zero-stats prompt for admin */}
          {isAdmin && player.matches === 0 && (
            <div className="pdetail-no-stats-hint">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              No match data yet. Use <strong>Edit Stats</strong> to record performance.
            </div>
          )}
        </div>
      </div>

      <style>{DETAIL_STYLES}</style>
    </AppShell>
  )
}

// ── Scoped styles ─────────────────────────────────────────────────────────────

const DETAIL_STYLES = `
  /* ── Hero card ── */
  .pdetail-hero {
    position: relative;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 22px;
    margin-bottom: 28px;
    overflow: hidden;
  }
  .pdetail-hero-bar {
    height: 3px;
    width: 100%;
  }
  .pdetail-hero-inner {
    display: flex;
    align-items: flex-start;
    gap: 24px;
    padding: 28px;
    flex-wrap: wrap;
  }

  /* Avatar */
  .pdetail-avatar {
    width: 80px;
    height: 80px;
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    gap: 2px;
  }
  .pdetail-avatar-initials {
    font-size: 26px;
    font-weight: 900;
    line-height: 1;
  }
  .pdetail-avatar-jersey {
    font-size: 11px;
    font-weight: 700;
    opacity: 0.75;
  }

  /* Identity */
  .pdetail-identity { flex: 1; min-width: 0; }
  .pdetail-name {
    font-size: clamp(20px, 3vw, 26px);
    font-weight: 800;
    color: #f1f5f9;
    margin: 0 0 8px;
    line-height: 1.2;
  }
  .pdetail-role-badge {
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid;
    border-radius: 999px;
    padding: 3px 12px;
    margin-bottom: 12px;
    letter-spacing: 0.02em;
  }
  .pdetail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .pdetail-meta-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #64748b;
  }

  /* Admin actions */
  .pdetail-admin-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
    align-items: flex-start;
  }

  /* ── Section ── */
  .pdetail-section { margin-bottom: 32px; }
  .pdetail-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 700;
    color: #e2e8f0;
    margin: 0 0 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .pdetail-readonly-badge {
    margin-left: auto;
    font-size: 11px;
    font-weight: 600;
    color: #475569;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 999px;
    padding: 2px 10px;
    letter-spacing: 0.04em;
  }

  /* ── Stats grid ── */
  .pdetail-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
  }
  .pdetail-stat-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    padding: 20px 16px;
    text-align: center;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  .pdetail-stat-card::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: var(--pdetail-accent, #22d3ee);
    opacity: 0;
    transition: opacity 0.2s;
  }
  .pdetail-stat-card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,0.12); }
  .pdetail-stat-card:hover::after { opacity: 1; }
  .pdetail-stat-icon { font-size: 22px; margin-bottom: 8px; }
  .pdetail-stat-value {
    font-size: 28px;
    font-weight: 900;
    color: var(--pdetail-accent, #22d3ee);
    line-height: 1;
    margin-bottom: 4px;
  }
  .pdetail-stat-label {
    font-size: 11px;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .pdetail-stat-desc {
    font-size: 10px;
    color: #334155;
    margin-top: 4px;
  }

  /* No-stats hint */
  .pdetail-no-stats-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    padding: 12px 16px;
    border-radius: 10px;
    background: rgba(34,211,238,0.05);
    border: 1px solid rgba(34,211,238,0.15);
    font-size: 13px;
    color: #64748b;
  }
  .pdetail-no-stats-hint strong { color: #94a3b8; }
  .pdetail-no-stats-hint svg { flex-shrink: 0; color: #22d3ee; }

  /* Edit stats grid */
  .pdetail-edit-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 16px;
  }
  @media (max-width: 420px) {
    .pdetail-edit-grid { grid-template-columns: 1fr; }
    .pdetail-stats-grid { grid-template-columns: repeat(2, 1fr); }
    .pdetail-hero-inner { gap: 16px; padding: 20px; }
    .pdetail-admin-actions { width: 100%; justify-content: flex-end; }
  }
`
