// src/types/team.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared type definitions for Team and Player entities
// ─────────────────────────────────────────────────────────────────────────────

import type { Timestamp } from 'firebase/firestore'

export interface Team {
  id: string
  teamName: string
  logo: string          // emoji
  logoUrl?: string      // Firebase Storage URL (optional, overrides emoji)
  captain: string       // display name (legacy)
  captainId?: string    // player ID of captain
  viceCaptainId?: string
  coachName?: string
  managerName?: string
  bio?: string
  createdBy: string     // uid
  inviteCode: string
  createdAt: Timestamp | null
  playerCount: number
  tournamentId?: string
  /** Player IDs declared in the Playing XI for this team */
  playingXI?: string[]
}

export interface Player {
  id: string
  name: string
  role: 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper'
  teamId: string
  tournamentId?: string
  addedBy: string       // uid
  joinedAt: Timestamp | null
  jerseyNumber?: number
  battingStyle?: 'Right-Handed' | 'Left-Handed'
  bowlingStyle?: string
  avatarUrl?: string    // Firebase Storage URL for player photo
  stats: {
    matches: number
    runs: number
    wickets: number
    catches: number
  }
}

// Firestore write shape (omit id, use FieldValue for timestamps)
export type TeamCreatePayload = Omit<Team, 'id' | 'createdAt'> & {
  createdAt: unknown  // serverTimestamp()
}

export type PlayerCreatePayload = Omit<Player, 'id' | 'joinedAt'> & {
  joinedAt: unknown    // serverTimestamp()
}

// Toast types (used across team module)
export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}
