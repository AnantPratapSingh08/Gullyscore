// src/services/leaderboardService.ts
// Fetches all players + teams from Firestore and computes ranked leaderboards.

import {
  collection, getDocs, onSnapshot, query, orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Player } from '../types/player'
import { emptyBattingStats, emptyBowlingStats, emptyFieldingStats } from '../types/player'
import type { Team } from '../types/team'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlayerRankEntry {
  rank:       number
  playerId:   string
  playerName: string
  teamId:     string
  teamName:   string
  value:      number
  secondary?: number
  badge?:     string
}

export interface TeamRankEntry {
  rank:       number
  teamId:     string
  teamName:   string
  logo:       string
  wins:       number
  matches:    number
  totalRuns:  number
  winPercent: number
}

export interface LeaderboardData {
  topRunScorers:   PlayerRankEntry[]
  topWicketTakers: PlayerRankEntry[]
  mostSixes:       PlayerRankEntry[]
  mostFours:       PlayerRankEntry[]
  mostCatches:     PlayerRankEntry[]
  mostRunOuts:     PlayerRankEntry[]
  bestStrikeRate:  PlayerRankEntry[]
  bestEconomy:     PlayerRankEntry[]
  teamRankings:    TeamRankEntry[]
  lastUpdated:     Date
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BADGE = ['🥇', '🥈', '🥉']

function addBadges(entries: PlayerRankEntry[]): PlayerRankEntry[] {
  return entries.map((e, i) => ({ ...e, rank: i + 1, badge: i < 3 ? BADGE[i] : undefined }))
}

function addTeamBadges(entries: TeamRankEntry[]): TeamRankEntry[] {
  return entries.map((e, i) => ({ ...e, rank: i + 1 }))
}

// ── Player hydration ──────────────────────────────────────────────────────────

function hydratePlayer(id: string, data: Record<string, unknown>): Player {
  return {
    id,
    userId:       (data.userId       as string) ?? '',
    name:         (data.name         as string) ?? '',
    email:        (data.email        as string) ?? '',
    phone:        (data.phone        as string) ?? '',
    bio:          (data.bio          as string) ?? '',
    avatarUrl:    (data.avatarUrl    as string) ?? '',
    teamId:       (data.teamId       as string) ?? '',
    jerseyNumber: (data.jerseyNumber as number) ?? 0,
    role:         (data.role         as Player['role'])          ?? 'Batsman',
    battingStyle: (data.battingStyle as Player['battingStyle']) ?? 'Right-Handed',
    bowlingStyle: (data.bowlingStyle as Player['bowlingStyle']) ?? 'N/A',
    matches:      (data.matches      as number) ?? 0,
    runs:         (data.runs         as number) ?? 0,
    wickets:      (data.wickets      as number) ?? 0,
    average:      (data.average      as number) ?? 0,
    strikeRate:   (data.strikeRate   as number) ?? 0,
    economy:      (data.economy      as number) ?? 0,
    batting:      (data.batting      as Player['batting'])      ?? emptyBattingStats(),
    bowling:      (data.bowling      as Player['bowling'])      ?? emptyBowlingStats(),
    fielding:     (data.fielding     as Player['fielding'])     ?? emptyFieldingStats(),
    battingT20:   (data.battingT20   as Player['battingT20'])   ?? emptyBattingStats(),
    bowlingT20:   (data.bowlingT20   as Player['bowlingT20'])   ?? emptyBowlingStats(),
    battingODI:   (data.battingODI   as Player['battingODI'])   ?? emptyBattingStats(),
    bowlingODI:   (data.bowlingODI   as Player['bowlingODI'])   ?? emptyBowlingStats(),
    battingTest:  (data.battingTest  as Player['battingTest'])  ?? emptyBattingStats(),
    bowlingTest:  (data.bowlingTest  as Player['bowlingTest'])  ?? emptyBowlingStats(),
    createdAt:    (data.createdAt    as Player['createdAt'])    ?? null,
    createdBy:    (data.createdBy    as string) ?? '',
  }
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchAllPlayers(): Promise<Player[]> {
  const snap = await getDocs(collection(db, 'players'))
  return snap.docs.map(d => hydratePlayer(d.id, d.data() as Record<string, unknown>))
}

async function fetchAllTeams(): Promise<Team[]> {
  const snap = await getDocs(collection(db, 'teams'))
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>
    return {
      id:          d.id,
      teamName:    (data.teamName    as string) ?? '',
      logo:        (data.logo        as string) ?? '🏏',
      captain:     (data.captain     as string) ?? '',
      createdBy:   (data.createdBy   as string) ?? '',
      inviteCode:  (data.inviteCode  as string) ?? '',
      createdAt:   (data.createdAt   as Team['createdAt']) ?? null,
      playerCount: (data.playerCount as number) ?? 0,
    }
  })
}

