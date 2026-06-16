// src/types/tournament.ts
// ─────────────────────────────────────────────────────────────────────────────
// Type definitions for the Tournament Admin module.
// ─────────────────────────────────────────────────────────────────────────────

import type { Timestamp } from 'firebase/firestore'

// ── Status ────────────────────────────────────────────────────────────────────

export type TournamentStatus =
  | 'draft'       // Created, not yet published
  | 'registration'// Open for team/player registration
  | 'active'      // Matches being played
  | 'completed'   // All matches done, winner declared
  | 'cancelled'

export type TournamentFormat =
  | 'League'          // Round-robin
  | 'Knockout'        // Single-elimination
  | 'Double Knockout' // Double-elimination
  | 'League + Knockout'
  | 'Custom'

// ── Core entity ───────────────────────────────────────────────────────────────

export interface Tournament {
  /** Firestore document ID */
  id: string

  /** Tournament name */
  name: string

  /** Short description */
  description: string

  /** Tournament format */
  format: TournamentFormat

  /** Venue / location */
  venue: string

  /** Start date (ISO string) */
  startDate: string

  /** End date (ISO string) */
  endDate: string

  /** Maximum number of teams allowed */
  maxTeams: number

  /** Current status */
  status: TournamentStatus

  /** UID of the tournament admin (the creator) */
  adminId: string

  /** Display name of admin */
  adminName: string

  /** IDs of teams participating in this tournament */
  teamIds: string[]

  /** IDs of matches in this tournament */
  matchIds: string[]

  /** Prize / description of prize pool */
  prizePool: string

  /** Logo / banner emoji */
  logo: string

  /** Winner team ID (set when completed) */
  winnerId: string

  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

// ── Write payloads ────────────────────────────────────────────────────────────

export type TournamentCreatePayload = Omit<Tournament,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'status'
  | 'teamIds'
  | 'matchIds'
  | 'winnerId'
> & {
  createdAt: unknown
  updatedAt: unknown
}

export type TournamentUpdatePayload = Partial<
  Pick<Tournament,
    | 'name' | 'description' | 'format' | 'venue'
    | 'startDate' | 'endDate' | 'maxTeams'
    | 'status' | 'prizePool' | 'logo'
    | 'teamIds' | 'matchIds' | 'winnerId'
  >
>

// ── Role ──────────────────────────────────────────────────────────────────────

/** Result of a role check — returned by the guard helpers */
export interface TournamentRoleCheck {
  isAdmin:  boolean
  isMember: boolean // member = team in tournament, player read-only
}
