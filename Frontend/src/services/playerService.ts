// src/services/playerService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Firestore CRUD + stats operations for Player Management.
// Pure async functions — no React state, no side-effects beyond Firestore.
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Player, PlayerCreatePayload, PlayerUpdatePayload, PlayerStatsPayload } from '../types/player'

// ── Collection reference ──────────────────────────────────────────────────────

const PLAYERS = 'players'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a raw Firestore document snapshot to a typed Player */
function docToPlayer(id: string, data: Record<string, unknown>): Player {
  return {
    id,
    name:         (data.name         as string)          ?? '',
    email:        (data.email        as string)          ?? '',
    phone:        (data.phone        as string)          ?? '',
    teamId:       (data.teamId       as string)          ?? '',
    jerseyNumber: (data.jerseyNumber as number)          ?? 0,
    role:         (data.role         as Player['role'])  ?? 'Batsman',
    battingStyle: (data.battingStyle as Player['battingStyle']) ?? 'Right-Handed',
    bowlingStyle: (data.bowlingStyle as Player['bowlingStyle']) ?? 'N/A',
    matches:      (data.matches      as number)          ?? 0,
    runs:         (data.runs         as number)          ?? 0,
    wickets:      (data.wickets      as number)          ?? 0,
    average:      (data.average      as number)          ?? 0,
    strikeRate:   (data.strikeRate   as number)          ?? 0,
    economy:      (data.economy      as number)          ?? 0,
    createdAt:    (data.createdAt    as Player['createdAt']) ?? null,
    createdBy:    (data.createdBy    as string)          ?? '',
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Create a new player document in Firestore.
 *
 * @param payload  All player fields except `id` and `createdAt`.
 * @returns        The new Firestore document ID.
 *
 * @example
 * const playerId = await createPlayer({
 *   name: 'Rohit Sharma',
 *   email: '',
 *   phone: '',
 *   teamId: 'abc123',
 *   jerseyNumber: 45,
 *   role: 'Batsman',
 *   battingStyle: 'Right-Handed',
 *   bowlingStyle: 'N/A',
 *   matches: 0, runs: 0, wickets: 0,
 *   average: 0, strikeRate: 0, economy: 0,
 *   createdBy: uid,
 * })
 */
export async function createPlayer(
  payload: Omit<PlayerCreatePayload, 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, PLAYERS), {
    ...payload,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Fetch all players belonging to a specific team (one-time read).
 *
 * @param teamId  The Firestore team document ID.
 * @returns       Array of Player objects (empty array if none found).
 */
export async function getPlayersByTeam(teamId: string): Promise<Player[]> {
  const q = query(collection(db, PLAYERS), where('teamId', '==', teamId))
  const snap = await getDocs(q)
  return snap.docs.map(d => docToPlayer(d.id, d.data() as Record<string, unknown>))
}

/**
 * Fetch a single player by their document ID.
 *
 * @param playerId  The Firestore player document ID.
 * @returns         Player object, or `null` if not found.
 */
export async function getPlayer(playerId: string): Promise<Player | null> {
  const snap = await getDoc(doc(db, PLAYERS, playerId))
  if (!snap.exists()) return null
  return docToPlayer(snap.id, snap.data() as Record<string, unknown>)
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update non-stats fields on an existing player.
 * Accepts a partial set of updatable profile fields.
 *
 * @param playerId  The Firestore player document ID.
 * @param updates   Partial player profile fields to update.
 *
 * @example
 * await updatePlayer(playerId, { jerseyNumber: 7, role: 'All-Rounder' })
 */
export async function updatePlayer(
  playerId: string,
  updates: PlayerUpdatePayload
): Promise<void> {
  await updateDoc(doc(db, PLAYERS, playerId), updates as Record<string, unknown>)
}

/**
 * Update only the statistical fields of a player.
 * Keeps profile fields (name, role, etc.) untouched.
 *
 * @param playerId  The Firestore player document ID.
 * @param stats     Partial stats fields to update.
 *
 * @example
 * await updatePlayerStats(playerId, { matches: 10, runs: 320, average: 32.0 })
 */
export async function updatePlayerStats(
  playerId: string,
  stats: PlayerStatsPayload
): Promise<void> {
  await updateDoc(doc(db, PLAYERS, playerId), stats as Record<string, unknown>)
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Permanently delete a player document from Firestore.
 *
 * @param playerId  The Firestore player document ID.
 *
 * @example
 * await deletePlayer(playerId)
 */
export async function deletePlayer(playerId: string): Promise<void> {
  await deleteDoc(doc(db, PLAYERS, playerId))
}
