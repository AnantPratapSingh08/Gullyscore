// src/types/player.ts
// ─────────────────────────────────────────────────────────────────────────────
// Full player type definitions — career stats, match history, profile.
// ─────────────────────────────────────────────────────────────────────────────

import type { Timestamp } from 'firebase/firestore'

// ── Enumerations ──────────────────────────────────────────────────────────────

export type PlayerRole =
  | 'Batsman'
  | 'Bowler'
  | 'All-Rounder'
  | 'Wicket-Keeper'

export type BattingStyle =
  | 'Right-Handed'
  | 'Left-Handed'

export type BowlingStyle =
  | 'Right-Arm Fast'
  | 'Right-Arm Medium'
  | 'Right-Arm Off-Spin'
  | 'Right-Arm Leg-Spin'
  | 'Left-Arm Fast'
  | 'Left-Arm Medium'
  | 'Left-Arm Orthodox'
  | 'Left-Arm Chinaman'
  | 'N/A'

export type MatchFormat = 'T20' | 'ODI' | 'Test' | 'T10' | 'Custom'

// ── Per-format batting stats ──────────────────────────────────────────────────

export interface BattingStats {
  matches:    number
  innings:    number
  notOuts:    number
  runs:       number
  highScore:  number
  average:    number
  strikeRate: number
  ballsFaced: number
  fours:      number
  sixes:      number
  fifties:    number
  hundreds:   number
  ducks:      number
}

// ── Per-format bowling stats ──────────────────────────────────────────────────

export interface BowlingStats {
  matches:        number
  innings:        number
  overs:          number
  balls:          number
  runsConceded:   number
  wickets:        number
  economy:        number
  average:        number
  strikeRate:     number
  bestFigures:    string   // e.g. "5/23"
  threeWickets:   number
  fiveWickets:    number
  tenWickets:     number
  maidens:        number
}

// ── Fielding stats ────────────────────────────────────────────────────────────

export interface FieldingStats {
  catches:           number
  runOuts:           number
  directRunOuts:     number
  assistedRunOuts:   number
  stumpings:         number
  droppedCatches:    number
}

// ── Per-match performance record ──────────────────────────────────────────────

export interface PlayerMatchRecord {
  matchId:      string
  matchTitle:   string
  tournamentId: string
  opponentName: string
  format:       MatchFormat
  date:         string
  result:       'won' | 'lost' | 'tie' | 'no_result'
  // Batting
  runs:         number
  balls:        number
  strikeRate:   number
  fours:        number
  sixes:        number
  isOut:        boolean
  dismissal:    string
  // Bowling
  overs:        number
  wickets:      number
  runsConceded: number
  economy:      number
  maidens:      number
  // Fielding
  catches:      number
  runOuts:      number
  stumpings:    number
}

// ── Core Player entity ────────────────────────────────────────────────────────

export interface Player {
  /** Firestore document ID */
  id: string

  /** Firebase Auth UID (if player linked to an account) */
  userId: string

  /** Full display name */
  name: string

  /** Contact email */
  email: string

  /** Contact phone */
  phone: string

  /** Short bio */
  bio: string

  /** Avatar URL or initials-based color */
  avatarUrl: string

  /** ID of the team this player belongs to */
  teamId: string

  /** ID of the tournament this player belongs to */
  tournamentId?: string

  /** Jersey / shirt number */
  jerseyNumber: number

  /** Primary playing role */
  role: PlayerRole

  /** Preferred batting style */
  battingStyle: BattingStyle

  /** Preferred bowling style */
  bowlingStyle: BowlingStyle

  // ── Aggregate career stats (all formats combined) ──────────────────────────
  matches:    number
  runs:       number
  wickets:    number
  average:    number
  strikeRate: number
  economy:    number

  // ── Per-format stats ───────────────────────────────────────────────────────
  batting:    BattingStats
  bowling:    BowlingStats
  fielding:   FieldingStats

  // T20-specific
  battingT20:  BattingStats
  bowlingT20:  BowlingStats

  // ODI-specific
  battingODI:  BattingStats
  bowlingODI:  BowlingStats

  // Test-specific
  battingTest: BattingStats
  bowlingTest: BowlingStats

  // ── Metadata ──────────────────────────────────────────────────────────────
  createdAt: Timestamp | null
  createdBy: string
}

// ── Empty stats helper ────────────────────────────────────────────────────────

export function emptyBattingStats(): BattingStats {
  return {
    matches: 0, innings: 0, notOuts: 0, runs: 0,
    highScore: 0, average: 0, strikeRate: 0, ballsFaced: 0,
    fours: 0, sixes: 0, fifties: 0, hundreds: 0, ducks: 0,
  }
}

export function emptyBowlingStats(): BowlingStats {
  return {
    matches: 0, innings: 0, overs: 0, balls: 0,
    runsConceded: 0, wickets: 0, economy: 0, average: 0,
    strikeRate: 0, bestFigures: '0/0', threeWickets: 0,
    fiveWickets: 0, tenWickets: 0, maidens: 0,
  }
}

export function emptyFieldingStats(): FieldingStats {
  return {
    catches: 0, runOuts: 0, directRunOuts: 0,
    assistedRunOuts: 0, stumpings: 0, droppedCatches: 0,
  }
}

// ── Write payloads ────────────────────────────────────────────────────────────

export type PlayerCreatePayload = Omit<Player, 'id' | 'createdAt'> & {
  createdAt: unknown
}

export type PlayerUpdatePayload = Partial<
  Pick<
    Player,
    | 'name' | 'email' | 'phone' | 'bio' | 'avatarUrl'
    | 'jerseyNumber' | 'role' | 'battingStyle' | 'bowlingStyle'
  >
>

export type PlayerStatsPayload = Partial<
  Pick<Player,
    | 'matches' | 'runs' | 'wickets' | 'average' | 'strikeRate' | 'economy'
    | 'batting' | 'bowling' | 'fielding'
    | 'battingT20' | 'bowlingT20'
    | 'battingODI' | 'bowlingODI'
    | 'battingTest' | 'bowlingTest'
  >
>
