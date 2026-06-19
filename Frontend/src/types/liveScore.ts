// src/types/liveScore.ts
// ─────────────────────────────────────────────────────────────────────────────
// Type definitions for the Live Scoring engine.
// ─────────────────────────────────────────────────────────────────────────────

import type { Timestamp } from 'firebase/firestore'

// ── Ball outcomes ─────────────────────────────────────────────────────────────

export type BallOutcome =
  | 'dot'       // 0 runs (legal delivery)
  | '1'         // 1 run
  | '2'         // 2 runs
  | '3'         // 3 runs
  | '4'         // boundary 4
  | '5'         // 5 runs (rare, overthrows)
  | '6'         // boundary 6
  | 'W'         // wicket
  | 'ro'        // run out
  | 'rh'        // retired hurt
  | 'wd'        // wide (+1, ball not counted)
  | 'nb'        // no-ball (+1, ball not counted)
  | 'lb'        // leg bye (runs + ball counted)
  | 'b'         // bye (runs + ball counted)

export type DismissalType =
  | 'bowled'
  | 'caught'
  | 'lbw'
  | 'run_out'
  | 'stumped'
  | 'hit_wicket'
  | 'retired'

// ── A single ball event ───────────────────────────────────────────────────────

export interface BallEvent {
  /** Firestore document ID */
  id: string

  /** Parent match ID */
  matchId: string

  /** Innings index: 0 = first innings, 1 = second innings */
  inningsIndex: 0 | 1

  /** Logical over number (0-indexed, for counting legal balls only) */
  overNumber: number

  /** Ball number within the current over (0-indexed, legal deliveries only) */
  ballInOver: number

  /** What happened on this delivery */
  outcome: BallOutcome

  /** Runs scored off the bat (excludes extras) */
  runsScored: number

  /** Extra runs on this delivery (wide/no-ball/bye/leg-bye) */
  extras: number

  /** Total runs credited to team score (runsScored + extras) */
  totalRuns: number

  /** Was this a legal delivery (counts toward over)? */
  isLegal: boolean

  /** Wicket details (only when outcome === 'W') */
  wicket?: {
    dismissalType:  DismissalType
    batsmanId:      string
    batsmanName:    string
    bowlerId:       string
    bowlerName:     string
    fielderId?:     string
    fielderName?:   string
    description:    string   // e.g. "c Sharma b Kumar"
  }

  /** Batter on strike when ball was bowled */
  strikerId:    string
  strikerName:  string

  /** Non-striker batter */
  nonStrikerId:   string
  nonStrikerName: string

  /** Bowler delivering the ball */
  bowlerId:   string
  bowlerName: string

  /**
   * Monotonic sequence number: Date.now() * 1000 + counter.
   * Used for ordering instead of serverTimestamp() to avoid
   * the race condition where recompute runs before the server
   * timestamp is resolved.
   */
  seq: number

  /** Server timestamp */
  createdAt: Timestamp | null
}

// ── Per-batter live scorecard entry ──────────────────────────────────────────

export interface LiveBatterEntry {
  playerId:   string
  playerName: string
  runs:       number
  balls:      number
  fours:      number
  sixes:      number
  isOut:      boolean
  dismissal:  string
  isOnStrike: boolean
}

// ── Per-bowler live scorecard entry ──────────────────────────────────────────

export interface LiveBowlerEntry {
  playerId:   string
  playerName: string
  overs:      number      // legal deliveries as decimal e.g. 3.4
  balls:      number      // legal deliveries raw count
  runs:       number
  wickets:    number
  maidens:    number
  wides:      number
  noBalls:    number
  isCurrentBowler: boolean
}

// ── Live innings state ────────────────────────────────────────────────────────

export interface LiveInningsState {
  battingTeamId:    string
  battingTeamName:  string
  bowlingTeamId:    string
  bowlingTeamName:  string

  runs:           number
  wickets:        number
  /** Legal deliveries (used for over calculation) */
  legalBalls:     number
  /** Overs as decimal (e.g. 3.4 = 3 overs 4 balls) */
  oversDecimal:   number

  extras:         number
  wides:          number
  noBalls:        number
  byes:           number
  legByes:        number

  /** This innings' target (set after first innings for batting team) */
  target?: number

  /** Runs required to win */
  runsRequired?: number

  /** Legal balls remaining in match */
  ballsRemaining?: number

  /** Current Required Run Rate */
  requiredRunRate?: number

  /** Current Run Rate */
  currentRunRate:   number

  /** Current partnership runs and balls */
  partnership: { runs: number; balls: number }

  /** Projected final score based on current CRR */
  projectedScore: number

  batters:  LiveBatterEntry[]
  bowlers:  LiveBowlerEntry[]

  /** Ball events in the current over (for over-by-over display) */
  currentOverEvents: BallEvent[]

  /** Is this innings complete? */
  isComplete: boolean
}

// ── Current game state stored in Firestore ────────────────────────────────────

export interface LiveGameState {
  /** Firestore document ID = matchId */
  matchId: string

  /** Current innings (0 = first, 1 = second) */
  currentInnings: 0 | 1

  /** Innings 1 state */
  innings1: LiveInningsState

  /** Innings 2 state (populated when first innings ends) */
  innings2: LiveInningsState | null

  /** Current striker player ID */
  strikerId:    string
  strikerName:  string

  /** Current non-striker player ID */
  nonStrikerId:   string
  nonStrikerName: string

  /** Current bowler player ID */
  bowlerId:   string
  bowlerName: string

  /** Is the game in progress? */
  isActive: boolean

  /** Server timestamp of last update */
  lastUpdated: Timestamp | null

  // ── Initial players tracking (to preserve states when no events exist) ──
  innings1InitStrikerId?: string
  innings1InitStrikerName?: string
  innings1InitNonStrikerId?: string
  innings1InitNonStrikerName?: string
  innings1InitBowlerId?: string
  innings1InitBowlerName?: string

  innings2InitStrikerId?: string
  innings2InitStrikerName?: string
  innings2InitNonStrikerId?: string
  innings2InitNonStrikerName?: string
  innings2InitBowlerId?: string
  innings2InitBowlerName?: string
}

// ── Write payload for initialising a live game ────────────────────────────────

export type LiveGameInitPayload = {
  matchId:          string
  currentInnings:   0
  innings1: Pick<LiveInningsState,
    | 'battingTeamId' | 'battingTeamName'
    | 'bowlingTeamId' | 'bowlingTeamName'
  >
  strikerId:        string
  strikerName:      string
  nonStrikerId:     string
  nonStrikerName:   string
  bowlerId:         string
  bowlerName:       string
}

// ── Player option (for striker/bowler selectors) ──────────────────────────────

export interface PlayerOption {
  id:   string
  name: string
  role: string
}