// ── Compute leaderboards ──────────────────────────────────────────────────────

function computeLeaderboards(players: Player[], teams: Team[]): LeaderboardData {
  const teamMap = new Map<string, string>()
  teams.forEach(t => teamMap.set(t.id, t.teamName))

  const toEntry = (p: Player, value: number, secondary?: number): PlayerRankEntry => ({
    rank: 0, playerId: p.id, playerName: p.name,
    teamId: p.teamId, teamName: teamMap.get(p.teamId) ?? '—',
    value, secondary,
  })

  const topRunScorers = addBadges(
    [...players]
      .filter(p => p.runs > 0)
      .sort((a, b) => b.runs - a.runs || b.average - a.average)
      .slice(0, 20)
      .map(p => toEntry(p, p.runs, p.matches)),
  )

  const topWicketTakers = addBadges(
    [...players]
      .filter(p => p.wickets > 0)
      .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)
      .slice(0, 20)
      .map(p => toEntry(p, p.wickets, p.matches)),
  )

  // Use batting.sixes for most sixes (falls back to 0 if not set yet)
  const mostSixes = addBadges(
    [...players]
      .filter(p => p.batting.sixes > 0)
      .sort((a, b) => b.batting.sixes - a.batting.sixes)
      .slice(0, 20)
      .map(p => toEntry(p, p.batting.sixes, p.runs)),
  )

  const mostFours = addBadges(
    [...players]
      .filter(p => p.batting.fours > 0)
      .sort((a, b) => b.batting.fours - a.batting.fours)
      .slice(0, 20)
      .map(p => toEntry(p, p.batting.fours, p.runs)),
  )

  const mostCatches = addBadges(
    [...players]
      .filter(p => p.fielding.catches > 0)
      .sort((a, b) => b.fielding.catches - a.fielding.catches)
      .slice(0, 20)
      .map(p => toEntry(p, p.fielding.catches, p.matches)),
  )

  const mostRunOuts = addBadges(
    [...players]
      .filter(p => p.fielding.runOuts > 0)
      .sort((a, b) => b.fielding.runOuts - a.fielding.runOuts)
      .slice(0, 20)
      .map(p => toEntry(p, p.fielding.runOuts, p.matches)),
  )

  const bestStrikeRate = addBadges(
    [...players]
      .filter(p => p.matches >= 1 && p.strikeRate > 0)
      .sort((a, b) => b.strikeRate - a.strikeRate)
      .slice(0, 20)
      .map(p => toEntry(p, parseFloat(p.strikeRate.toFixed(2)), p.matches)),
  )

  const bestEconomy = addBadges(
    [...players]
      .filter(p => p.economy > 0 && p.matches >= 1)
      .sort((a, b) => a.economy - b.economy)
      .slice(0, 20)
      .map(p => toEntry(p, parseFloat(p.economy.toFixed(2)), p.wickets)),
  )

  const teamRankings = addTeamBadges(
    [...teams]
      .sort((a, b) => b.playerCount - a.playerCount || a.teamName.localeCompare(b.teamName))
      .slice(0, 20)
      .map((t, i) => ({
        rank:       i + 1,
        teamId:     t.id,
        teamName:   t.teamName,
        logo:       t.logo,
        wins:       0,
        matches:    0,
        totalRuns:  players.filter(p => p.teamId === t.id).reduce((s, p) => s + p.runs, 0),
        winPercent: 0,
      })),
  )

  return {
    topRunScorers, topWicketTakers, mostSixes, mostFours,
    mostCatches, mostRunOuts, bestStrikeRate, bestEconomy,
    teamRankings, lastUpdated: new Date(),
  }
}

