// src/services/teamService.ts
// ─────────────────────────────────────────────────────────────────────────────
// All Firestore CRUD operations for Teams and Players.
// Every function is pure async — no React state touched here.
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
  increment,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Team, Player, TeamCreatePayload } from '../types/team'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a random 6-character alphanumeric invite code */
export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

/** Convert a Firestore doc snapshot to a typed Team */
function docToTeam(id: string, data: Record<string, unknown>): Team {
  return {
    id,
    teamName: (data.teamName as string) ?? '',
    logo: (data.logo as string) ?? '🏏',
    captain: (data.captain as string) ?? '',
    createdBy: (data.createdBy as string) ?? '',
    inviteCode: (data.inviteCode as string) ?? '',
    createdAt: (data.createdAt as Team['createdAt']) ?? null,
    playerCount: (data.playerCount as number) ?? 0,
    tournamentId: (data.tournamentId as string) ?? '',
  }
}

/** Convert a Firestore doc snapshot to a typed Player */
function docToPlayer(id: string, data: Record<string, unknown>): Player {
  return {
    id,
    name: (data.name as string) ?? '',
    role: (data.role as Player['role']) ?? 'Batsman',
    teamId: (data.teamId as string) ?? '',
    tournamentId: (data.tournamentId as string) ?? '',
    addedBy: (data.addedBy as string) ?? '',
    joinedAt: (data.joinedAt as Player['joinedAt']) ?? null,
    stats: (data.stats as Player['stats']) ?? { matches: 0, runs: 0, wickets: 0, catches: 0 },
  }
}

// ── Teams ─────────────────────────────────────────────────────────────────────

