// src/services/matchService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Firestore CRUD for Match Management.
// Pure async functions — no React state touched here.
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
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  Match,
  MatchCreatePayload,
  MatchUpdatePayload,
} from '../types/match'

// ── Collection reference ──────────────────────────────────────────────────────

const MATCHES = 'matches'

// ── Helper: doc → Match ───────────────────────────────────────────────────────

function docToMatch(id: string, data: Record<string, unknown>): Match {
  return {
    id,
    title:           (data.title         as string) ?? '',
    format:          (data.format        as Match['format']) ?? 'T20',
    totalOvers:      (data.totalOvers    as number) ?? 20,
    venue:           (data.venue         as string) ?? '',
    scheduledAt:     (data.scheduledAt   as string) ?? '',
    status:          (data.status        as Match['status']) ?? 'upcoming',
    tournamentId:    (data.tournamentId  as string) ?? '',
    team1Id:         (data.team1Id       as string) ?? '',
    team1Name:       (data.team1Name     as string) ?? '',
    team1Logo:       (data.team1Logo     as string) ?? '🏏',
    team2Id:         (data.team2Id       as string) ?? '',
    team2Name:       (data.team2Name     as string) ?? '',
    team2Logo:       (data.team2Logo     as string) ?? '🏏',
    tossWinnerId:    (data.tossWinnerId  as string) ?? '',
    tossDecision:    (data.tossDecision  as Match['tossDecision']) ?? '',
    team1Score:      (data.team1Score    as number) ?? 0,
    team1Wickets:    (data.team1Wickets  as number) ?? 0,
    team1Overs:      (data.team1Overs    as number) ?? 0,
    team2Score:      (data.team2Score    as number) ?? 0,
    team2Wickets:    (data.team2Wickets  as number) ?? 0,
    team2Overs:      (data.team2Overs    as number) ?? 0,
    result:          (data.result        as Match['result']) ?? '',
    resultSummary:   (data.resultSummary as string) ?? '',
    playerOfMatch:   (data.playerOfMatch as string) ?? '',
    innings1:        (data.innings1      as Match['innings1']) ?? undefined,
    innings2:        (data.innings2      as Match['innings2']) ?? undefined,
    team1PlayingXI:  (data.team1PlayingXI as string[]) ?? [],
    team2PlayingXI:  (data.team2PlayingXI as string[]) ?? [],
    createdAt:       (data.createdAt     as Match['createdAt']) ?? null,
    createdBy:       (data.createdBy     as string) ?? '',
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Create a new match document.
 * @returns The new Firestore document ID.
 */
export async function createMatch(
  payload: Omit<MatchCreatePayload, 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, MATCHES), {
    ...payload,
    tournamentId:  payload.tournamentId ?? '',
    status:        'upcoming',
    tossWinnerId:  '',
    tossDecision:  '',
    team1Score:    0,
    team1Wickets:  0,
    team1Overs:    0,
    team2Score:    0,
    team2Wickets:  0,
    team2Overs:    0,
    result:        '',
    resultSummary: '',
    createdAt:     serverTimestamp(),
  })
  return ref.id
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Fetch a single match by ID. Returns null if not found. */
export async function getMatch(matchId: string): Promise<Match | null> {
  const snap = await getDoc(doc(db, MATCHES, matchId))
  if (!snap.exists()) return null
  return docToMatch(snap.id, snap.data() as Record<string, unknown>)
}

/** Fetch all matches (one-time). */
export async function getAllMatches(): Promise<Match[]> {
  const snap = await getDocs(
    query(collection(db, MATCHES), orderBy('scheduledAt', 'desc'))
  )
  return snap.docs.map(d => docToMatch(d.id, d.data() as Record<string, unknown>))
}

/** Fetch all matches involving a specific team. */
export async function getMatchesByTeam(teamId: string): Promise<Match[]> {
  const [q1, q2] = await Promise.all([
    getDocs(query(collection(db, MATCHES), where('team1Id', '==', teamId))),
    getDocs(query(collection(db, MATCHES), where('team2Id', '==', teamId))),
  ])
  const seen = new Set<string>()
  const results: Match[] = []
  ;[...q1.docs, ...q2.docs].forEach(d => {
    if (!seen.has(d.id)) {
      seen.add(d.id)
      results.push(docToMatch(d.id, d.data() as Record<string, unknown>))
    }
  })
  return results.sort((a, b) => (b.scheduledAt > a.scheduledAt ? 1 : -1))
}

/** Fetch matches created by a specific user. */
export async function getMatchesByUser(uid: string): Promise<Match[]> {
  const snap = await getDocs(
    query(
      collection(db, MATCHES),
      where('createdBy', '==', uid),
      orderBy('scheduledAt', 'desc')
    )
  )
  return snap.docs.map(d => docToMatch(d.id, d.data() as Record<string, unknown>))
}

// ── Update ────────────────────────────────────────────────────────────────────

/** Update metadata or scores on an existing match. */
export async function updateMatch(
  matchId: string,
  updates: MatchUpdatePayload
): Promise<void> {
  await updateDoc(doc(db, MATCHES, matchId), updates as Record<string, unknown>)
}

/** Convenience: start a match (status → 'live'). */
export async function startMatch(matchId: string): Promise<void> {
  await updateDoc(doc(db, MATCHES, matchId), { status: 'live' })
}

/** Convenience: complete a match with a result. */
export async function completeMatch(
  matchId: string,
  result: Match['result'],
  resultSummary: string,
  playerOfMatch?: string
): Promise<void> {
  await updateDoc(doc(db, MATCHES, matchId), {
    status: 'completed',
    result,
    resultSummary,
    playerOfMatch: playerOfMatch || '',
  })
}

/** Convenience: update the live score for one team. */
export async function updateScore(
  matchId: string,
  team: 1 | 2,
  score: number,
  wickets: number,
  overs: number
): Promise<void> {
  const prefix = team === 1 ? 'team1' : 'team2'
  await updateDoc(doc(db, MATCHES, matchId), {
    [`${prefix}Score`]:   score,
    [`${prefix}Wickets`]: wickets,
    [`${prefix}Overs`]:   overs,
  })
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Permanently delete a match document.
 * If the match was COMPLETED, automatically triggers:
 *  - Full player stat recalculation (Phase 3 engine)
 *  - Points table + NRR refresh
 * so all leaderboards update immediately without a manual refresh.
 */
export async function deleteMatch(matchId: string): Promise<void> {
  // Fetch the match first so we know its tournament and completion status
  const matchSnap = await getDoc(doc(db, MATCHES, matchId))
  const matchData = matchSnap.exists() ? matchSnap.data() as Record<string, unknown> : null
  const wasCompleted  = matchData?.status === 'completed'
  const tournamentId  = (matchData?.tournamentId as string) ?? ''

  // Delete the match document
  await deleteDoc(doc(db, MATCHES, matchId))

  // If it was a completed match, recalculate everything automatically
  if (wasCompleted && tournamentId) {
    try {
      const [{ recalculateAllPlayerStats }, { autoUpdatePointsTable }] = await Promise.all([
        import('./playerStatsService'),
        import('./tournamentService'),
      ])
      // Run both in parallel — they don't depend on each other
      await Promise.all([
        recalculateAllPlayerStats(tournamentId),
        autoUpdatePointsTable(tournamentId),
      ])
      console.log('[matchService] deleteMatch ✓ — recalculation triggered for tournament:', tournamentId)
    } catch (err) {
      console.error('[matchService] deleteMatch: recalculation failed (non-fatal):', err)
    }
  }
}

// ── Real-time subscriptions ───────────────────────────────────────────────────

/** Subscribe to all matches (real-time, newest first). */
export function subscribeToAllMatches(
  callback: (matches: Match[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, MATCHES), orderBy('scheduledAt', 'desc')),
    snap => callback(
      snap.docs.map(d => docToMatch(d.id, d.data() as Record<string, unknown>))
    ),
    error => {
      console.error('[subscribeToAllMatches] error:', error)
      callback([])
    }
  )
}

/** Subscribe to a single match (real-time). */
export function subscribeToMatch(
  matchId: string,
  callback: (match: Match | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, MATCHES, matchId),
    snap => {
      if (!snap.exists()) { callback(null); return }
      callback(docToMatch(snap.id, snap.data() as Record<string, unknown>))
    },
    error => {
      console.error('[subscribeToMatch] error:', error)
      callback(null)
    }
  )
}

