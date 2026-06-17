// src/services/tournamentService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Firestore CRUD for Tournament Management — with private code-based access.
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
  arrayUnion, arrayRemove, onSnapshot, type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  Tournament, TournamentCreatePayload, TournamentUpdatePayload,
  TournamentAwards, PointsTableEntry,
} from '../types/tournament'

const TOURNAMENTS = 'tournaments'

// ── Code generator ─────────────────────────────────────────────────────────────

/** Generate a random 6-character alphanumeric tournament code (uppercase). */
export function generateTournamentCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// ── Helper ────────────────────────────────────────────────────────────────────

function docToTournament(id: string, data: Record<string, unknown>): Tournament {
  return {
    id,
    name:           (data.name           as string) ?? '',
    description:    (data.description    as string) ?? '',
    format:         (data.format         as Tournament['format']) ?? 'League',
    venue:          (data.venue          as string) ?? '',
    startDate:      (data.startDate      as string) ?? '',
    endDate:        (data.endDate        as string) ?? '',
    maxTeams:       (data.maxTeams       as number) ?? 8,
    status:         (data.status         as Tournament['status']) ?? 'draft',
    tournamentCode: (data.tournamentCode as string) ?? '',
    adminId:        (data.adminId        as string) ?? '',
    adminName:      (data.adminName      as string) ?? '',
    teamIds:        (data.teamIds        as string[]) ?? [],
    matchIds:       (data.matchIds       as string[]) ?? [],
    prizePool:      (data.prizePool      as string) ?? '',
    logo:           (data.logo           as string) ?? '🏆',
    winnerId:       (data.winnerId       as string) ?? '',
    pointsTable:    (data.pointsTable    as PointsTableEntry[]) ?? [],
    awards:         (data.awards         as TournamentAwards) ?? {},
    createdAt:      (data.createdAt      as Tournament['createdAt']) ?? null,
    updatedAt:      (data.updatedAt      as Tournament['updatedAt']) ?? null,
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

/** Create a tournament — auto-generates a 6-char code. Returns new doc ID. */
export async function createTournament(
  payload: Omit<TournamentCreatePayload, 'createdAt' | 'updatedAt' | 'tournamentCode'>
): Promise<{ id: string; code: string }> {
  const code = generateTournamentCode()
  const ref = await addDoc(collection(db, TOURNAMENTS), {
    ...payload,
    tournamentCode: code,
    status:      'draft',
    teamIds:     [],
    matchIds:    [],
    winnerId:    '',
    pointsTable: [],
    awards:      {},
    createdAt:   serverTimestamp(),
    updatedAt:   serverTimestamp(),
  })
  return { id: ref.id, code }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getTournament(id: string): Promise<Tournament | null> {
  const snap = await getDoc(doc(db, TOURNAMENTS, id))
  if (!snap.exists()) return null
  return docToTournament(snap.id, snap.data() as Record<string, unknown>)
}

/** Find a tournament by its 6-char code — returns null if not found. */
export async function getTournamentByCode(code: string): Promise<Tournament | null> {
  const snap = await getDocs(
    query(collection(db, TOURNAMENTS), where('tournamentCode', '==', code.toUpperCase()))
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return docToTournament(d.id, d.data() as Record<string, unknown>)
}

export async function getMyTournaments(uid: string): Promise<Tournament[]> {
  const snap = await getDocs(
    query(collection(db, TOURNAMENTS), where('adminId', '==', uid))
  )
  return snap.docs.map(d => docToTournament(d.id, d.data() as Record<string, unknown>))
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateTournament(id: string, updates: TournamentUpdatePayload): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, id), {
    ...(updates as Record<string, unknown>),
    updatedAt: serverTimestamp(),
  })
}

export async function setTournamentStatus(id: string, status: Tournament['status']): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, id), { status, updatedAt: serverTimestamp() })
}

export async function addTeamToTournament(tournamentId: string, teamId: string): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, tournamentId), {
    teamIds: arrayUnion(teamId), updatedAt: serverTimestamp(),
  })
}

export async function removeTeamFromTournament(tournamentId: string, teamId: string): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, tournamentId), {
    teamIds: arrayRemove(teamId), updatedAt: serverTimestamp(),
  })
}

export async function addMatchToTournament(tournamentId: string, matchId: string): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, tournamentId), {
    matchIds: arrayUnion(matchId), updatedAt: serverTimestamp(),
  })
}

export async function removeMatchFromTournament(tournamentId: string, matchId: string): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, tournamentId), {
    matchIds: arrayRemove(matchId), updatedAt: serverTimestamp(),
  })
}

export async function declareTournamentWinner(id: string, winnerId: string): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, id), {
    winnerId, status: 'completed', updatedAt: serverTimestamp(),
  })
}

export async function updatePointsTable(id: string, pointsTable: PointsTableEntry[]): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, id), { pointsTable, updatedAt: serverTimestamp() })
}

export async function updateTournamentAwards(id: string, awards: TournamentAwards): Promise<void> {
  await updateDoc(doc(db, TOURNAMENTS, id), { awards, updatedAt: serverTimestamp() })
}

export async function deleteTournament(id: string): Promise<void> {
  await deleteDoc(doc(db, TOURNAMENTS, id))
}

// ── Real-time subscriptions ───────────────────────────────────────────────────

export function subscribeToAllTournaments(
  callback: (tournaments: Tournament[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, TOURNAMENTS), orderBy('createdAt', 'desc')),
    snap => callback(snap.docs.map(d => docToTournament(d.id, d.data() as Record<string, unknown>)))
  )
}

export function subscribeToTournament(
  id: string,
  callback: (tournament: Tournament | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, TOURNAMENTS, id), snap => {
    if (!snap.exists()) { callback(null); return }
    callback(docToTournament(snap.id, snap.data() as Record<string, unknown>))
  })
}

export function subscribeToMyTournaments(
  uid: string,
  callback: (tournaments: Tournament[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, TOURNAMENTS), where('adminId', '==', uid)),
    snap => callback(snap.docs.map(d => docToTournament(d.id, d.data() as Record<string, unknown>)))
  )
}
