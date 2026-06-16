// src/components/player/PlayerForm.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable form for creating and editing a Player.
// Supports both "Create" and "Edit" modes via the `existing` prop.
// Validation is performed client-side before delegating to the caller.
// Styling reuses the `.team-form-*` tokens already defined in teams.css
// so no new CSS file is needed.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent } from 'react'
import type { Player, PlayerRole, BattingStyle, BowlingStyle } from '../../types/player'

// ── Static option lists ───────────────────────────────────────────────────────

const ROLES: PlayerRole[] = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper']

const BATTING_STYLES: BattingStyle[] = ['Right-Handed', 'Left-Handed']

const BOWLING_STYLES: BowlingStyle[] = [
  'Right-Arm Fast',
  'Right-Arm Medium',
  'Right-Arm Off-Spin',
  'Right-Arm Leg-Spin',
  'Left-Arm Fast',
  'Left-Arm Medium',
  'Left-Arm Orthodox',
  'Left-Arm Chinaman',
  'N/A',
]

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PlayerFormData {
  name: string
  email: string
  phone: string
  jerseyNumber: number
  role: PlayerRole
  battingStyle: BattingStyle
  bowlingStyle: BowlingStyle
}

interface PlayerFormProps {
  /** When provided the form runs in Edit mode, pre-populating all fields. */
  existing?: Player
  /** Called with validated data. Parent is responsible for the Firestore write. */
  onSubmit: (data: PlayerFormData) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

// ── Validation ────────────────────────────────────────────────────────────────

type FormErrors = Partial<Record<keyof PlayerFormData, string>>

function validate(fields: PlayerFormData): FormErrors {
  const errs: FormErrors = {}

  // Name
  if (!fields.name.trim()) {
    errs.name = 'Player name is required.'
  } else if (fields.name.trim().length < 2) {
    errs.name = 'Name must be at least 2 characters.'
  } else if (fields.name.trim().length > 60) {
    errs.name = 'Name must be under 60 characters.'
  }

  // Email — optional but must be valid when provided
  if (fields.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
    errs.email = 'Please enter a valid email address.'
  }

  // Phone — optional but must be plausibly numeric when provided
  if (fields.phone.trim() && !/^\+?[\d\s\-()]{7,15}$/.test(fields.phone.trim())) {
    errs.phone = 'Please enter a valid phone number.'
  }

  // Jersey number
  if (fields.jerseyNumber < 0 || fields.jerseyNumber > 999) {
    errs.jerseyNumber = 'Jersey number must be between 0 and 999.'
  }
  if (!Number.isInteger(fields.jerseyNumber)) {
    errs.jerseyNumber = 'Jersey number must be a whole number.'
  }

  return errs
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlayerForm({
  existing,
  onSubmit,
  onCancel,
  submitLabel = 'Save Player',
}: PlayerFormProps) {
  // ── Local state ─────────────────────────────────────────────────────────────
  const [name, setName]               = useState(existing?.name         ?? '')
  const [email, setEmail]             = useState(existing?.email        ?? '')
  const [phone, setPhone]             = useState(existing?.phone        ?? '')
  const [jerseyNumber, setJerseyNumber] = useState<number>(existing?.jerseyNumber ?? 0)
  const [role, setRole]               = useState<PlayerRole>(existing?.role ?? 'Batsman')
  const [battingStyle, setBattingStyle] = useState<BattingStyle>(existing?.battingStyle ?? 'Right-Handed')
  const [bowlingStyle, setBowlingStyle] = useState<BowlingStyle>(existing?.bowlingStyle ?? 'N/A')

  const [errors, setErrors]   = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function clearFieldError(field: keyof PlayerFormData) {
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const fields: PlayerFormData = {
      name:         name.trim(),
      email:        email.trim(),
      phone:        phone.trim(),
      jerseyNumber,
      role,
      battingStyle,
      bowlingStyle,
    }

    const errs = validate(fields)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      // Scroll the first error into view
      const firstErrorId = Object.keys(errs)[0]
      document.getElementById(`player-${firstErrorId}`)?.focus()
      return
    }

    setErrors({})
    setLoading(true)
    try {
      await onSubmit(fields)
    } finally {
      setLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <form
      className="team-form"
      onSubmit={handleSubmit}
      noValidate
      aria-label={existing ? 'Edit player' : 'Add player'}
    >
      {/* ── Section: Identity ─────────────────────────────────────────────── */}
      <p className="player-form-section-label">Personal Info</p>

      {/* Name */}
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="player-name">
          Full Name <span className="team-form-required">*</span>
        </label>
        <input
          id="player-name"
          type="text"
          className={`team-form-input${errors.name ? ' team-form-input--error' : ''}`}
          placeholder="e.g. Rohit Sharma"
          value={name}
          onChange={e => { setName(e.target.value); clearFieldError('name') }}
          maxLength={60}
          autoFocus
          autoComplete="name"
        />
        {errors.name
          ? <p className="team-form-error" role="alert">{errors.name}</p>
          : <p className="team-form-hint">{name.length}/60</p>
        }
      </div>

      {/* Email + Phone side by side on wider screens */}
      <div className="player-form-row">
        {/* Email */}
        <div className="team-form-field player-form-col">
          <label className="team-form-label" htmlFor="player-email">
            Email <span className="team-form-optional">(optional)</span>
          </label>
          <input
            id="player-email"
            type="email"
            className={`team-form-input${errors.email ? ' team-form-input--error' : ''}`}
            placeholder="player@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); clearFieldError('email') }}
            maxLength={100}
            autoComplete="email"
          />
          {errors.email && <p className="team-form-error" role="alert">{errors.email}</p>}
        </div>

        {/* Phone */}
        <div className="team-form-field player-form-col">
          <label className="team-form-label" htmlFor="player-phone">
            Phone <span className="team-form-optional">(optional)</span>
          </label>
          <input
            id="player-phone"
            type="tel"
            className={`team-form-input${errors.phone ? ' team-form-input--error' : ''}`}
            placeholder="+91 98765 43210"
            value={phone}
            onChange={e => { setPhone(e.target.value); clearFieldError('phone') }}
            maxLength={20}
            autoComplete="tel"
          />
          {errors.phone && <p className="team-form-error" role="alert">{errors.phone}</p>}
        </div>
      </div>

      {/* Jersey Number */}
      <div className="team-form-field" style={{ maxWidth: 180 }}>
        <label className="team-form-label" htmlFor="player-jerseyNumber">
          Jersey Number <span className="team-form-required">*</span>
        </label>
        <input
          id="player-jerseyNumber"
          type="number"
          className={`team-form-input${errors.jerseyNumber ? ' team-form-input--error' : ''}`}
          placeholder="e.g. 18"
          value={jerseyNumber}
          onChange={e => {
            setJerseyNumber(parseInt(e.target.value, 10) || 0)
            clearFieldError('jerseyNumber')
          }}
          min={0}
          max={999}
        />
        {errors.jerseyNumber && (
          <p className="team-form-error" role="alert">{errors.jerseyNumber}</p>
        )}
      </div>

      {/* ── Section: Playing Profile ──────────────────────────────────────── */}
      <p className="player-form-section-label" style={{ marginTop: 8 }}>Playing Profile</p>

      {/* Role */}
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="player-role">
          Role <span className="team-form-required">*</span>
        </label>
        <div className="player-form-chip-group" role="radiogroup" aria-labelledby="player-role">
          {ROLES.map(r => (
            <button
              key={r}
              type="button"
              id={role === r ? 'player-role' : undefined}
              className={`player-form-chip${role === r ? ' player-form-chip--active' : ''}`}
              onClick={() => setRole(r)}
              aria-pressed={role === r}
            >
              {ROLE_ICON[r]} {r}
            </button>
          ))}
        </div>
      </div>

      {/* Batting Style */}
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="player-battingStyle">
          Batting Style <span className="team-form-required">*</span>
        </label>
        <div className="player-form-chip-group" role="radiogroup" aria-labelledby="player-battingStyle">
          {BATTING_STYLES.map(s => (
            <button
              key={s}
              type="button"
              className={`player-form-chip${battingStyle === s ? ' player-form-chip--active' : ''}`}
              onClick={() => setBattingStyle(s)}
              aria-pressed={battingStyle === s}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Bowling Style */}
      <div className="team-form-field">
        <label className="team-form-label" htmlFor="player-bowlingStyle">
          Bowling Style <span className="team-form-required">*</span>
        </label>
        <select
          id="player-bowlingStyle"
          className="team-form-input"
          value={bowlingStyle}
          onChange={e => setBowlingStyle(e.target.value as BowlingStyle)}
        >
          {BOWLING_STYLES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
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
          id="player-form-submit"
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

      {/* Inline styles scoped to this component only */}
      <style>{PLAYER_FORM_STYLES}</style>
    </form>
  )
}

// ── Role icons map ────────────────────────────────────────────────────────────

const ROLE_ICON: Record<PlayerRole, string> = {
  'Batsman':        '🏏',
  'Bowler':         '⚡',
  'All-Rounder':    '🌟',
  'Wicket-Keeper':  '🧤',
}

// ── Scoped styles ─────────────────────────────────────────────────────────────
// Minimal additions that don't override global team-form tokens.
// All colours reference the same CSS variables used by teams.css.

const PLAYER_FORM_STYLES = `
  /* Section label */
  .player-form-section-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #475569;
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  /* Two-column row (email + phone) */
  .player-form-row {
    display: flex;
    gap: 16px;
  }
  .player-form-col {
    flex: 1;
    min-width: 0;
  }
  @media (max-width: 520px) {
    .player-form-row {
      flex-direction: column;
      gap: 0;
    }
  }

  /* Optional label suffix */
  .team-form-optional {
    font-size: 11px;
    font-weight: 400;
    color: #475569;
    margin-left: 4px;
  }

  /* Chip toggle group (Role, Batting Style) */
  .player-form-chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .player-form-chip {
    padding: 7px 16px;
    border-radius: 999px;
    border: 1.5px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    color: #94a3b8;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.18s ease;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .player-form-chip:hover:not(.player-form-chip--active) {
    border-color: rgba(34,211,238,0.35);
    color: #e2e8f0;
    background: rgba(34,211,238,0.06);
  }
  .player-form-chip--active {
    border-color: #22d3ee;
    background: rgba(34,211,238,0.12);
    color: #22d3ee;
    box-shadow: 0 0 0 3px rgba(34,211,238,0.08);
  }

  /* Native select dark override */
  .team-form-input option {
    background: #0f172a;
    color: #e2e8f0;
  }
`

export default PlayerForm