/** Subscribe to live matches only. */
export function subscribeToLiveMatches(
  callback: (matches: Match[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, MATCHES), where('status', '==', 'live')),
    snap => callback(
      snap.docs.map(d => docToMatch(d.id, d.data() as Record<string, unknown>))
    ),
    error => {
      console.error('[subscribeToLiveMatches] error:', error)
      callback([])
    }
  )
}

/** Subscribe to all matches for a specific tournament (real-time). */
export function subscribeToMatchesByTournament(
  tournamentId: string,
  callback: (matches: Match[]) => void
): Unsubscribe {
  if (!tournamentId) {
    callback([])
    return () => {}
  }
  return onSnapshot(
    query(
      collection(db, MATCHES),
      where('tournamentId', '==', tournamentId),
      orderBy('scheduledAt', 'desc')
    ),
    snap => callback(
      snap.docs.map(d => docToMatch(d.id, d.data() as Record<string, unknown>))
    ),
    error => {
      console.error('[subscribeToMatchesByTournament] error:', error)
      callback([])
    }
  )
}

/** Get all completed matches for a tournament (one-time read for NRR calc). */
export async function getCompletedMatchesByTournament(tournamentId: string): Promise<Match[]> {
  const snap = await getDocs(
    query(
      collection(db, MATCHES),
      where('tournamentId', '==', tournamentId),
      where('status', '==', 'completed')
    )
  )
  return snap.docs.map(d => docToMatch(d.id, d.data() as Record<string, unknown>))
}

