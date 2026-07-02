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
import type { Match } from '../types/match'

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
  matches:    number
  runs:       number
  wickets:    number
  average:    number
  strikeRate: number
  economy:    number
  fours:      number
  sixes:      number
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

function hydrateMatch(id: string, data: Record<string, unknown>): Match {
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

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchAllPlayers(): Promise<Player[]> {
  const snap = await getDocs(collection(db, 'players'))
  return snap.docs.map(d => hydratePlayer(d.id, d.data() as Record<string, unknown>))
}

async function fetchAllMatches(): Promise<Match[]> {
  const snap = await getDocs(collection(db, 'matches'))
  return snap.docs.map(d => hydrateMatch(d.id, d.data() as Record<string, unknown>))
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

function computeLeaderboards(players: Player[], teams: Team[], matches: Match[]): LeaderboardData {
  const teamMap = new Map<string, string>()
  teams.forEach(t => teamMap.set(t.id, t.teamName))

  const toEntry = (p: Player, value: number, secondary?: number): PlayerRankEntry => ({
    rank: 0, playerId: p.id, playerName: p.name,
    teamId: p.teamId, teamName: teamMap.get(p.teamId) ?? '—',
    value, secondary,
    matches: p.matches || 0,
    runs: p.runs || 0,
    wickets: p.wickets || 0,
    average: p.average || 0,
    strikeRate: p.strikeRate || 0,
    economy: p.economy || 0,
    fours: p.batting?.fours || 0,
    sixes: p.batting?.sixes || 0,
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
      .map(t => {
        // Compute actual matches played and wins from completed matches involving this team
        const completedTeamMatches = matches.filter(m =>
          m.status === 'completed' && (m.team1Id === t.id || m.team2Id === t.id)
        )
        const matchesPlayed = completedTeamMatches.length
        const wins = completedTeamMatches.filter(m => {
          if (m.result === 'team1' && m.team1Id === t.id) return true
          if (m.result === 'team2' && m.team2Id === t.id) return true
          return false
        }).length

        const totalRuns = players.filter(p => p.teamId === t.id).reduce((s, p) => s + p.runs, 0)
        const winPercent = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0

        return {
          rank: 0,
          teamId: t.id,
          teamName: t.teamName,
          logo: t.logo,
          wins,
          matches: matchesPlayed,
          totalRuns,
          winPercent,
        }
      })
      .sort((a, b) => b.totalRuns - a.totalRuns || b.wins - a.wins || a.teamName.localeCompare(b.teamName))
      .slice(0, 20)
  )

  return {
    topRunScorers, topWicketTakers, mostSixes, mostFours,
    mostCatches, mostRunOuts, bestStrikeRate, bestEconomy,
    teamRankings, lastUpdated: new Date(),
  }
}

// ── One-time fetch ────────────────────────────────────────────────────────────

export async function getLeaderboardData(): Promise<LeaderboardData> {
  const [players, teams, matches] = await Promise.all([
    fetchAllPlayers(),
    fetchAllTeams(),
    fetchAllMatches(),
  ])
  return computeLeaderboards(players, teams, matches)
}

// ── Real-time subscription ────────────────────────────────────────────────────

export function subscribeToLeaderboard(callback: (data: LeaderboardData) => void): Unsubscribe {
  let players: Player[] = []
  let teams:   Team[]   = []
  let matches: Match[]  = []
  let playersLoaded = false
  let teamsLoaded = false
  let matchesLoaded = false

  const recompute = () => {
    if (playersLoaded && teamsLoaded && matchesLoaded) {
      callback(computeLeaderboards(players, teams, matches))
    }
  }

  const unsubPlayers = onSnapshot(
    query(collection(db, 'players'), orderBy('runs', 'desc')),
    snap => {
      players = snap.docs.map(d => hydratePlayer(d.id, d.data() as Record<string, unknown>))
      playersLoaded = true
      recompute()
    },
    error => {
      console.error('[subscribeToLeaderboard] players error:', error)
      playersLoaded = true
      recompute()
    }
  )

  const unsubTeams = onSnapshot(
    collection(db, 'teams'),
    snap => {
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
      teamsLoaded = true
      recompute()
    },
    error => {
      console.error('[subscribeToLeaderboard] teams error:', error)
      teamsLoaded = true
      recompute()
    }
  )

  const unsubMatches = onSnapshot(
    collection(db, 'matches'),
    snap => {
      matches = snap.docs.map(d => hydrateMatch(d.id, d.data() as Record<string, unknown>))
      matchesLoaded = true
      recompute()
    },
    error => {
      console.error('[subscribeToLeaderboard] matches error:', error)
      matchesLoaded = true
      recompute()
    }
  )

  return () => { unsubPlayers(); unsubTeams(); unsubMatches() }
}

// ── Tournament-scoped leaderboard ─────────────────────────────────────────────

/**
 * Like subscribeToLeaderboard but filters to only players and teams in a
 * specific tournament (by tournamentTeamIds array).
 */
export function subscribeToTournamentLeaderboard(
  tournamentId: string | undefined,
  tournamentTeamIds: string[],
  callback: (data: LeaderboardData) => void,
): Unsubscribe {
  if (tournamentTeamIds.length === 0) {
    // No teams — emit empty leaderboard immediately
    callback(computeLeaderboards([], [], []))
    return () => {}
  }

  let players: Player[] = []
  let teams:   Team[]   = []
  let matches: Match[]  = []
  let playersLoaded = false
  let teamsLoaded = false
  let matchesLoaded = false

  const recompute = () => {
    if (!playersLoaded || !teamsLoaded || !matchesLoaded) return
    const filteredPlayers = players.filter(p => tournamentTeamIds.includes(p.teamId))
    const filteredTeams   = teams.filter(t => tournamentTeamIds.includes(t.id))
    const filteredMatches = matches.filter(m =>
      tournamentId ? m.tournamentId === tournamentId : (tournamentTeamIds.includes(m.team1Id) || tournamentTeamIds.includes(m.team2Id))
    )
    callback(computeLeaderboards(filteredPlayers, filteredTeams, filteredMatches))
  }

  const unsubPlayers = onSnapshot(
    query(collection(db, 'players'), orderBy('runs', 'desc')),
    snap => {
      players = snap.docs.map(d => hydratePlayer(d.id, d.data() as Record<string, unknown>))
      playersLoaded = true
      recompute()
    },
    error => {
      console.error('[subscribeToTournamentLeaderboard] players error:', error)
      playersLoaded = true
      recompute()
    }
  )

  const unsubTeams = onSnapshot(
    collection(db, 'teams'),
    snap => {
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
      teamsLoaded = true
      recompute()
    },
    error => {
      console.error('[subscribeToTournamentLeaderboard] teams error:', error)
      teamsLoaded = true
      recompute()
    }
  )

  const unsubMatches = onSnapshot(
    collection(db, 'matches'),
    snap => {
      matches = snap.docs.map(d => hydrateMatch(d.id, d.data() as Record<string, unknown>))
      matchesLoaded = true
      recompute()
    },
    error => {
      console.error('[subscribeToTournamentLeaderboard] matches error:', error)
      matchesLoaded = true
      recompute()
    }
  )

  return () => { unsubPlayers(); unsubTeams(); unsubMatches() }
}

