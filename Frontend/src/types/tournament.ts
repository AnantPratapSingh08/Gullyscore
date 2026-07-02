// src/types/tournament.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tournament types — with private code-based access control system.
// ─────────────────────────────────────────────────────────────────────────────

import type { Timestamp } from 'firebase/firestore'

export type TournamentStatus =
  | 'draft'
  | 'registration'
  | 'active'
  | 'completed'
  | 'cancelled'

export type TournamentFormat =
  | 'League'
  | 'Knockout'
  | 'Double Knockout'
  | 'League + Knockout'
  | 'Custom'

// ── Points table entry ────────────────────────────────────────────────────────

export interface PointsTableEntry {
  teamId:   string
  teamName: string
  teamLogo: string
  played:   number
  won:      number
  lost:      number
  tied:     number
  nr:       number   // No Result
  nrr:      number   // Net Run Rate
  points:   number
  form?:    ('W' | 'L' | 'T' | 'NR')[] // Last 5 matches form (W = Won, L = Lost, T = Tied, NR = No Result)
}

// ── Tournament Awards ─────────────────────────────────────────────────────────

export interface TournamentAwards {
  orangeCap?:       { playerId: string; playerName: string; runs: number }
  purpleCap?:       { playerId: string; playerName: string; wickets: number }
  bestFielder?:     { playerId: string; playerName: string; dismissals: number }
  playerOfTournament?: { playerId: string; playerName: string }
  bestEconomy?:     { playerId: string; playerName: string; economy: number }
  highestStrikeRate?: { playerId: string; playerName: string; strikeRate: number }
}

// ── Core entity ───────────────────────────────────────────────────────────────

export interface Tournament {
  id:          string
  name:        string
  description: string
  format:      TournamentFormat
  venue:       string
  startDate:   string
  endDate:     string
  maxTeams:    number
  status:      TournamentStatus

  /** 6-character uppercase code for private access — e.g. "ABC123" */
  tournamentCode: string

  /** UID of the tournament owner/admin */
  adminId:   string
  adminName: string

  teamIds:  string[]
  matchIds: string[]

  prizePool: string
  logo:      string
  winnerId:  string

  /** Points table (updated after each match) */
  pointsTable: PointsTableEntry[]

  /** Tournament awards */
  awards: TournamentAwards

  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

// ── Write payloads ────────────────────────────────────────────────────────────

export type TournamentCreatePayload = Omit<Tournament,
  | 'id' | 'createdAt' | 'updatedAt'
  | 'status' | 'teamIds' | 'matchIds' | 'winnerId'
  | 'pointsTable' | 'awards'
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
    | 'pointsTable' | 'awards'
  >
>

export interface TournamentRoleCheck {
  isAdmin:  boolean
  isMember: boolean
}
