// src/services/tournamentService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Firestore CRUD for Tournament Management.
// All write operations are protected by adminId checks on the client.
// Firestore Security Rules (see src/utils/tournamentGuard.ts) are the
// authoritative enforcement layer.
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
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  Tournament,
  TournamentCreatePayload,
  TournamentUpdatePayload,
} from '../types/tournament'

// ── Collection ────────────────────────────────────────────────────────────────

const TOURNAMENTS = 'tournaments'

// ── Helper ────────────────────────────────────────────────────────────────────

function docToTournament(id: string, data: Record<string, unknown>): Tournament {
  return {
    id,
    name:        (data.name        as string) ?? '',
    description: (data.description as string) ?? '',
    format:      (data.format      as Tournament['format']) ?? 'League',
    venue:       (data.venue       as string) ?? '',
    startDate:   (data.startDate   as string) ?? '',
    endDate:     (data.endDate     as string) ?? '',
    maxTeams:    (data.maxTeams    as number) ?? 8,
    status:      (data.status      as Tournament['status']) ?? 'draft',
    adminId:     (data.adminId     as string) ?? '',
    adminName:   (data.adminName   as string) ?? '',
    teamIds:     (data.teamIds     as string[]) ?? [],
    matchIds:    (data.matchIds    as string[]) ?? [],
    prizePool:   (data.prizePool   as string) ?? '',
    logo:        (data.logo        as string) ?? '🏆',
    winnerId:    (data.winnerId    as string) ?? '',
    createdAt:   (data.createdAt   as Tournament['createdAt']) ?? null,
    updatedAt:   (data.updatedAt   as Tournament['updatedAt']) ?? null,
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Create a new tournament. The caller must be authenticated.
 * @returns  New Firestore document ID.
 */
export async function createTournament(
  payload: Omit<TournamentCreatePayload, 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, TOURNAMENTS), {
    ...payload,
    status:   'draft',
    teamIds:  [],
    matchIds: [],
    winnerId: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Fetch a single tournament. Returns null if not found. */
export async function getTournament(id: string): Promise<Tournament | null> {
  const snap = await getDoc(doc(db, TOURNAMENTS, id))
  if (!snap.exists()) return null
  return docToTournament(snap.id, snap.data() as Record<string, unknown>)
}

/** Fetch all tournaments (newest first). */
export async function getAllTournaments(): Promise<Tournament[]> {
  const snap = await getDocs(
    query(collection(db, TOURNAMENTS), orderBy('createdAt', 'desc'))
  )
  return snap.docs.map(d => docToTournament(d.id, d.data() as Record<string, unknown>))
}

/** Fetch tournaments where the user is admin. */
export async function getMyTournaments(uid: string): Promise<Tournament[]> {
  const snap = await getDocs(
    query(collection(db, TOURNAMENTS), where('adminId', '==', uid))
  )
  return snap.docs.map(d => docToTournament(d.id, d.data() as Record<string, unknown>))
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update tournament metadata.
 * Caller must verify adminId === user.uid before calling.
 */
export async function updateTournament(
  id: string,
  updates: TournamentUpdatePayload
): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, id), {
    ...(updates as Record<string, unknown>),
    updatedAt: serverTimestamp(),
  })
}

/** Convenience: change status only. */
export async function setTournamentStatus(
  id: string,
  status: Tournament['status']
): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, id), { status, updatedAt: serverTimestamp() })
}

/** Add a team to the tournament's teamIds array. */
export async function addTeamToTournament(
  tournamentId: string,
  teamId: string
): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, tournamentId), {
    teamIds:   arrayUnion(teamId),
    updatedAt: serverTimestamp(),
  })
}

/** Remove a team from the tournament's teamIds array. */
export async function removeTeamFromTournament(
  tournamentId: string,
  teamId: string
): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, tournamentId), {
    teamIds:   arrayRemove(teamId),
    updatedAt: serverTimestamp(),
  })
}

/** Add a match to the tournament's matchIds array. */
export async function addMatchToTournament(
  tournamentId: string,
  matchId: string
): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, tournamentId), {
    matchIds:  arrayUnion(matchId),
    updatedAt: serverTimestamp(),
  })
}

/** Remove a match from the tournament's matchIds array. */
export async function removeMatchFromTournament(
  tournamentId: string,
  matchId: string
): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, tournamentId), {
    matchIds:  arrayRemove(matchId),
    updatedAt: serverTimestamp(),
  })
}

/** Declare a winner and complete the tournament. */
export async function declareTournamentWinner(
  id: string,
  winnerId: string
): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, id), {
    winnerId,
    status:    'completed',
    updatedAt: serverTimestamp(),
  })
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Delete a tournament document.
 * Caller must verify adminId === user.uid before calling.
 */
export async function deleteTournament(id: string): Promise<void> {
  await deleteDoc(doc(db, TOURNAMENTS, id))
}

// ── Real-time subscriptions ───────────────────────────────────────────────────

/** Subscribe to all tournaments (real-time). */
export function subscribeToAllTournaments(
  callback: (tournaments: Tournament[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, TOURNAMENTS), orderBy('createdAt', 'desc')),
    snap => callback(
      snap.docs.map(d => docToTournament(d.id, d.data() as Record<string, unknown>))
    )
  )
}

/** Subscribe to a single tournament (real-time). */
export function subscribeToTournament(
  id: string,
  callback: (tournament: Tournament | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, TOURNAMENTS, id), snap => {
    if (!snap.exists()) { callback(null); return }
    callback(docToTournament(snap.id, snap.data() as Record<string, unknown>))
  })
}

/** Subscribe to tournaments where the user is admin (real-time). */
export function subscribeToMyTournaments(
  uid: string,
  callback: (tournaments: Tournament[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, TOURNAMENTS), where('adminId', '==', uid)),
    snap => callback(
      snap.docs.map(d => docToTournament(d.id, d.data() as Record<string, unknown>))
    )
  )
}
