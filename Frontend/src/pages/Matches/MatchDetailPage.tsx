// src/pages/Matches/MatchDetailPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Match Detail — real-time scoreboard, toss, result, score editor (owner only).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { MatchForm, type MatchFormData } from '../../components/match/MatchForm'
import { ConfirmModal } from '../../components/common/ConfirmModal'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useAuth } from '../../context/AuthContext'
import {
  updateMatch,
  deleteMatch,
  startMatch,
  completeMatch,
  updateScore,
  subscribeToMatch,
} from '../../services/matchService'
import { getAllTeams } from '../../services/teamService'
import type { Match } from '../../types/match'
import type { Team } from '../../types/team'
import { useState as useLS, useEffect } from 'react'
import '../../styles/teams.css'
import '../../styles/matches.css'

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Match['status'], string> = {
  live:      'Live',
  upcoming:  'Upcoming',
  completed: 'Completed',
  abandoned: 'Abandoned',
}

const STATUS_COLOR: Record<Match['status'], string> = {
  live:      '#4ade80',
  upcoming:  '#38bdf8',
  completed: '#94a3b8',
  abandoned: '#f87171',
}

function formatDate(iso: string) {
  if (!iso) return 'TBD'
  try {
    return new Date(iso).toLocaleString('en-IN', {
      weekday: 'long', day: '2-digit', month: 'long',
      year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    })
  } catch { return iso }
}

// ── Score Editor ──────────────────────────────────────────────────────────────

interface ScoreEditorProps {
  match:   Match
  onSave:  (team: 1 | 2, score: number, wickets: number, overs: number) => Promise<void>
}

function ScoreEditor({ match, onSave }: ScoreEditorProps) {
  const [t1s, setT1s] = useState(match.team1Score)
  const [t1w, setT1w] = useState(match.team1Wickets)
  const [t1o, setT1o] = useState(match.team1Overs)
  const [t2s, setT2s] = useState(match.team2Score)
  const [t2w, setT2w] = useState(match.team2Wickets)
  const [t2o, setT2o] = useState(match.team2Overs)
  const [saving, setSaving] = useState<1 | 2 | null>(null)

  async function save(team: 1 | 2) {
    setSaving(team)
    try {
      await onSave(
        team,
        team === 1 ? t1s : t2s,
        team === 1 ? t1w : t2w,
        team === 1 ? t1o : t2o,
      )
    } finally { setSaving(null) }
  }

  const numInput = (
    val: number,
    setter: (v: number) => void,
    max: number,
    label: string,
    id: string,
  ) => (
    <div className="team-form-field">
      <label className="team-form-label" htmlFor={id} style={{ fontSize: 11 }}>{label}</label>
      <input
        id={id}
        type="number"
        className="team-form-input"
        value={val}
        min={0}
        max={max}
        step={id.includes('overs') ? 0.1 : 1}
        onChange={e => setter(parseFloat(e.target.value) || 0)}
        style={{ padding: '8px 12px' }}
      />
    </div>
  )

  return (
    <div className="match-section">
      <h3 className="match-section-title">⚡ Update Scores</h3>

      {/* Team 1 */}
      <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>
        {match.team1Logo} {match.team1Name}
      </p>
      <div className="match-score-grid" style={{ marginBottom: 12 }}>
        {numInput(t1s, setT1s, 9999, 'Runs',    'se-t1-runs')}
        {numInput(t1w, setT1w, 10,   'Wickets', 'se-t1-wkts')}
        {numInput(t1o, setT1o, match.totalOvers, 'Overs', 'se-t1-overs')}
      </div>
      <button
        className="team-btn team-btn--outline team-btn--sm"
        style={{ marginBottom: 20 }}
        onClick={() => save(1)}
        disabled={saving === 1}
      >
        {saving === 1 ? <span className="team-spinner" /> : 'Save Team 1 Score'}
      </button>

      {/* Team 2 */}
      <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>
        {match.team2Logo} {match.team2Name}
      </p>
      <div className="match-score-grid" style={{ marginBottom: 12 }}>
        {numInput(t2s, setT2s, 9999, 'Runs',    'se-t2-runs')}
        {numInput(t2w, setT2w, 10,   'Wickets', 'se-t2-wkts')}
        {numInput(t2o, setT2o, match.totalOvers, 'Overs', 'se-t2-overs')}
      </div>
      <button
        className="team-btn team-btn--outline team-btn--sm"
        onClick={() => save(2)}
        disabled={saving === 2}
      >
        {saving === 2 ? <span className="team-spinner" /> : 'Save Team 2 Score'}
      </button>
    </div>
  )
}

// ── Result Panel ──────────────────────────────────────────────────────────────

interface ResultPanelProps {
  match:    Match
  onResult: (result: Match['result'], summary: string) => Promise<void>
}

