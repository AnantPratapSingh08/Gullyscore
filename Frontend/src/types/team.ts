// src/types/team.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared type definitions for Team and Player entities
// ─────────────────────────────────────────────────────────────────────────────

import type { Timestamp } from 'firebase/firestore'

export interface Team {
  id: string
  teamName: string
  logo: string          // emoji or URL
  captain: string       // display name
  createdBy: string     // uid
  inviteCode: string
  createdAt: Timestamp | null
  playerCount: number
}

export interface Player {
  id: string
  name: string
  role: 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper'
  teamId: string
  addedBy: string       // uid
  joinedAt: Timestamp | null
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
