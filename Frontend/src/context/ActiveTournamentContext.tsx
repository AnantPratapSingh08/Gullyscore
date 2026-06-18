// src/context/ActiveTournamentContext.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Global "active tournament" context.
//
// • Stores the user's joined tournament IDs in their Firestore user document.
// • Persists the *selected* tournament in localStorage.
// • Exposes a tournament switcher that any component can consume.
// • All pages should scope their Firestore queries to `activeTournamentId`.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext, useContext, useEffect, useState, useCallback,
  type ReactNode,
} from 'react'
import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { getTournamentByCode, subscribeToTournament } from '../services/tournamentService'
import { useAuth } from './AuthContext'
import type { Tournament } from '../types/tournament'

// ── Shape ─────────────────────────────────────────────────────────────────────

interface ActiveTournamentCtx {
  /** IDs of all tournaments this user has joined */
  joinedIds: string[]
  /** Fully loaded Tournament objects for every joined ID */
  joinedTournaments: Tournament[]
  /** The currently selected tournament (for scoping all data) */
  activeTournament: Tournament | null
  activeTournamentId: string
  /** Set the active tournament (also persists in localStorage) */
  setActiveTournamentId: (id: string) => void
  /** Join a tournament by its 6-char code */
  joinByCode: (code: string) => Promise<{ ok: boolean; tournament?: Tournament; error?: string }>
  /** Leave a tournament */
  leaveTournament: (tournamentId: string) => Promise<void>
  loading: boolean
}

const Ctx = createContext<ActiveTournamentCtx | null>(null)

const LS_KEY = 'gs_active_tournament'

// ── Provider ──────────────────────────────────────────────────────────────────

export function ActiveTournamentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [joinedIds,          setJoinedIds]          = useState<string[]>([])
  const [joinedTournaments,  setJoinedTournaments]  = useState<Tournament[]>([])
  const [activeTournamentId, _setActiveTournamentId] = useState<string>(() => {
    return localStorage.getItem(LS_KEY) ?? ''
  })
  const [activeTournament,   setActiveTournament]   = useState<Tournament | null>(null)
  const [loading,            setLoading]            = useState(true)

  // ── Load joined IDs from user Firestore doc ──────────────────────────────
  useEffect(() => {
    if (!user) {
      setJoinedIds([])
      setJoinedTournaments([])
      setLoading(false)
      return
    }

    const userRef = doc(db, 'users', user.uid)
    const unsub = onSnapshot(userRef, snap => {
      if (snap.exists()) {
        const data = snap.data()
        const ids = (data.joinedTournamentIds as string[]) ?? []
        setJoinedIds(ids)
      } else {
        setJoinedIds([])
      }
    })
    return unsub
  }, [user])

  // ── Load full Tournament objects for each joined ID ──────────────────────
  useEffect(() => {
    if (joinedIds.length === 0) {
      setJoinedTournaments([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubs: Unsubscribe[] = []
    const map = new Map<string, Tournament>()

    let resolved = 0
    const total = joinedIds.length

    joinedIds.forEach(id => {
      const unsub = subscribeToTournament(id, t => {
        if (t) {
          map.set(id, t)
        } else {
          map.delete(id)
        }
        setJoinedTournaments(Array.from(map.values()))
        resolved++
        if (resolved >= total) setLoading(false)
      })
      unsubs.push(unsub)
    })

    return () => unsubs.forEach(u => u())
  }, [joinedIds])

  // ── Subscribe to active tournament ───────────────────────────────────────
  useEffect(() => {
    if (!activeTournamentId) {
      setActiveTournament(null)
      return
    }
    const unsub = subscribeToTournament(activeTournamentId, t => {
      setActiveTournament(t)
    })
    return unsub
  }, [activeTournamentId])

  // ── Auto-select first joined tournament if none selected ─────────────────
  useEffect(() => {
    if (!activeTournamentId && joinedIds.length > 0) {
      _setActiveTournamentId(joinedIds[0])
      localStorage.setItem(LS_KEY, joinedIds[0])
    }
  }, [activeTournamentId, joinedIds])

  // ── Actions ───────────────────────────────────────────────────────────────

  const setActiveTournamentId = useCallback((id: string) => {
    _setActiveTournamentId(id)
    localStorage.setItem(LS_KEY, id)
  }, [])

  const joinByCode = useCallback(async (code: string): Promise<{
    ok: boolean; tournament?: Tournament; error?: string
  }> => {
    if (!user) return { ok: false, error: 'Not logged in.' }
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length !== 6) return { ok: false, error: 'Code must be 6 characters.' }

    const tournament = await getTournamentByCode(trimmed)
    if (!tournament) return { ok: false, error: 'Tournament not found. Check the code.' }

    // Already joined?
    if (joinedIds.includes(tournament.id)) {
      setActiveTournamentId(tournament.id)
      return { ok: true, tournament }
    }

    // Add to user's joined list
    const userRef = doc(db, 'users', user.uid)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      await updateDoc(userRef, { joinedTournamentIds: arrayUnion(tournament.id) })
    } else {
      // User doc missing — create it
      await setDoc(userRef, {
        name: user.displayName ?? '',
        email: user.email ?? '',
        joinedTournamentIds: [tournament.id],
        createdAt: serverTimestamp(),
      })
    }

    setActiveTournamentId(tournament.id)
    return { ok: true, tournament }
  }, [user, joinedIds, setActiveTournamentId])

  const leaveTournament = useCallback(async (tournamentId: string) => {
    if (!user) return
    const userRef = doc(db, 'users', user.uid)
    await updateDoc(userRef, { joinedTournamentIds: arrayRemove(tournamentId) })
    if (activeTournamentId === tournamentId) {
      const remaining = joinedIds.filter(id => id !== tournamentId)
      const next = remaining[0] ?? ''
      _setActiveTournamentId(next)
      localStorage.setItem(LS_KEY, next)
    }
  }, [user, activeTournamentId, joinedIds])

  const value: ActiveTournamentCtx = {
    joinedIds,
    joinedTournaments,
    activeTournament,
    activeTournamentId,
    setActiveTournamentId,
    joinByCode,
    leaveTournament,
    loading,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useActiveTournament(): ActiveTournamentCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useActiveTournament must be inside ActiveTournamentProvider')
  return ctx
}
