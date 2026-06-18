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
import { getCompletedMatchesByTournament } from './matchService'

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

// ── Auto-update points table + NRR ────────────────────────────────────────────

/**
 * Recalculates the full points table for a tournament using all completed
 * matches, including correct NRR calculation.
 *
 * Call this after every match completes. It is idempotent.
 *
 * NRR = (Total runs scored / Total overs faced) - (Total runs conceded / Total overs bowled)
 */
export async function autoUpdatePointsTable(tournamentId: string): Promise<void> {
  const [tournSnap, matches] = await Promise.all([
    getDoc(doc(db, TOURNAMENTS, tournamentId)),
    getCompletedMatchesByTournament(tournamentId),
  ])

  if (!tournSnap.exists()) return
  const tournament = docToTournament(tournSnap.id, tournSnap.data() as Record<string, unknown>)

  // Gather all team IDs participating in this tournament
  const allTeamIds = new Set<string>(tournament.teamIds)

  // Accumulate per-team stats from completed matches
  interface TeamAcc {
    teamId:     string
    teamName:   string
    teamLogo:   string
    played:     number
    won:        number
    lost:       number
    tied:       number
    // For NRR: total runs scored, total overs faced (as decimal balls/6)
    runsScored:   number
    oversPlayed:  number  // balls faced / 6 (float)
    runsConceded: number
    oversBowled:  number  // balls bowled / 6 (float)
    points: number
  }

  const acc = new Map<string, TeamAcc>()

  const getOrCreate = (teamId: string, teamName: string, teamLogo: string): TeamAcc => {
    if (!acc.has(teamId)) {
      acc.set(teamId, {
        teamId, teamName, teamLogo,
        played: 0, won: 0, lost: 0, tied: 0,
        runsScored: 0, oversPlayed: 0,
        runsConceded: 0, oversBowled: 0,
        points: 0,
      })
    }
    return acc.get(teamId)!
  }

  // Helper: overs decimal (e.g. 18.3) → actual balls for NRR
  const oversToFloat = (ov: number): number => {
    const full = Math.floor(ov)
    const partial = (ov - full) * 10  // e.g. 18.3 → 0.3 * 10 = 3 balls
    return full + partial / 6          // convert partial balls to fraction of an over
  }

  for (const match of matches) {
    if (match.status !== 'completed') continue

    const t1 = getOrCreate(match.team1Id, match.team1Name, match.team1Logo)
    const t2 = getOrCreate(match.team2Id, match.team2Name, match.team2Logo)

    t1.played++
    t2.played++

    // Runs and overs for NRR
    const t1Overs = oversToFloat(match.team1Overs)
    const t2Overs = oversToFloat(match.team2Overs)

    t1.runsScored   += match.team1Score
    t1.oversPlayed  += t1Overs > 0 ? t1Overs : match.totalOvers  // if 0, full overs (all out)
    t1.runsConceded += match.team2Score
    t1.oversBowled  += t2Overs > 0 ? t2Overs : match.totalOvers

    t2.runsScored   += match.team2Score
    t2.oversPlayed  += t2Overs > 0 ? t2Overs : match.totalOvers
    t2.runsConceded += match.team1Score
    t2.oversBowled  += t1Overs > 0 ? t1Overs : match.totalOvers

    // Results
    if (match.result === 'team1') {
      t1.won++; t1.points += 2
      t2.lost++
    } else if (match.result === 'team2') {
      t2.won++; t2.points += 2
      t1.lost++
    } else if (match.result === 'tie') {
      t1.tied++; t1.points += 1
      t2.tied++; t2.points += 1
    }
  }

  // Add teams that haven't played yet (0 stats)
  allTeamIds.forEach(id => {
    if (!acc.has(id)) {
      acc.set(id, {
        teamId: id, teamName: '', teamLogo: '🏏',
        played: 0, won: 0, lost: 0, tied: 0,
        runsScored: 0, oversPlayed: 0,
        runsConceded: 0, oversBowled: 0,
        points: 0,
      })
    }
  })

  // Build points table with NRR
  const pointsTable: PointsTableEntry[] = Array.from(acc.values()).map(t => {
    const rrFor     = t.oversPlayed  > 0 ? t.runsScored   / t.oversPlayed  : 0
    const rrAgainst = t.oversBowled  > 0 ? t.runsConceded / t.oversBowled  : 0
    const nrr = parseFloat((rrFor - rrAgainst).toFixed(3))
    return {
      teamId:   t.teamId,
      teamName: t.teamName,
      teamLogo: t.teamLogo,
      played:   t.played,
      won:      t.won,
      lost:     t.lost,
      tied:     t.tied,
      nrr,
      points:   t.points,
    }
  })

  // Sort: points desc, then NRR desc
  pointsTable.sort((a, b) => b.points - a.points || b.nrr - a.nrr)

  await updateDoc(doc(db, TOURNAMENTS, tournamentId), {
    pointsTable,
    updatedAt: serverTimestamp(),
  })

  console.log('[tournament] autoUpdatePointsTable ✓ —', pointsTable.length, 'teams')
}

