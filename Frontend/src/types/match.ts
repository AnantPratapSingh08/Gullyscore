// src/types/match.ts
// ─────────────────────────────────────────────────────────────────────────────
// Type definitions for the Match Management module.
// ─────────────────────────────────────────────────────────────────────────────

import type { Timestamp } from 'firebase/firestore'

// ── Enumerations ──────────────────────────────────────────────────────────────

export type MatchStatus =
  | 'upcoming'    // Scheduled, not started
  | 'live'        // In progress
  | 'completed'   // Finished, result declared
  | 'abandoned'   // Cancelled before play started
  | 'no_result'   // Rain/DLS — match started but no result
  | 'cancelled'   // Removed from fixture list
  | 'rain_delay'  // Temporary suspension, resumes later
  | 'super_over'  // Tied — super over in progress

export type MatchFormat =
  | 'T20'
  | 'ODI'
  | 'Test'
  | 'T10'
  | 'Custom'

export type TossDecision = 'bat' | 'field'

export type MatchResult =
  | 'team1'       // Team 1 won
  | 'team2'       // Team 2 won
  | 'tie'
  | 'no_result'

// ── Innings scorecard ─────────────────────────────────────────────────────────

export interface BatterEntry {
  playerId:   string
  playerName: string
  runs:       number
  balls:      number
  fours:      number
  sixes:      number
  isOut:      boolean
  dismissal:  string  // e.g. "c Sharma b Kumar"
}

export interface BowlerEntry {
  playerId:   string
  playerName: string
  overs:      number
  maidens:    number
  runs:       number
  wickets:    number
}

export interface Innings {
  battingTeamId:  string
  bowlingTeamId:  string
  runs:           number
  wickets:        number
  overs:          number
  extras:         number
  batters:        BatterEntry[]
  bowlers:        BowlerEntry[]
  oversDecimal?:  number
  wides?:         number
  noBalls?:       number
  byes?:          number
  legByes?:       number
}

// ── Core entity ───────────────────────────────────────────────────────────────

export interface Match {
  /** Firestore document ID */
  id: string

  /** Human-readable title e.g. "Warriors vs Thunder" */
  title: string

  /** Match format */
  format: MatchFormat

  /** Total overs per side (relevant for limited-overs) */
  totalOvers: number

  /** Venue / ground name */
  venue: string

  /** Scheduled date-time (ISO string stored in Firestore) */
  scheduledAt: string

  /** Current status */
  status: MatchStatus

  // ── Teams ────────────────────────────────────────────────────────────────

  team1Id:   string
  team1Name: string
  team1Logo: string

  team2Id:   string
  team2Name: string
  team2Logo: string

  // ── Toss ────────────────────────────────────────────────────────────────

  /** ID of team that won the toss */
  tossWinnerId:  string
  tossDecision:  TossDecision | ''

  // ── Score summary (denormalised for list views) ───────────────────────────

  team1Score:   number
  team1Wickets: number
  team1Overs:   number

  team2Score:   number
  team2Wickets: number
  team2Overs:   number

  // ── Result ───────────────────────────────────────────────────────────────

  result:        MatchResult | ''
  resultSummary: string   // e.g. "Warriors won by 24 runs"
  playerOfMatch?: string

  // ── Detailed innings (optional, populated during/after live scoring) ──────

  innings1?: Innings
  innings2?: Innings

  // ── Playing XI ────────────────────────────────────────────────────────────
  /** Player IDs declared in team1's Playing XI (up to 11) */
  team1PlayingXI?: string[]
  /** Player IDs declared in team2's Playing XI (up to 11) */
  team2PlayingXI?: string[]

  // ── Tournament linkage ────────────────────────────────────────────────────

  /** Tournament this match belongs to (empty string if standalone) */
  tournamentId: string

  // ── Metadata ─────────────────────────────────────────────────────────────

  createdAt: Timestamp | null
  createdBy: string   // uid
}

// ── Write payloads ────────────────────────────────────────────────────────────

export type MatchCreatePayload = Omit<Match,
  | 'id'
  | 'createdAt'
  | 'status'
  | 'team1Score' | 'team1Wickets' | 'team1Overs'
  | 'team2Score' | 'team2Wickets' | 'team2Overs'
  | 'result' | 'resultSummary'
  | 'tossWinnerId' | 'tossDecision'
  | 'innings1' | 'innings2'
> & {
  createdAt: unknown  // serverTimestamp()
}

export type MatchUpdatePayload = Partial<
  Pick<Match,
    | 'title' | 'format' | 'totalOvers' | 'venue' | 'scheduledAt'
    | 'status'
    | 'team1Id' | 'team1Name' | 'team1Logo'
    | 'team2Id' | 'team2Name' | 'team2Logo'
    | 'tossWinnerId' | 'tossDecision'
    | 'team1Score' | 'team1Wickets' | 'team1Overs'
    | 'team2Score' | 'team2Wickets' | 'team2Overs'
    | 'result' | 'resultSummary' | 'playerOfMatch'
    | 'innings1' | 'innings2'
    | 'team1PlayingXI' | 'team2PlayingXI'
  >
>
