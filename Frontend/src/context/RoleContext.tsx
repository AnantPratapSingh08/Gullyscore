// src/context/RoleContext.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Role-Based Access Control (RBAC) Context
// 5 Roles:
//   super_admin  - Full platform access
//   tournament_admin - Create/edit tournament, teams, matches, stats
//   scorer       - Can only update live score
//   player       - View own profile/team, read only
//   spectator    - Read only
//
// Role precedence (highest → lowest):
//   super_admin > tournament_admin > scorer > player > spectator
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './AuthContext'
import { useActiveTournament } from './ActiveTournamentContext'

// ── Role definitions ──────────────────────────────────────────────────────────

export type AppRole =
  | 'super_admin'
  | 'tournament_admin'
  | 'scorer'
  | 'player'
  | 'spectator'

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin:       '⭐ Super Admin',
  tournament_admin:  '🏆 Tournament Admin',
  scorer:            '📋 Scorer',
  player:            '🏏 Player',
  spectator:         '👀 Spectator',
}

const ROLE_PRIORITY: Record<AppRole, number> = {
  super_admin:      5,
  tournament_admin: 4,
  scorer:           3,
  player:           2,
  spectator:        1,
}

// ── Tournament role mapping ────────────────────────────────────────────────────
// Per-tournament roles stored in: users/{uid}/tournamentRoles/{tournamentId}
// { role: AppRole }

// ── Context type ──────────────────────────────────────────────────────────────

interface RoleContextType {
  /** Global platform role */
  globalRole: AppRole

  /** Role in the currently active tournament */
  tournamentRole: AppRole | null

  /** Effective role = highest of globalRole and tournamentRole */
  effectiveRole: AppRole

  loading: boolean

  // ── Permission helpers ────────────────────────────────────────────────────
  isSuperAdmin:       boolean
  isTournamentAdmin:  boolean
  isScorer:           boolean
  isPlayer:           boolean
  isSpectator:        boolean

  /** Can manage tournaments (create/edit/delete) */
  canManageTournament: boolean

  /** Can manage teams and players */
  canManageTeams: boolean

  /** Can create/edit matches */
  canManageMatches: boolean

  /** Can do live scoring */
  canScore: boolean

  /** Can edit player stats */
  canEditStats: boolean

  /** Can view admin dashboards */
  canViewAdmin: boolean

  // ── Role setters (admin only) ─────────────────────────────────────────────
  setTournamentRole: (tournamentId: string, role: AppRole) => Promise<void>
}

// ── Context ───────────────────────────────────────────────────────────────────

const RoleContext = createContext<RoleContextType | null>(null)

export function useRole(): RoleContextType {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used within RoleProvider')
  return ctx
}

// ── Fetch user role from Firestore ────────────────────────────────────────────

async function fetchGlobalRole(uid: string): Promise<AppRole> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    if (snap.exists()) {
      const data = snap.data()
      if (data?.globalRole) return data.globalRole as AppRole
    }
    return 'spectator'
  } catch {
    return 'spectator'
  }
}

async function fetchTournamentRole(uid: string, tournamentId: string): Promise<AppRole | null> {
  if (!tournamentId) return null
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'tournamentRoles', tournamentId))
    if (snap.exists()) {
      const data = snap.data()
      if (data?.role) return data.role as AppRole
    }
    return null
  } catch {
    return null
  }
}

function computeEffectiveRole(global: AppRole, tournament: AppRole | null): AppRole {
  if (!tournament) return global
  return ROLE_PRIORITY[global] >= ROLE_PRIORITY[tournament] ? global : tournament
}

function computePermissions(role: AppRole) {
  const priority = ROLE_PRIORITY[role]
  return {
    isSuperAdmin:       role === 'super_admin',
    isTournamentAdmin:  priority >= ROLE_PRIORITY.tournament_admin,
    isScorer:           priority >= ROLE_PRIORITY.scorer,
    isPlayer:           priority >= ROLE_PRIORITY.player,
    isSpectator:        true,

    canManageTournament: priority >= ROLE_PRIORITY.tournament_admin,
    canManageTeams:      priority >= ROLE_PRIORITY.tournament_admin,
    canManageMatches:    priority >= ROLE_PRIORITY.tournament_admin,
    canScore:            priority >= ROLE_PRIORITY.scorer,
    canEditStats:        priority >= ROLE_PRIORITY.tournament_admin,
    canViewAdmin:        priority >= ROLE_PRIORITY.tournament_admin,
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { activeTournamentId, activeTournament } = useActiveTournament()
  const activeTournamentAdminId = activeTournament?.adminId ?? ''
  const [globalRole,     setGlobalRoleState]     = useState<AppRole>('spectator')
  const [tournamentRole, setTournamentRoleState] = useState<AppRole | null>(null)
  const [loading,        setLoading]             = useState(true)

  useEffect(() => {
    if (!user) {
      setGlobalRoleState('spectator')
      setTournamentRoleState(null)
      setLoading(false)
      return
    }

    setLoading(true)
    Promise.all([
      fetchGlobalRole(user.uid),
      activeTournamentId ? fetchTournamentRole(user.uid, activeTournamentId) : Promise.resolve(null),
    ]).then(([global, tournament]) => {
      setGlobalRoleState(global)
      setTournamentRoleState(tournament)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user, activeTournamentId])

  // ── Self-heal: if creator has no tournament_admin role written yet, write it ─
  useEffect(() => {
    if (!user || !activeTournamentId || !activeTournamentAdminId) return
    if (activeTournamentAdminId !== user.uid) return
    if (tournamentRole === 'tournament_admin' || tournamentRole === 'super_admin') return
    // Creator is missing their Firestore role — write it now (idempotent)
    setDoc(
      doc(db, 'users', user.uid, 'tournamentRoles', activeTournamentId),
      { role: 'tournament_admin', grantedAt: new Date().toISOString() },
      { merge: true }
    ).then(() => {
      setTournamentRoleState('tournament_admin')
    }).catch(() => { /* non-fatal */ })
  // Use adminId (string) not activeTournament (object) to avoid firing on every snapshot
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTournamentId, activeTournamentAdminId, tournamentRole])

  let effectiveRole = computeEffectiveRole(globalRole, tournamentRole)
  // In-memory elevation: creator always gets tournament_admin regardless of Firestore lag
  if (user && activeTournamentAdminId && activeTournamentAdminId === user.uid) {
    if (ROLE_PRIORITY[effectiveRole] < ROLE_PRIORITY.tournament_admin) {
      effectiveRole = 'tournament_admin'
    }
  }

  const permissions = computePermissions(effectiveRole)

  const setTournamentRole = async (tournamentId: string, role: AppRole) => {
    if (!user) return
    await setDoc(doc(db, 'users', user.uid, 'tournamentRoles', tournamentId), {
      role,
      updatedAt: serverTimestamp(),
    })
    setTournamentRoleState(role)
  }

  const value: RoleContextType = {
    globalRole,
    tournamentRole,
    effectiveRole,
    loading,
    ...permissions,
    setTournamentRole,
  }

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}