/** Create a new team. Returns the new teamId. */
export async function createTeam(
  payload: Omit<TeamCreatePayload, 'createdAt' | 'playerCount' | 'inviteCode'>
): Promise<string> {
  const teamsRef = collection(db, 'teams')
  const docRef = await addDoc(teamsRef, {
    ...payload,
    inviteCode: generateInviteCode(),
    playerCount: 0,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

/** Fetch a single team by ID */
export async function getTeam(teamId: string): Promise<Team | null> {
  const snap = await getDoc(doc(db, 'teams', teamId))
  if (!snap.exists()) return null
  return docToTeam(snap.id, snap.data() as Record<string, unknown>)
}

/** Fetch all teams (for Browse page) */
export async function getAllTeams(): Promise<Team[]> {
  const snap = await getDocs(collection(db, 'teams'))
  return snap.docs.map(d => docToTeam(d.id, d.data() as Record<string, unknown>))
}

/** Fetch teams created by a specific user */
export async function getMyTeams(uid: string): Promise<Team[]> {
  const q = query(collection(db, 'teams'), where('createdBy', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map(d => docToTeam(d.id, d.data() as Record<string, unknown>))
}

/** Update team metadata (teamName, logo, captain) */
export async function updateTeam(
  teamId: string,
  updates: Partial<Pick<Team, 'teamName' | 'logo' | 'captain'>>
): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), updates)
}

/** Delete a team and all its players */
export async function deleteTeam(teamId: string): Promise<void> {
  // Delete all players in the team first
  const playersSnap = await getDocs(
    query(collection(db, 'players'), where('teamId', '==', teamId))
  )
  const deletions = playersSnap.docs.map(p => deleteDoc(p.ref))
  await Promise.all(deletions)
  // Delete team doc
  await deleteDoc(doc(db, 'teams', teamId))
}

/** Regenerate the invite code for a team */
export async function regenerateInviteCode(teamId: string): Promise<string> {
  const newCode = generateInviteCode()
  await updateDoc(doc(db, 'teams', teamId), { inviteCode: newCode })
  return newCode
}

// ── Real-time subscriptions ───────────────────────────────────────────────────

/** Subscribe to ALL teams (real-time) */
export function subscribeToAllTeams(
  callback: (teams: Team[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'teams'), snap => {
    const teams = snap.docs.map(d => docToTeam(d.id, d.data() as Record<string, unknown>))
    callback(teams)
  })
}

/**
 * Subscribe to teams belonging to a specific tournament (real-time).
 * Uses the tournament's teamIds array to filter. Empty tournamentId → empty list.
 */
export function subscribeToTeamsByTournament(
  tournamentId: string,
  tournamentTeamIds: string[],
  callback: (teams: Team[]) => void
): Unsubscribe {
  if (!tournamentId || tournamentTeamIds.length === 0) {
    callback([])
    return () => {}
  }
  // Subscribe to all teams but filter client-side by the tournament's teamIds.
  // Firestore 'in' queries are limited to 30 items; client filter scales better.
  return onSnapshot(collection(db, 'teams'), snap => {
    const teams = snap.docs
      .filter(d => tournamentTeamIds.includes(d.id))
      .map(d => docToTeam(d.id, d.data() as Record<string, unknown>))
    callback(teams)
  })
}

/** Subscribe to MY teams (real-time) */
export function subscribeToMyTeams(
  uid: string,
  callback: (teams: Team[]) => void
): Unsubscribe {
  const q = query(collection(db, 'teams'), where('createdBy', '==', uid))
  return onSnapshot(q, snap => {
    const teams = snap.docs.map(d => docToTeam(d.id, d.data() as Record<string, unknown>))
    callback(teams)
  })
}

/** Subscribe to a single team (real-time) */
export function subscribeToTeam(
  teamId: string,
  callback: (team: Team | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'teams', teamId), snap => {
    if (!snap.exists()) { callback(null); return }
    callback(docToTeam(snap.id, snap.data() as Record<string, unknown>))
  })
}

/** Subscribe to players of a team (real-time) */
export function subscribeToPlayers(
  teamId: string,
  callback: (players: Player[]) => void
): Unsubscribe {
  const q = query(collection(db, 'players'), where('teamId', '==', teamId))
  return onSnapshot(q, snap => {
    const players = snap.docs.map(d => docToPlayer(d.id, d.data() as Record<string, unknown>))
    callback(players)
  })
}

// ── Join by Invite Code ───────────────────────────────────────────────────────

/** Find a team by invite code. Returns team or null. */
export async function findTeamByInviteCode(code: string): Promise<Team | null> {
  const q = query(collection(db, 'teams'), where('inviteCode', '==', code.toUpperCase()))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return docToTeam(d.id, d.data() as Record<string, unknown>)
}

// ── Players ───────────────────────────────────────────────────────────────────

/** Add a player to a team */
export async function addPlayer(
  teamId: string,
  playerData: { name: string; role: Player['role']; addedBy: string }
): Promise<string> {
  const teamSnap = await getDoc(doc(db, 'teams', teamId))
  const teamData = teamSnap.exists() ? teamSnap.data() : null
  const tournamentId = teamData?.tournamentId ?? ''

  const ref = await addDoc(collection(db, 'players'), {
    ...playerData,
    teamId,
    tournamentId,
    joinedAt: serverTimestamp(),
    stats: { matches: 0, runs: 0, wickets: 0, catches: 0 },
  })
  // Increment playerCount on team
  await updateDoc(doc(db, 'teams', teamId), { playerCount: increment(1) })
  return ref.id
}

/** Remove a player from a team */
export async function removePlayer(teamId: string, playerId: string): Promise<void> {
  await deleteDoc(doc(db, 'players', playerId))
  await updateDoc(doc(db, 'teams', teamId), { playerCount: increment(-1) })
}

/** Get all players for a team (one-time fetch) */
export async function getTeamPlayers(teamId: string): Promise<Player[]> {
  const q = query(collection(db, 'players'), where('teamId', '==', teamId))
  const snap = await getDocs(q)
  return snap.docs.map(d => docToPlayer(d.id, d.data() as Record<string, unknown>))
}

// ── User team membership ──────────────────────────────────────────────────────

/**
 * Record that a user has "joined" a team (not player record, just user-side).
 * Stores in users/{uid}/joinedTeams/{teamId}
 */
export async function joinTeam(uid: string, teamId: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'joinedTeams', teamId), {
    teamId,
    joinedAt: serverTimestamp(),
  })
}

/** Get the list of teamIds that a user has joined */
export async function getJoinedTeamIds(uid: string): Promise<string[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'joinedTeams'))
  return snap.docs.map(d => d.id)
}
