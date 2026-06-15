// src/components/team/TeamForm.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Unified form for Create Team and Edit Team.
// Handles validation, loading state, emoji logo picker.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import type { Team } from '../../types/team'

const LOGO_OPTIONS = ['🏏', '⚡', '🔥', '🦁', '🐯', '🦅', '🐉', '💥', '🌟', '🚀', '🎯', '🏆', '👑', '🦊', '🐺', '🦈']

interface TeamFormProps {
  /** If provided, form is in Edit mode */
  existing?: Team
  onSubmit: (data: { teamName: string; logo: string; captain: string }) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

export function TeamForm({ existing, onSubmit, onCancel, submitLabel = 'Create Team' }: TeamFormProps) {
  const [teamName, setTeamName] = useState(existing?.teamName ?? '')
  const [logo, setLogo]         = useState(existing?.logo ?? '🏏')
  const [captain, setCaptain]   = useState(existing?.captain ?? '')
  const [loading, setLoading]   = useState(false)
  const [errors, setErrors]     = useState<Record<string, string>>({})
  const [showPicker, setShowPicker] = useState(false)

  function validate() {
    const errs: Record<string, string> = {}
    if (!teamName.trim()) errs.teamName = 'Team name is required.'
    else if (teamName.trim().length < 3) errs.teamName = 'Team name must be at least 3 characters.'
    else if (teamName.trim().length > 40) errs.teamName = 'Team name must be under 40 characters.'
    if (!captain.trim()) errs.captain = 'Captain name is required.'
    else if (captain.trim().length < 2) errs.captain = 'Captain name must be at least 2 characters.'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      await onSubmit({ teamName: teamName.trim(), logo, captain: captain.trim() })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="team-form" onSubmit={handleSubmit} noValidate>
      {/* Logo picker */}
      <div className="team-form-field">
        <label className="team-form-label">Team Logo</label>
        <div className="team-logo-picker-row">
          <button
            type="button"
            className="team-logo-preview-btn"
            onClick={() => setShowPicker(v => !v)}
            title="Pick a logo"
          >
            <span className="team-logo-preview-emoji">{logo}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <span className="team-form-hint">Click to choose your team's emoji logo</span>
        </div>
        {showPicker && (
          <div className="team-logo-grid">
            {LOGO_OPTIONS.map(e => (
              <button
                key={e}
                type="button"
                className={`team-logo-option ${logo === e ? 'selected' : ''}`}
                onClick={() => { setLogo(e); setShowPicker(false) }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Team Name */}
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="team-name-input">
          Team Name <span className="team-form-required">*</span>
        </label>
        <input
          id="team-name-input"
          className={`team-form-input ${errors.teamName ? 'team-form-input--error' : ''}`}
          type="text"
          placeholder="e.g. Thunder XI, Gully Warriors"
          value={teamName}
          onChange={e => { setTeamName(e.target.value); setErrors(prev => ({ ...prev, teamName: '' })) }}
          maxLength={40}
          autoFocus
        />
        {errors.teamName && <p className="team-form-error">{errors.teamName}</p>}
        <p className="team-form-hint">{teamName.length}/40</p>
      </div>

      {/* Captain */}
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="captain-input">
          Captain Name <span className="team-form-required">*</span>
        </label>
        <input
          id="captain-input"
          className={`team-form-input ${errors.captain ? 'team-form-input--error' : ''}`}
          type="text"
          placeholder="e.g. Rohit Sharma"
          value={captain}
          onChange={e => { setCaptain(e.target.value); setErrors(prev => ({ ...prev, captain: '' })) }}
          maxLength={50}
        />
        {errors.captain && <p className="team-form-error">{errors.captain}</p>}
      </div>

      {/* Actions */}
      <div className="team-form-actions">
        <button
          type="button"
          className="team-btn team-btn--ghost"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          id="team-form-submit"
          type="submit"
          className="team-btn team-btn--primary"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="team-spinner" />
              Saving…
            </>
          ) : submitLabel}
        </button>
      </div>
    </form>
  )
}