function ResultPanel({ match, onResult }: ResultPanelProps) {
  const [result,  setResult]  = useState<Match['result']>('team1')
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim()) return
    setLoading(true)
    try { await onResult(result, summary.trim()) }
    finally { setLoading(false) }
  }

  return (
    <div className="match-section">
      <h3 className="match-section-title">🏆 Declare Result</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([
            { value: 'team1',     label: `${match.team1Logo} ${match.team1Name} Won` },
            { value: 'team2',     label: `${match.team2Logo} ${match.team2Name} Won` },
            { value: 'tie',       label: '🤝 Tie' },
            { value: 'no_result', label: '🚫 No Result' },
          ] as Array<{ value: Match['result']; label: string }>).map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`player-form-chip${result === opt.value ? ' player-form-chip--active' : ''}`}
              onClick={() => setResult(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="team-form-field">
          <label className="team-form-label" htmlFor="result-summary">Result Summary</label>
          <input
            id="result-summary"
            type="text"
            className="team-form-input"
            placeholder="e.g. Warriors won by 24 runs"
            value={summary}
            onChange={e => setSummary(e.target.value)}
            maxLength={120}
          />
        </div>
        <button id="declare-result-btn" type="submit" className="team-btn team-btn--primary" disabled={loading || !summary.trim()}>
          {loading ? <><span className="team-spinner" /> Saving…</> : 'Declare Result'}
        </button>
      </form>
    </div>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function useMatchDetail(matchId: string | undefined) {
  const [match,   setMatch]   = useLS<Match | null>(null)
  const [teams,   setTeams]   = useLS<Team[]>([])
  const [loading, setLoading] = useLS(true)
  const [error,   setError]   = useLS<string | null>(null)

  useEffect(() => {
    if (!matchId) return
    let unsub: (() => void) | undefined
    unsub = subscribeToMatch(matchId, data => {
      if (!data) { setError('Match not found.'); setLoading(false); return }
      setMatch(data)
      setLoading(false)
    })
    getAllTeams().then(setTeams)
    return () => { unsub?.() }
  }, [matchId])

  return { match, teams, loading, error }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate    = useNavigate()
  const { user }    = useAuth()
  const { toasts, showToast, dismissToast } = useToast()

  const { match, teams, loading, error } = useMatchDetail(matchId)

  const [showEdit,   setShowEdit]   = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [startLoading,  setStartLoading]  = useState(false)

  const isOwner = !!user && !!match && user.uid === match.createdBy

  // ── Actions ─────────────────────────────────────────────────────────────
  async function handleEdit(data: MatchFormData) {
    if (!match) return
    try {
      await updateMatch(match.id, data)
      showToast('Match updated! ✅', 'success')
      setShowEdit(false)
    } catch {
      showToast('Failed to update.', 'error')
      throw new Error('fail')
    }
  }

  async function handleDelete() {
    if (!match) return
    setDeleteLoading(true)
    try {
      await deleteMatch(match.id)
      navigate('/matches', { replace: true })
    } catch {
      showToast('Failed to delete match.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleStart() {
    if (!match) return
    setStartLoading(true)
    try {
      await startMatch(match.id)
      showToast('Match started! 🏏', 'success')
    } catch {
      showToast('Failed to start match.', 'error')
    } finally {
      setStartLoading(false)
    }
  }

  async function handleScore(team: 1 | 2, score: number, wickets: number, overs: number) {
    if (!match) return
    await updateScore(match.id, team, score, wickets, overs)
    showToast('Score updated!', 'success')
  }

  async function handleResult(result: Match['result'], summary: string) {
    if (!match) return
    await completeMatch(match.id, result, summary)
    showToast(`Result declared: ${summary}`, 'success')
  }

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell>
        <div className="teams-loading">
          <div className="team-spinner team-spinner--lg" /><p>Loading match…</p>
        </div>
      </AppShell>
    )
  }

  if (error || !match) {
    return (
      <AppShell>
        <div className="teams-empty">
          <div className="teams-empty-icon">😕</div>
          <h2 className="teams-empty-title">{error ?? 'Match not found'}</h2>
          <button className="team-btn team-btn--primary" onClick={() => navigate('/matches')}>
            All Matches
          </button>
        </div>
      </AppShell>
    )
  }

  const accent = STATUS_COLOR[match.status]

  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Edit panel */}
      {showEdit && (
        <div className="team-side-panel-overlay" onClick={() => setShowEdit(false)}>
          <div className="team-side-panel" onClick={e => e.stopPropagation()}>
            <div className="team-side-panel-header">
              <h2 className="team-side-panel-title">✏️ Edit Match</h2>
              <button className="team-side-panel-close" onClick={() => setShowEdit(false)}>×</button>
            </div>
            <MatchForm existing={match} teams={teams} onSubmit={handleEdit} onCancel={() => setShowEdit(false)} submitLabel="Save Changes" />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDelete}
        title="Delete Match"
        message={`Delete "${match.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
        dangerous
        loading={deleteLoading}
      />

      <div className="match-detail-page">
        <button className="team-back-btn" onClick={() => navigate('/matches')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Matches
        </button>

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <div className="match-detail-hero" style={{ marginTop: 16 }}>
          <div className="match-detail-hero-bar" style={{ background: accent }} />
          <div className="match-detail-hero-inner">

            <div className="match-detail-header">
              <div>
                <h1 style={{ fontSize: 'clamp(18px,3vw,24px)', fontWeight: 900, color: '#f1f5f9', margin: '0 0 8px' }}>
                  {match.title}
                </h1>
                <span className={`match-status match-status--${match.status}`}>
                  <span className="match-status-dot" />
                  {STATUS_LABEL[match.status]}
                </span>
              </div>

              {isOwner && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button id="detail-edit-btn" className="team-icon-btn team-icon-btn--edit" onClick={() => setShowEdit(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
                  </button>
                  <button id="detail-delete-btn" className="team-icon-btn team-icon-btn--delete" onClick={() => setShowDelete(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>

            {/* Scoreboard */}
            <div className="match-detail-scoreboard">
              {/* Team 1 */}
              <div className="match-detail-team">
                <span className="match-detail-team-logo">{match.team1Logo}</span>
                <span className="match-detail-team-name">{match.team1Name}</span>
                <span className={`match-detail-score${match.status === 'upcoming' ? ' match-detail-score--dim' : ''}`}>
                  {match.status === 'upcoming' ? '— / —' : `${match.team1Score}/${match.team1Wickets}`}
                </span>
                {match.status !== 'upcoming' && (
                  <span className="match-detail-overs">({match.team1Overs.toFixed(1)} ov)</span>
                )}
              </div>

              <div className="match-detail-vs-col">
                <span className="match-detail-vs-text">VS</span>
                <span style={{ fontSize: 11, color: '#334155' }}>{match.format} · {match.totalOvers} ov</span>
              </div>

              {/* Team 2 */}
              <div className="match-detail-team match-detail-team--right">
                <span className="match-detail-team-logo">{match.team2Logo}</span>
                <span className="match-detail-team-name">{match.team2Name}</span>
                <span className={`match-detail-score${match.status === 'upcoming' ? ' match-detail-score--dim' : ''}`}>
                  {match.status === 'upcoming' ? '— / —' : `${match.team2Score}/${match.team2Wickets}`}
                </span>
                {match.status !== 'upcoming' && (
                  <span className="match-detail-overs">({match.team2Overs.toFixed(1)} ov)</span>
                )}
              </div>
            </div>

            {/* Toss */}
            {match.tossWinnerId && match.tossDecision && (
              <div className="match-toss-info">
                🪙 Toss: {match.tossWinnerId === match.team1Id ? match.team1Name : match.team2Name} won and elected to {match.tossDecision}
              </div>
            )}

            {/* Meta */}
            <div className="match-detail-meta-row">
              <span className="match-detail-meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {match.venue || 'TBD'}
              </span>
              <span className="match-detail-meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {formatDate(match.scheduledAt)}
              </span>
            </div>

            {/* Result banner */}
            {match.status === 'completed' && match.resultSummary && (
              <div className="match-result-banner">🏆 {match.resultSummary}</div>
            )}
          </div>
        </div>

        {/* ── Owner admin tools ───────────────────────────────────────────── */}
        {isOwner && (
          <>
            {match.status === 'upcoming' && (
              <div className="match-admin-bar">
                <button
                  id="start-match-btn"
                  className="team-btn team-btn--primary"
                  onClick={handleStart}
                  disabled={startLoading}
                >
                  {startLoading ? <><span className="team-spinner" /> Starting…</> : '▶ Start Match'}
                </button>
              </div>
            )}

            {match.status === 'live' && (
              <>
                <ScoreEditor match={match} onSave={handleScore} />
                <ResultPanel match={match} onResult={handleResult} />
              </>
            )}

            {/* Toss editor (upcoming or live) */}
            {(match.status === 'upcoming' || match.status === 'live') && (
              <div className="match-section">
                <h3 className="match-section-title">🪙 Toss</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    id="toss-winner-select"
                    className="team-form-input"
                    style={{ flex: 1, minWidth: 160 }}
                    value={match.tossWinnerId}
                    onChange={e => updateMatch(match.id, { tossWinnerId: e.target.value })}
                  >
                    <option value="">— Toss winner —</option>
                    <option value={match.team1Id}>{match.team1Logo} {match.team1Name}</option>
                    <option value={match.team2Id}>{match.team2Logo} {match.team2Name}</option>
                  </select>
                  <select
                    id="toss-decision-select"
                    className="team-form-input"
                    style={{ flex: 1, minWidth: 140 }}
                    value={match.tossDecision}
                    onChange={e => updateMatch(match.id, { tossDecision: e.target.value as 'bat' | 'field' })}
                  >
                    <option value="">— Decision —</option>
                    <option value="bat">Bat first</option>
                    <option value="field">Field first</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