// ── Match Engine Lifecycle ────────────────────────────────────────────────────

/** Mark a match as abandoned (before or during play, no result). Triggers recalculation if it was completed. */
export async function abandonMatch(matchId: string, reason = 'Match abandoned'): Promise<void> {
  const matchSnap = await getDoc(doc(db, MATCHES, matchId))
  const prevStatus = matchSnap.exists() ? (matchSnap.data().status as string) : ''
  const tournamentId = matchSnap.exists() ? (matchSnap.data().tournamentId as string) ?? '' : ''

  await updateDoc(doc(db, MATCHES, matchId), {
    status: 'abandoned',
    resultSummary: reason,
    result: 'no_result',
  })

  // If it was previously completed, recalculate stats (that match no longer counts)
  if (prevStatus === 'completed' && tournamentId) {
    try {
      const [{ recalculateAllPlayerStats }, { autoUpdatePointsTable }] = await Promise.all([
        import('./playerStatsService'),
        import('./tournamentService'),
      ])
      await Promise.all([
        recalculateAllPlayerStats(tournamentId),
        autoUpdatePointsTable(tournamentId),
      ])
    } catch (err) {
      console.error('[matchService] abandonMatch: recalculation failed:', err)
    }
  }
}

/** Mark a match as No Result (DLS, rain, etc.). */
export async function markNoResult(matchId: string, reason = 'No result — match abandoned due to weather'): Promise<void> {
  await updateDoc(doc(db, MATCHES, matchId), {
    status: 'no_result',
    resultSummary: reason,
    result: 'no_result',
  })
}

/** Mark a match as rain-delayed (resumes later). */
export async function markRainDelay(matchId: string): Promise<void> {
  await updateDoc(doc(db, MATCHES, matchId), { status: 'rain_delay' })
}

/** Resume a rain-delayed or paused match back to live. */
export async function resumeMatch(matchId: string): Promise<void> {
  await updateDoc(doc(db, MATCHES, matchId), { status: 'live' })
}

/**
 * Clone a fixture — creates a new upcoming match with the same teams, format,
 * overs, venue and tournament, but a fresh state (no scores, no result).
 * Returns the new match ID.
 */
export async function cloneMatch(matchId: string, newScheduledAt?: string): Promise<string> {
  const original = await getMatch(matchId)
  if (!original) throw new Error(`cloneMatch: match ${matchId} not found`)

  const cloned = await addDoc(collection(db, MATCHES), {
    title:        `${original.title} (Clone)`,
    format:       original.format,
    totalOvers:   original.totalOvers,
    venue:        original.venue,
    scheduledAt:  newScheduledAt ?? original.scheduledAt,
    tournamentId: original.tournamentId,
    team1Id:      original.team1Id,
    team1Name:    original.team1Name,
    team1Logo:    original.team1Logo,
    team2Id:      original.team2Id,
    team2Name:    original.team2Name,
    team2Logo:    original.team2Logo,
    status:       'upcoming',
    tossWinnerId:  '',
    tossDecision:  '',
    team1Score:    0, team1Wickets: 0, team1Overs: 0,
    team2Score:    0, team2Wickets: 0, team2Overs: 0,
    result:        '',
    resultSummary: '',
    playerOfMatch: '',
    team1PlayingXI: [],
    team2PlayingXI: [],
    createdBy:    original.createdBy,
    createdAt:    serverTimestamp(),
  })
  return cloned.id
}

/** Save Playing XI for a match (called before live scoring starts). */
export async function setMatchPlayingXI(
  matchId: string,
  team1PlayingXI: string[],
  team2PlayingXI: string[],
): Promise<void> {
  await updateDoc(doc(db, MATCHES, matchId), { team1PlayingXI, team2PlayingXI })
}

