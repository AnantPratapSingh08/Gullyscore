// src/components/player/EditPlayerStatsModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal for editing all player statistics.
// SECURITY: renders nothing unless `isAdmin` prop is true.
//   The parent is responsible for evaluating user.role === "admin"
//   (or the project-equivalent: user.uid === player.createdBy) before
//   passing isAdmin=true.  This component never reads auth state itself.
//
// New fields (balls, fours, sixes, overs) are not yet on the Player TS type,
// so they are written to Firestore via a cast through Record<string,unknown>.
// updatePlayerStats() already performs this cast internally (line 143 of
// playerService.ts), so extra keys reach Firestore without TS errors here.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import type { Player, PlayerStatsPayload } from '../../types/player'
import { updatePlayerStats } from '../../services/playerService'

// ── Extended stats (superset of PlayerStatsPayload) ───────────────────────────
// Includes the four extra counting fields that are not yet on the Player type.
// Written to Firestore by casting to Record<string, unknown>.

interface ExtendedStats {
  // Core fields — match PlayerStatsPayload
  matches:    number
  runs:       number
  wickets:    number
  average:    number
  strikeRate: number
  economy:    number
  // Extra counting fields
  balls:      number
  fours:      number
  sixes:      number
  overs:      number
}

// ── Field definitions (drives the rendered rows) ──────────────────────────────

interface FieldDef {
  key: keyof ExtendedStats
  label: string
  hint: string
  step: number
  icon: string
}

