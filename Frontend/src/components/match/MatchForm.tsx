// src/components/match/MatchForm.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable form for Create / Edit match.
// Receives a list of available teams from the parent.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent } from 'react'
import type { Match, MatchFormat } from '../../types/match'
import type { Team } from '../../types/team'

// ── Static options ────────────────────────────────────────────────────────────

const FORMATS: MatchFormat[] = ['T20', 'ODI', 'T10', 'Test', 'Custom']

const DEFAULT_OVERS: Record<MatchFormat, number> = {
  T20:    20,
  ODI:    50,
  T10:    10,
  Test:   90,
  Custom: 20,
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MatchFormData {
  title:       string
  format:      MatchFormat
  totalOvers:  number
  venue:       string
  scheduledAt: string
  team1Id:     string
  team1Name:   string
  team1Logo:   string
  team2Id:     string
  team2Name:   string
  team2Logo:   string
}

interface MatchFormProps {
  existing?:   Match
  teams:       Team[]
  onSubmit:    (data: MatchFormData) => Promise<void>
  onCancel:    () => void
  submitLabel?: string
}

// ── Validation ────────────────────────────────────────────────────────────────

type FormErrors = Partial<Record<keyof MatchFormData | 'teams', string>>

function validate(f: MatchFormData): FormErrors {
  const e: FormErrors = {}
  if (!f.title.trim())       e.title       = 'Match title is required.'
  else if (f.title.length > 80) e.title    = 'Title must be under 80 characters.'
  if (!f.venue.trim())       e.venue       = 'Venue is required.'
  if (!f.scheduledAt)        e.scheduledAt = 'Schedule date & time is required.'
  if (!f.team1Id)            e.teams       = 'Select Team 1.'
  if (!f.team2Id)            e.teams       = 'Select Team 2.'
  if (f.team1Id && f.team1Id === f.team2Id) e.teams = 'Team 1 and Team 2 must be different.'
  if (f.totalOvers < 1 || f.totalOvers > 999) e.totalOvers = 'Overs must be between 1 and 999.'
  return e
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MatchForm({
  existing,
  teams,
  onSubmit,
  onCancel,
  submitLabel = 'Save Match',
}: MatchFormProps) {
  // Auto-generate title helper
  function autoTitle(t1: string, t2: string) {
    if (t1 && t2) return `${t1} vs ${t2}`
    return ''
  }

  const [title,       setTitle]       = useState(existing?.title       ?? '')
  const [format,      setFormat]      = useState<MatchFormat>(existing?.format ?? 'T20')
  const [totalOvers,  setTotalOvers]  = useState(existing?.totalOvers  ?? 20)
  const [venue,       setVenue]       = useState(existing?.venue       ?? '')
  const [scheduledAt, setScheduledAt] = useState(existing?.scheduledAt ?? '')
  const [team1Id,     setTeam1Id]     = useState(existing?.team1Id     ?? '')
  const [team2Id,     setTeam2Id]     = useState(existing?.team2Id     ?? '')
  const [errors,      setErrors]      = useState<FormErrors>({})
  const [loading,     setLoading]     = useState(false)

  function teamById(id: string) { return teams.find(t => t.id === id) }

  function handleTeam1(id: string) {
    const t = teamById(id)
    setTeam1Id(id)
    setErrors(prev => ({ ...prev, teams: undefined }))
    // Auto-fill title if other team is selected
    if (!existing) {
      const t2 = teamById(team2Id)
      if (t && t2) setTitle(autoTitle(t.teamName, t2.teamName))
    }
  }

  function handleTeam2(id: string) {
    const t = teamById(id)
    setTeam2Id(id)
    setErrors(prev => ({ ...prev, teams: undefined }))
    if (!existing) {
      const t1 = teamById(team1Id)
      if (t1 && t) setTitle(autoTitle(t1.teamName, t.teamName))
    }
  }

  function handleFormat(f: MatchFormat) {
    setFormat(f)
    setTotalOvers(DEFAULT_OVERS[f])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const t1 = teamById(team1Id)
    const t2 = teamById(team2Id)
    const data: MatchFormData = {
      title:       title.trim(),
      format,
      totalOvers,
      venue:       venue.trim(),
      scheduledAt,
      team1Id,
      team1Name:   t1?.teamName ?? '',
      team1Logo:   t1?.logo     ?? '🏏',
      team2Id,
      team2Name:   t2?.teamName ?? '',
      team2Logo:   t2?.logo     ?? '🏏',
    }
    const errs = validate(data)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      await onSubmit(data)
    } finally {
      setLoading(false)
    }
  }

  // ── Local input helper ────────────────────────────────────────────────────
  const fieldError = (key: keyof FormErrors) =>
    errors[key] ? <p className="team-form-error" role="alert">{errors[key]}</p> : null

  return (
    <form className="team-form" onSubmit={handleSubmit} noValidate>

      {/* Title */}
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="match-title">
          Match Title <span className="team-form-required">*</span>
        </label>
        <input
          id="match-title"
          type="text"
          className={`team-form-input${errors.title ? ' team-form-input--error' : ''}`}
          placeholder="e.g. Warriors vs Thunder — Finals"
          value={title}
          onChange={e => { setTitle(e.target.value); setErrors(p => ({ ...p, title: undefined })) }}
          maxLength={80}
          autoFocus
        />
        {fieldError('title')}
        <p className="team-form-hint">{title.length}/80</p>
      </div>

      {/* Format chips */}
      <div className="team-form-field">
        <label className="team-form-label">Format <span className="team-form-required">*</span></label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FORMATS.map(f => (
            <button
              key={f}
              type="button"
              className={`player-form-chip${format === f ? ' player-form-chip--active' : ''}`}
              onClick={() => handleFormat(f)}
              aria-pressed={format === f}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Overs + Venue */}
      <div className="match-form-row">
        <div className="team-form-field">
          <label className="team-form-label" htmlFor="match-overs">
            Overs <span className="team-form-required">*</span>
          </label>
          <input
            id="match-overs"
            type="number"
            className={`team-form-input${errors.totalOvers ? ' team-form-input--error' : ''}`}
            value={totalOvers}
            min={1}
            max={999}
            onChange={e => { setTotalOvers(parseInt(e.target.value) || 1); setErrors(p => ({ ...p, totalOvers: undefined })) }}
          />
          {fieldError('totalOvers')}
        </div>

        <div className="team-form-field">
          <label className="team-form-label" htmlFor="match-venue">
            Venue <span className="team-form-required">*</span>
          </label>
          <input
            id="match-venue"
            type="text"
            className={`team-form-input${errors.venue ? ' team-form-input--error' : ''}`}
            placeholder="e.g. Sector 14 Ground"
            value={venue}
            onChange={e => { setVenue(e.target.value); setErrors(p => ({ ...p, venue: undefined })) }}
            maxLength={80}
          />
          {fieldError('venue')}
        </div>
      </div>

      {/* Scheduled At */}
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="match-scheduled">
          Date & Time <span className="team-form-required">*</span>
        </label>
        <input
          id="match-scheduled"
          type="datetime-local"
          className={`team-form-input${errors.scheduledAt ? ' team-form-input--error' : ''}`}
          value={scheduledAt}
          onChange={e => { setScheduledAt(e.target.value); setErrors(p => ({ ...p, scheduledAt: undefined })) }}
        />
        {fieldError('scheduledAt')}
      </div>

      {/* Teams */}
      {errors.teams && <p className="team-form-error" role="alert">{errors.teams}</p>}
      <div className="match-form-row">
        <div className="team-form-field">
          <label className="team-form-label" htmlFor="match-team1">
            Team 1 <span className="team-form-required">*</span>
          </label>
          <select
            id="match-team1"
            className={`team-form-input${errors.teams ? ' team-form-input--error' : ''}`}
            value={team1Id}
            onChange={e => handleTeam1(e.target.value)}
          >
            <option value="">— Select Team —</option>
            {teams.map(t => (
              <option key={t.id} value={t.id} disabled={t.id === team2Id}>
                {t.logo} {t.teamName}
              </option>
            ))}
          </select>
        </div>

        <div className="team-form-field">
          <label className="team-form-label" htmlFor="match-team2">
            Team 2 <span className="team-form-required">*</span>
          </label>
          <select
            id="match-team2"
            className={`team-form-input${errors.teams ? ' team-form-input--error' : ''}`}
            value={team2Id}
            onChange={e => handleTeam2(e.target.value)}
          >
            <option value="">— Select Team —</option>
            {teams.map(t => (
              <option key={t.id} value={t.id} disabled={t.id === team1Id}>
                {t.logo} {t.teamName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="team-form-actions">
        <button type="button" className="team-btn team-btn--ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button id="match-form-submit" type="submit" className="team-btn team-btn--primary" disabled={loading}>
          {loading ? <><span className="team-spinner" /> Saving…</> : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default MatchForm
