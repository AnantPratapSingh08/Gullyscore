// src/types/player.ts
// ─────────────────────────────────────────────────────────────────────────────
// Type definitions for the Player Management module.
// Deliberately separate from team.ts to keep concerns isolated.
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

// ── Core entity ───────────────────────────────────────────────────────────────

export interface Player {
  /** Firestore document ID */
  id: string

  /** Full display name */
  name: string

  /** Contact email (optional) */
  email: string

  /** Contact phone number (optional) */
  phone: string

  /** ID of the team this player belongs to */
  teamId: string

  /** Jersey / shirt number */
  jerseyNumber: number

  /** Primary playing role */
  role: PlayerRole

  /** Preferred batting style */
  battingStyle: BattingStyle

  /** Preferred bowling style */
  bowlingStyle: BowlingStyle

  // ── Career statistics ──────────────────────────────────────────────────────

  /** Total matches played */
  matches: number

  /** Total runs scored */
  runs: number

  /** Total wickets taken */
  wickets: number

  /** Batting average (runs / dismissals) */
  average: number

  /** Batting strike rate (runs / balls × 100) */
  strikeRate: number

  /** Bowling economy rate (runs conceded / overs bowled) */
  economy: number

  // ── Metadata ──────────────────────────────────────────────────────────────

  /** Firestore server timestamp set on creation */
  createdAt: Timestamp | null

  /** UID of the user who created this player record */
  createdBy: string
}

// ── Write payloads ────────────────────────────────────────────────────────────

/** Shape used when writing a new player to Firestore (id and timestamp omitted) */
export type PlayerCreatePayload = Omit<Player, 'id' | 'createdAt'> & {
  createdAt: unknown // serverTimestamp() FieldValue
}

/** Fields that can be updated on an existing player */
export type PlayerUpdatePayload = Partial<
  Pick<
    Player,
    | 'name'
    | 'email'
    | 'phone'
    | 'jerseyNumber'
    | 'role'
    | 'battingStyle'
    | 'bowlingStyle'
  >
>

/** Stats-only update shape used by updatePlayerStats() */
export type PlayerStatsPayload = Partial<
  Pick<Player, 'matches' | 'runs' | 'wickets' | 'average' | 'strikeRate' | 'economy'>
>
