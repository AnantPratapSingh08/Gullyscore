// src/context/TournamentContext.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Provides the currently viewed tournament + admin status to any descendant.
// Wrap routes that need tournament data with <TournamentProvider tournamentId=.../>
// or use useTournamentContext() directly in pages that have :tournamentId param.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { subscribeToTournament } from '../services/tournamentService'
import { isTournamentAdmin } from '../utils/tournamentGuard'
import { useAuth } from './AuthContext'
import type { Tournament } from '../types/tournament'

// ── Context shape ─────────────────────────────────────────────────────────────

interface TournamentContextValue {
  /** Current tournament, null while loading or if not found */
  tournament: Tournament | null
  /** True while the Firestore subscription is resolving */
  loading: boolean
  /** True if the authenticated user is the tournament admin */
  isAdmin: boolean
  /** Error message if tournament was not found */
  error: string | null
}

const TournamentContext = createContext<TournamentContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

interface TournamentProviderProps {
  tournamentId: string
  children: ReactNode
}

export function TournamentProvider({ tournamentId, children }: TournamentProviderProps) {
  const { user } = useAuth()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false)
      setError('No tournament ID provided.')
      return
    }

    setLoading(true)
    setError(null)

    const unsub = subscribeToTournament(tournamentId, data => {
      if (!data) {
        setError('Tournament not found.')
        setTournament(null)
      } else {
        setTournament(data)
        setError(null)
      }
      setLoading(false)
    })

    return unsub
  }, [tournamentId])

  const isAdmin = tournament ? isTournamentAdmin(tournament, user?.uid) : false

  return (
    <TournamentContext.Provider value={{ tournament, loading, isAdmin, error }}>
      {children}
    </TournamentContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Access the current tournament context.
 * Must be used inside a <TournamentProvider>.
 */
export function useTournamentContext(): TournamentContextValue {
  const ctx = useContext(TournamentContext)
  if (!ctx) {
    throw new Error('useTournamentContext must be used inside <TournamentProvider>')
  }
  return ctx
}

export default TournamentContext
