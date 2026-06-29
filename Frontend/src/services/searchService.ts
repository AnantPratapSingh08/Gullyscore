// src/services/searchService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Global search — queries tournaments, teams, players, and matches
// within the context of the user's joined tournaments.
// All queries are client-side filtered after a scoped Firestore fetch.
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection, getDocs, query, where, limit,
} from 'firebase/firestore'
import { db } from './firebase'

// ── Result types ──────────────────────────────────────────────────────────────

export type SearchResultType = 'tournament' | 'team' | 'player' | 'match'

export interface SearchResult {
  type:        SearchResultType
  id:          string
  title:       string
  subtitle:    string
  link:        string
  icon:        string
  tournamentId?: string
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * Global search across tournaments, teams, players, and matches.
 * @param q              Search query string
 * @param joinedIds      Array of tournament IDs the user belongs to
 * @param activeTournId  Active tournament ID (for prioritised results)
 */
export async function globalSearch(
  q: string,
  joinedIds: string[],
  activeTournId: string,
): Promise<SearchResult[]> {
  if (!q || q.trim().length < 2) return []
  const qLower = q.toLowerCase().trim()

  const results: SearchResult[] = []

  // ── Search tournaments ──────────────────────────────────────────────────
  try {
    const tournSnap = await getDocs(
      query(collection(db, 'tournaments'), limit(50))
    )
    tournSnap.docs.forEach(d => {
      const data = d.data()
      const name: string = (data.name ?? '').toLowerCase()
      if (
        (joinedIds.includes(d.id) || data.tournamentCode) &&
        name.includes(qLower)
      ) {
        results.push({
          type: 'tournament',
          id:   d.id,
          title:    data.name ?? 'Tournament',
          subtitle: `${data.format ?? ''} · ${data.status ?? ''}`,
          link:     `/tournaments/${d.id}`,
          icon:     data.logo ?? '🎯',
          tournamentId: d.id,
        })
      }
    })
  } catch {}

  // ── Search teams (within joined tournaments only) ───────────────────────
  if (joinedIds.length > 0) {
    try {
      const teamsSnap = await getDocs(query(collection(db, 'teams'), limit(200)))
      teamsSnap.docs.forEach(d => {
        const data = d.data()
        const name: string = (data.teamName ?? '').toLowerCase()
        const capt: string = (data.captain ?? '').toLowerCase()
        if (name.includes(qLower) || capt.includes(qLower)) {
          results.push({
            type:     'team',
            id:       d.id,
            title:    data.teamName ?? 'Team',
            subtitle: `Captain: ${data.captain ?? '—'}`,
            link:     `/teams/${d.id}`,
            icon:     data.logo ?? '🏆',
          })
        }
      })
    } catch {}
  }

  // ── Search players (within joined tournaments) ──────────────────────────
  if (joinedIds.length > 0) {
    try {
      const playersSnap = await getDocs(query(collection(db, 'players'), limit(200)))
      playersSnap.docs.forEach(d => {
        const data = d.data()
        const name: string  = (data.name ?? '').toLowerCase()
        const email: string = (data.email ?? '').toLowerCase()
        if (name.includes(qLower) || email.includes(qLower)) {
          results.push({
            type:     'player',
            id:       d.id,
            title:    data.name ?? 'Player',
            subtitle: `${data.role ?? ''} · ${data.battingStyle ?? ''}`,
            link:     `/players/${d.id}`,
            icon:     '🏏',
          })
        }
      })
    } catch {}
  }

  // ── Search matches (in active tournament) ───────────────────────────────
  if (activeTournId) {
    try {
      const matchesSnap = await getDocs(
        query(
          collection(db, 'matches'),
          where('tournamentId', '==', activeTournId),
          limit(50),
        )
      )
      matchesSnap.docs.forEach(d => {
        const data = d.data()
        const title: string = (data.title ?? '').toLowerCase()
        const t1:    string = (data.team1Name ?? '').toLowerCase()
        const t2:    string = (data.team2Name ?? '').toLowerCase()
        const venue: string = (data.venue ?? '').toLowerCase()
        if (
          title.includes(qLower) ||
          t1.includes(qLower) ||
          t2.includes(qLower) ||
          venue.includes(qLower)
        ) {
          results.push({
            type:     'match',
            id:       d.id,
            title:    data.title ?? 'Match',
            subtitle: `${data.team1Name ?? ''} vs ${data.team2Name ?? ''} · ${data.status ?? ''}`,
            link:     `/matches/${d.id}`,
            icon:     '🏏',
            tournamentId: activeTournId,
          })
        }
      })
    } catch {}
  }

  // Sort: active tournament results first, then alphabetically
  return results
    .slice(0, 30)
    .sort((a, b) => {
      if (a.tournamentId === activeTournId && b.tournamentId !== activeTournId) return -1
      if (b.tournamentId === activeTournId && a.tournamentId !== activeTournId) return 1
      return a.title.localeCompare(b.title)
    })
}
