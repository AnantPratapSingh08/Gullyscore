// src/hooks/useTeams.ts
// ─────────────────────────────────────────────────────────────────────────────
// Custom hooks for real-time team data with loading + error states
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import {
  subscribeToAllTeams,
  subscribeToMyTeams,
  subscribeToTeam,
  subscribeToPlayers,
  subscribeToTeamsByTournament,
} from '../services/teamService'
import type { Team, Player } from '../types/team'

// ── useAllTeams ───────────────────────────────────────────────────────────────
export function useAllTeams() {
  const [teams, setTeams]     = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const unsub = subscribeToAllTeams(
      (data) => { setTeams(data); setLoading(false) }
    )
    return unsub
  }, [])

  return { teams, loading, error, setError }
}

// ── useTournamentTeams ────────────────────────────────────────────────────────
/** Subscribes to only the teams belonging to the active tournament. */
export function useTournamentTeams(tournamentId: string, teamIds: string[]) {
  const [teams, setTeams]     = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const unsub = subscribeToTeamsByTournament(tournamentId, teamIds, (data) => {
      setTeams(data)
      setLoading(false)
    })
    return unsub
  // Stringify to avoid infinite loops from array reference changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, JSON.stringify(teamIds)])

  return { teams, loading, error, setError }
}

// ── useMyTeams ────────────────────────────────────────────────────────────────
export function useMyTeams(uid: string | undefined) {
  const [teams, setTeams]     = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    setLoading(true)
    const unsub = subscribeToMyTeams(uid, (data) => {
      setTeams(data)
      setLoading(false)
    })
    return unsub
  }, [uid])

  return { teams, loading, error, setError }
}

// ── useTeam ───────────────────────────────────────────────────────────────────
export function useTeam(teamId: string | undefined) {
  const [team, setTeam]       = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!teamId) { setLoading(false); return }
    setLoading(true)
    const unsub = subscribeToTeam(teamId, (data) => {
      setTeam(data)
      setLoading(false)
      if (!data) setError('Team not found.')
    })
    return unsub
  }, [teamId])

  return { team, loading, error }
}

// ── usePlayers ────────────────────────────────────────────────────────────────
export function usePlayers(teamId: string | undefined) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) { setLoading(false); return }
    setLoading(true)
    const unsub = subscribeToPlayers(teamId, (data) => {
      setPlayers(data)
      setLoading(false)
    })
    return unsub
  }, [teamId])

  return { players, loading }
}
