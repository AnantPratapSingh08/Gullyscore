// src/components/match/MatchCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Compact match card for list views — shows teams, live scores, status.
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate } from 'react-router-dom'
import type { Match } from '../../types/match'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}

function StatusBadge({ status }: { status: Match['status'] }) {
  const label: Record<Match['status'], string> = {
    live:      'Live',
    upcoming:  'Upcoming',
    completed: 'Completed',
    abandoned: 'Abandoned',
  }
  return (
    <span className={`match-status match-status--${status}`}>
      <span className="match-status-dot" />
      {label[status]}
    </span>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: Match
  /** Called when owner clicks Edit / Delete (passed from parent) */
  isOwner?:  boolean
  onEdit?:   (match: Match) => void
  onDelete?: (match: Match) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MatchCard({ match, isOwner, onEdit, onDelete }: MatchCardProps) {
  const navigate = useNavigate()

  const hasScores = match.status === 'live' || match.status === 'completed'
  const team1Batting = match.tossWinnerId === match.team1Id && match.tossDecision === 'bat'
    || match.tossWinnerId === match.team2Id && match.tossDecision === 'field'

  function scoreStr(score: number, wickets: number, overs: number) {
    return `${score}/${wickets} (${overs.toFixed(1)})`
  }

  return (
    <div
      className={`match-card${match.status === 'live' ? ' match-card--live' : ''}`}
      onClick={() => navigate(`/matches/${match.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/matches/${match.id}`)}
      aria-label={`View match: ${match.title}`}
    >
      {/* Top row */}
      <div className="match-card-top">
        <StatusBadge status={match.status} />
        <span className="match-card-format">{match.format} · {match.totalOvers} ov</span>

        {/* Owner quick actions */}
        {isOwner && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }} onClick={e => e.stopPropagation()}>
            {onEdit && (
              <button
                className="team-icon-btn team-icon-btn--edit"
                style={{ padding: '4px 8px', fontSize: 12 }}
                onClick={() => onEdit(match)}
                title="Edit match"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                className="team-icon-btn team-icon-btn--delete"
                style={{ padding: '4px 8px', fontSize: 12 }}
                onClick={() => onDelete(match)}
                title="Delete match"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scoreboard */}
      <div className="match-card-scoreboard">
        {/* Team 1 */}
        <div className="match-card-team">
          <span className="match-card-team-logo">{match.team1Logo}</span>
          <span className="match-card-team-name">{match.team1Name}</span>
          {hasScores && (
            <span className={`match-card-team-score${!team1Batting && match.status === 'live' ? ' match-card-team-score--dim' : ''}`}>
              {scoreStr(match.team1Score, match.team1Wickets, match.team1Overs)}
            </span>
          )}
        </div>

        <span className="match-card-vs">VS</span>

        {/* Team 2 */}
        <div className="match-card-team match-card-team--right">
          <span className="match-card-team-logo">{match.team2Logo}</span>
          <span className="match-card-team-name">{match.team2Name}</span>
          {hasScores && (
            <span className={`match-card-team-score${team1Batting && match.status === 'live' ? ' match-card-team-score--dim' : ''}`}>
              {scoreStr(match.team2Score, match.team2Wickets, match.team2Overs)}
            </span>
          )}
        </div>
      </div>

      {/* Result */}
      {match.status === 'completed' && match.resultSummary && (
        <p className="match-card-result">🏆 {match.resultSummary}</p>
      )}

      {/* Footer */}
      <div className="match-card-footer">
        <span className="match-card-venue">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          {match.venue || 'TBD'}
        </span>
        <span className="match-card-date">{formatDate(match.scheduledAt)}</span>
      </div>
    </div>
  )
}

export default MatchCard