const FIELDS: FieldDef[] = [
  { key: 'matches',    label: 'Matches',     hint: 'Total matches played',                  step: 1,    icon: '🗓️'  },
  { key: 'runs',       label: 'Runs',        hint: 'Total runs scored',                     step: 1,    icon: '🏏'  },
  { key: 'balls',      label: 'Balls',       hint: 'Total balls faced (batting)',            step: 1,    icon: '🔴'  },
  { key: 'fours',      label: 'Fours',       hint: 'Total boundary fours hit',              step: 1,    icon: '4️⃣'  },
  { key: 'sixes',      label: 'Sixes',       hint: 'Total sixes hit',                       step: 1,    icon: '6️⃣'  },
  { key: 'wickets',    label: 'Wickets',     hint: 'Total wickets taken',                   step: 1,    icon: '⚡'  },
  { key: 'overs',      label: 'Overs',       hint: 'Total overs bowled',                    step: 0.1,  icon: '🎳'  },
  { key: 'average',    label: 'Average',     hint: 'Batting average (runs ÷ dismissals)',   step: 0.01, icon: '📈'  },
  { key: 'strikeRate', label: 'Strike Rate', hint: 'Runs per 100 balls faced',              step: 0.01, icon: '💥'  },
  { key: 'economy',    label: 'Economy',     hint: 'Runs conceded per over bowled',         step: 0.01, icon: '🎯'  },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface EditPlayerStatsModalProps {
  /** The player whose stats are being edited. */
  player: Player
  /**
   * Must be true for the modal to render at all.
   * Parent evaluates:  user.role === "admin"  (or equivalent uid check).
   * When false, this component returns null immediately.
   */
  isAdmin: boolean
  /** Called after a successful Firestore write. Use to refetch player data. */
  onSuccess: () => void
  /** Called when the user dismisses without saving. */
  onClose: () => void
}

// ── Validation ────────────────────────────────────────────────────────────────

type FormErrors = Partial<Record<keyof ExtendedStats, string>>

function validate(s: ExtendedStats): FormErrors {
  const e: FormErrors = {}
  const integers: Array<keyof ExtendedStats> = ['matches', 'runs', 'balls', 'fours', 'sixes', 'wickets']
  integers.forEach(k => {
    if (s[k] < 0)              e[k] = 'Cannot be negative.'
    if (!Number.isInteger(s[k])) e[k] = 'Must be a whole number.'
  })
  if (s.overs      < 0) e.overs      = 'Cannot be negative.'
  if (s.average    < 0) e.average    = 'Cannot be negative.'
  if (s.strikeRate < 0) e.strikeRate = 'Cannot be negative.'
  if (s.economy    < 0) e.economy    = 'Cannot be negative.'
  return e
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditPlayerStatsModal({ player, isAdmin, onSuccess, onClose }: EditPlayerStatsModalProps) {
  // ── Admin gate — must be the very first thing after hooks ────────────────
  // We still call all hooks unconditionally (React rules), but render nothing.

  const [stats, setStats]   = useState<ExtendedStats>(() => ({
    matches:    player.matches,
    runs:       player.runs,
    wickets:    player.wickets,
    average:    player.average,
    strikeRate: player.strikeRate,
    economy:    player.economy,
    // Extra fields: read from player data if they exist (Firestore may already
    // have them from a previous write); fall back to 0 if absent.
    balls:  (player as unknown as Record<string, number>).balls  ?? 0,
    fours:  (player as unknown as Record<string, number>).fours  ?? 0,
    sixes:  (player as unknown as Record<string, number>).sixes  ?? 0,
    overs:  (player as unknown as Record<string, number>).overs  ?? 0,
  }))

  const [errors,  setErrors]  = useState<FormErrors>({})
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const firstInputRef         = useRef<HTMLInputElement>(null)

  // Focus first input when modal opens
  useEffect(() => {
    if (isAdmin) firstInputRef.current?.focus()
  }, [isAdmin])

  // Close on Escape
  useEffect(() => {
    if (!isAdmin) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isAdmin, onClose])

  // ── Admin gate: render nothing for non-admins ────────────────────────────
  if (!isAdmin) return null

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleChange(key: keyof ExtendedStats, raw: string) {
    const parsed = raw === '' ? 0 : parseFloat(raw)
    setStats(prev => ({ ...prev, [key]: isNaN(parsed) ? 0 : parsed }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(stats)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    try {
      // Cast extended stats through PlayerStatsPayload.
      // updatePlayerStats() casts to Record<string,unknown> internally,
      // so balls/fours/sixes/overs reach Firestore even though they are
      // not in the PlayerStatsPayload TS type.
      await updatePlayerStats(player.id, stats as unknown as PlayerStatsPayload)
      setSaved(true)
      setTimeout(() => { onSuccess(); onClose() }, 800)
    } catch {
      setErrors({ matches: 'Failed to save. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className="esm-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="esm-title"
        className="esm-card"
      >
        {/* Header */}
        <div className="esm-header">
          <div className="esm-title-row">
            <span className="esm-title-icon">📊</span>
            <h2 id="esm-title" className="esm-title">Edit Stats</h2>
            <span className="esm-admin-badge">Admin</span>
          </div>
          <p className="esm-subtitle">
            Editing stats for <strong>{player.name}</strong>
          </p>
        </div>

        {/* Form */}
        <form className="esm-form" onSubmit={handleSubmit} noValidate>
          <div className="esm-grid">
            {FIELDS.map((field, idx) => {
              const val   = stats[field.key]
              const err   = errors[field.key]
              const isInt = field.step === 1

              return (
                <div key={field.key} className={`esm-field${err ? ' esm-field--error' : ''}`}>
                  <label className="esm-label" htmlFor={`esm-${field.key}`}>
                    <span className="esm-label-icon">{field.icon}</span>
                    {field.label}
                  </label>

                  <input
                    id={`esm-${field.key}`}
                    ref={idx === 0 ? firstInputRef : undefined}
                    type="number"
                    className={`esm-input${err ? ' esm-input--error' : ''}`}
                    value={val}
                    min={0}
                    step={field.step}
                    onChange={e => handleChange(field.key, e.target.value)}
                    onFocus={e => e.target.select()}
                    inputMode={isInt ? 'numeric' : 'decimal'}
                    aria-describedby={err ? `esm-err-${field.key}` : `esm-hint-${field.key}`}
                  />

                  {err
                    ? <span id={`esm-err-${field.key}`} className="esm-error" role="alert">{err}</span>
                    : <span id={`esm-hint-${field.key}`} className="esm-hint">{field.hint}</span>
                  }
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="esm-actions">
            <button
              type="button"
              className="team-btn team-btn--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              id="esm-save-btn"
              type="submit"
              className="team-btn team-btn--primary"
              disabled={saving || saved}
            >
              {saved ? (
                <>✅ Saved!</>
              ) : saving ? (
                <><span className="team-spinner" /> Saving…</>
              ) : (
                'Save Stats'
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{MODAL_STYLES}</style>
    </>
  )
}

export default EditPlayerStatsModal

// ── Scoped styles ─────────────────────────────────────────────────────────────

const MODAL_STYLES = `
  /* Backdrop */
  .esm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(2, 8, 23, 0.75);
    backdrop-filter: blur(6px);
    z-index: 200;
    animation: esmFadeIn 0.18s ease;
  }

  /* Modal card */
  .esm-card {
    position: fixed;
    inset: 0;
    margin: auto;
    z-index: 201;
    width: min(680px, calc(100vw - 32px));
    max-height: min(90vh, 860px);
    background: #0f172a;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 22px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,211,238,0.08);
    animation: esmSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1);
  }

  @keyframes esmFadeIn   { from { opacity:0 } to { opacity:1 } }
  @keyframes esmSlideUp  { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }

  /* Header */
  .esm-header {
    padding: 24px 28px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }
  .esm-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }
  .esm-title-icon { font-size: 20px; }
  .esm-title {
    font-size: 18px;
    font-weight: 800;
    color: #f1f5f9;
    margin: 0;
  }
  .esm-admin-badge {
    margin-left: auto;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #f59e0b;
    background: rgba(245,158,11,0.12);
    border: 1px solid rgba(245,158,11,0.3);
    border-radius: 999px;
    padding: 2px 10px;
  }
  .esm-subtitle {
    font-size: 13px;
    color: #64748b;
    margin: 0;
  }
  .esm-subtitle strong { color: #94a3b8; font-weight: 600; }

  /* Scrollable form body */
  .esm-form {
    flex: 1;
    overflow-y: auto;
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* 2-column grid */
  .esm-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px 20px;
  }
  @media (max-width: 500px) {
    .esm-grid { grid-template-columns: 1fr; }
  }

  /* Field */
  .esm-field { display: flex; flex-direction: column; gap: 4px; }

  /* Label */
  .esm-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    user-select: none;
  }
  .esm-label-icon { font-size: 14px; }

  /* Input */
  .esm-input {
    padding: 10px 14px;
    background: rgba(255,255,255,0.05);
    border: 1.5px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    color: #e2e8f0;
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
    width: 100%;
    box-sizing: border-box;
    -moz-appearance: textfield;
  }
  .esm-input::-webkit-inner-spin-button,
  .esm-input::-webkit-outer-spin-button { -webkit-appearance: none; }
  .esm-input:focus {
    border-color: #22d3ee;
    background: rgba(34,211,238,0.05);
    box-shadow: 0 0 0 3px rgba(34,211,238,0.1);
  }
  .esm-input--error {
    border-color: rgba(239,68,68,0.6);
    background: rgba(239,68,68,0.05);
  }
  .esm-input--error:focus {
    border-color: #ef4444;
    box-shadow: 0 0 0 3px rgba(239,68,68,0.12);
  }

  /* Error / hint text */
  .esm-error {
    font-size: 11px;
    color: #f87171;
    font-weight: 500;
  }
  .esm-hint {
    font-size: 11px;
    color: #334155;
  }

  /* Actions */
  .esm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }
`