// ── One-time fetch ────────────────────────────────────────────────────────────

export async function getLeaderboardData(): Promise<LeaderboardData> {
  const [players, teams] = await Promise.all([fetchAllPlayers(), fetchAllTeams()])
  return computeLeaderboards(players, teams)
}

// ── Real-time subscription ────────────────────────────────────────────────────

export function subscribeToLeaderboard(callback: (data: LeaderboardData) => void): Unsubscribe {
  let players: Player[] = []
  let teams:   Team[]   = []
  let initialised = false

  const recompute = () => { if (initialised) callback(computeLeaderboards(players, teams)) }

  const unsubPlayers = onSnapshot(
    query(collection(db, 'players'), orderBy('runs', 'desc')),
    snap => {
      players = snap.docs.map(d => hydratePlayer(d.id, d.data() as Record<string, unknown>))
      initialised = true
      recompute()
    },
  )

  const unsubTeams = onSnapshot(collection(db, 'teams'), snap => {
    teams = snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>
      return {
        id:          d.id,
        teamName:    (data.teamName    as string) ?? '',
        logo:        (data.logo        as string) ?? '🏏',
        captain:     (data.captain     as string) ?? '',
        createdBy:   (data.createdBy   as string) ?? '',
        inviteCode:  (data.inviteCode  as string) ?? '',
        createdAt:   (data.createdAt   as Team['createdAt']) ?? null,
        playerCount: (data.playerCount as number) ?? 0,
      }
    })
    initialised = true
    recompute()
  })

  return () => { unsubPlayers(); unsubTeams() }
}

// ── Tournament-scoped leaderboard ─────────────────────────────────────────────

/**
 * Like subscribeToLeaderboard but filters to only players and teams in a
 * specific tournament (by tournamentTeamIds array).
 */
export function subscribeToTournamentLeaderboard(
  tournamentTeamIds: string[],
  callback: (data: LeaderboardData) => void,
): Unsubscribe {
  if (tournamentTeamIds.length === 0) {
    // No teams — emit empty leaderboard immediately
    callback(computeLeaderboards([], []))
    return () => {}
  }

  let players: Player[] = []
  let teams:   Team[]   = []
  let initialised = false

  const recompute = () => {
    if (!initialised) return
    const filteredPlayers = players.filter(p => tournamentTeamIds.includes(p.teamId))
    const filteredTeams   = teams.filter(t => tournamentTeamIds.includes(t.id))
    callback(computeLeaderboards(filteredPlayers, filteredTeams))
  }

  const unsubPlayers = onSnapshot(
    query(collection(db, 'players'), orderBy('runs', 'desc')),
    snap => {
      players = snap.docs.map(d => hydratePlayer(d.id, d.data() as Record<string, unknown>))
      initialised = true
      recompute()
    },
  )

  const unsubTeams = onSnapshot(collection(db, 'teams'), snap => {
    teams = snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>
      return {
        id:          d.id,
        teamName:    (data.teamName    as string) ?? '',
        logo:        (data.logo        as string) ?? '🏏',
        captain:     (data.captain     as string) ?? '',
        createdBy:   (data.createdBy   as string) ?? '',
        inviteCode:  (data.inviteCode  as string) ?? '',
        createdAt:   (data.createdAt   as Team['createdAt']) ?? null,
        playerCount: (data.playerCount as number) ?? 0,
      }
    })
    initialised = true
    recompute()
  })

  return () => { unsubPlayers(); unsubTeams() }
}

