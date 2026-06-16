// src/utils/tournamentGuard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure role-check helpers for Tournament Admin.
// No React — safe to call from any context (service, hook, component).
//
// DESIGN:
//   Tournament has exactly one admin: the user whose uid === tournament.adminId.
//   All write operations (create/edit/delete teams, players, matches, stats)
//   MUST be guarded by assertTournamentAdmin() before touching Firestore.
//   Players and other users get read-only access.
// ─────────────────────────────────────────────────────────────────────────────

import type { Tournament } from '../types/tournament'

// ── Primary guards ────────────────────────────────────────────────────────────

/**
 * Returns true if the given uid is the admin of this tournament.
 * This is the canonical admin check — use it everywhere.
 */
export function isTournamentAdmin(
  tournament: Pick<Tournament, 'adminId'>,
  uid: string | null | undefined
): boolean {
  return !!uid && tournament.adminId === uid
}

/**
 * Throws a descriptive error if the user is NOT the tournament admin.
 * Call this at the top of any admin-only service function.
 *
 * @example
 * assertTournamentAdmin(tournament, user?.uid)
 * await updateTournament(id, payload)  // safe to proceed
 */
export function assertTournamentAdmin(
  tournament: Pick<Tournament, 'adminId' | 'name'>,
  uid: string | null | undefined
): void {
  if (!isTournamentAdmin(tournament, uid)) {
    throw new Error(
      `Access denied: only the admin of "${tournament.name}" can perform this action.`
    )
  }
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

/** True if the tournament is in a state that allows edits (draft or registration). */
export function isTournamentEditable(
  tournament: Pick<Tournament, 'status'>
): boolean {
  return tournament.status === 'draft' || tournament.status === 'registration'
}

/** True if the tournament is active (matches being played). */
export function isTournamentActive(
  tournament: Pick<Tournament, 'status'>
): boolean {
  return tournament.status === 'active'
}

/** True if the tournament is completed. */
export function isTournamentCompleted(
  tournament: Pick<Tournament, 'status'>
): boolean {
  return tournament.status === 'completed'
}

/**
 * Returns a human-readable reason why an admin action is blocked.
 * Returns null if the action is allowed.
 */
export function adminActionBlockReason(
  tournament: Pick<Tournament, 'adminId' | 'name' | 'status'>,
  uid: string | null | undefined
): string | null {
  if (!isTournamentAdmin(tournament, uid)) {
    return 'Only the tournament admin can perform this action.'
  }
  if (isTournamentCompleted(tournament)) {
    return 'This tournament has already been completed.'
  }
  return null
}
