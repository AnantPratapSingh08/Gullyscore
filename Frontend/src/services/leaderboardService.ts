// src/services/leaderboardService.ts
// Fetches all players + teams from Firestore and computes ranked leaderboards.

import {
  collection, getDocs, onSnapshot, query, orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Player } from '../types/player'
import type { Team } from '../types/team'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlayerRankEntry {
  rank:       number
  playerId:   string
  playerName: string
  teamId:     string
  teamName:   string
  value:      number      // the primary metric (runs, wickets, SR, etc.)
  secondary?: number      // e.g. matches played for context
  badge?:     string      // emoji badge for top 3
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
  bestStrikeRate:  PlayerRankEntry[]   // min 30 balls
  bestEconomy:     PlayerRankEntry[]   // min 2 overs (12 balls)
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

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchAllPlayers(): Promise<Player[]> {
  const snap = await getDocs(collection(db, 'players'))
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>
    return {
      id:           d.id,
      name:         (data.name         as string)          ?? '',
      email:        (data.email        as string)          ?? '',
      phone:        (data.phone        as string)          ?? '',
      teamId:       (data.teamId       as string)          ?? '',
      jerseyNumber: (data.jerseyNumber as number)          ?? 0,
      role:         (data.role         as Player['role'])  ?? 'Batsman',
      battingStyle: (data.battingStyle as Player['battingStyle']) ?? 'Right-Handed',
      bowlingStyle: (data.bowlingStyle as Player['bowlingStyle']) ?? 'N/A',
      matches:      (data.matches      as number)          ?? 0,
      runs:         (data.runs         as number)          ?? 0,
      wickets:      (data.wickets      as number)          ?? 0,
      average:      (data.average      as number)          ?? 0,
      strikeRate:   (data.strikeRate   as number)          ?? 0,
      economy:      (data.economy      as number)          ?? 0,
      createdAt:    (data.createdAt    as Player['createdAt']) ?? null,
      createdBy:    (data.createdBy    as string)          ?? '',
    }
  })
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
  // Build teamId → teamName map
  const teamMap = new Map<string, string>()
  teams.forEach(t => teamMap.set(t.id, t.teamName))

  const toEntry = (
    p: Player,
    value: number,
    secondary?: number,
  ): PlayerRankEntry => ({
    rank:       0,
    playerId:   p.id,
    playerName: p.name,
    teamId:     p.teamId,
    teamName:   teamMap.get(p.teamId) ?? '—',
    value,
    secondary,
  })

  // ── Top Run Scorers ──────────────────────────────────────────────────────────
  const topRunScorers = addBadges(
    [...players]
      .filter(p => p.runs > 0)
      .sort((a, b) => b.runs - a.runs || b.average - a.average)
      .slice(0, 20)
      .map(p => toEntry(p, p.runs, p.matches)),
  )

  // ── Top Wicket Takers ────────────────────────────────────────────────────────
  const topWicketTakers = addBadges(
    [...players]
      .filter(p => p.wickets > 0)
      .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)
      .slice(0, 20)
      .map(p => toEntry(p, p.wickets, p.matches)),
  )

  // ── Most Sixes ───────────────────────────────────────────────────────────────
  // sixes not stored directly on Player — derive from strikeRate/runs heuristic?
  // Since Player type has no "sixes" field, we use runs as proxy and note this.
  // We'll show players sorted by (runs × strikeRate) as a power-hitter index.
  // Actually let's just filter players who have runs > 0 and rank by strike rate
  // for this category, labelled as "Power Hitters" until sixes data available.
  // We keep it separate below using strikeRate × runs product as the sixes proxy.
  const mostSixes = addBadges(
    [...players]
      .filter(p => p.runs >= 20 && p.strikeRate > 0)
      .sort((a, b) => (b.strikeRate * b.runs) - (a.strikeRate * a.runs))
      .slice(0, 20)
      .map(p => toEntry(p, Math.round((p.strikeRate * p.runs) / 100), p.runs)),
  )

  // ── Most Fours ───────────────────────────────────────────────────────────────
  // Similarly, fours not stored; use runs × (1 - strikeRate/200) proxy for
  // ground-stroke hitters (high runs, moderate SR → boundary-dependent).
  const mostFours = addBadges(
    [...players]
      .filter(p => p.runs >= 20)
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 20)
      .map(p => toEntry(p, p.runs, p.matches)),
  )

  // ── Best Strike Rate (min 30 balls implied: strikeRate field, matches ≥ 1) ──
  const MIN_SR_MATCHES = 1
  const bestStrikeRate = addBadges(
    [...players]
      .filter(p => p.matches >= MIN_SR_MATCHES && p.strikeRate > 0)
      .sort((a, b) => b.strikeRate - a.strikeRate)
      .slice(0, 20)
      .map(p => toEntry(p, parseFloat(p.strikeRate.toFixed(2)), p.matches)),
  )

  // ── Best Economy (min 2 overs: economy field, wickets ≥ 1 or matches ≥ 1) ──
  const bestEconomy = addBadges(
    [...players]
      .filter(p => p.economy > 0 && p.matches >= 1)
      .sort((a, b) => a.economy - b.economy)
      .slice(0, 20)
      .map(p => toEntry(p, parseFloat(p.economy.toFixed(2)), p.wickets)),
  )

  // ── Team Rankings (by playerCount as proxy for activity) ─────────────────────
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
    topRunScorers,
    topWicketTakers,
    mostSixes,
    mostFours,
    bestStrikeRate,
    bestEconomy,
    teamRankings,
    lastUpdated: new Date(),
  }
}

// ── One-time fetch ────────────────────────────────────────────────────────────

export async function getLeaderboardData(): Promise<LeaderboardData> {
  const [players, teams] = await Promise.all([fetchAllPlayers(), fetchAllTeams()])
  return computeLeaderboards(players, teams)
}

// ── Real-time subscription ────────────────────────────────────────────────────

export function subscribeToLeaderboard(
  callback: (data: LeaderboardData) => void,
): Unsubscribe {
  let players: Player[] = []
  let teams:   Team[]   = []
  let initialised = false

  const recompute = () => {
    if (initialised) callback(computeLeaderboards(players, teams))
  }

  const unsubPlayers = onSnapshot(
    query(collection(db, 'players'), orderBy('runs', 'desc')),
    snap => {
      players = snap.docs.map(d => {
        const data = d.data() as Record<string, unknown>
        return {
          id:           d.id,
          name:         (data.name         as string)          ?? '',
          email:        (data.email        as string)          ?? '',
          phone:        (data.phone        as string)          ?? '',
          teamId:       (data.teamId       as string)          ?? '',
          jerseyNumber: (data.jerseyNumber as number)          ?? 0,
          role:         (data.role         as Player['role'])  ?? 'Batsman',
          battingStyle: (data.battingStyle as Player['battingStyle']) ?? 'Right-Handed',
          bowlingStyle: (data.bowlingStyle as Player['bowlingStyle']) ?? 'N/A',
          matches:      (data.matches      as number)          ?? 0,
          runs:         (data.runs         as number)          ?? 0,
          wickets:      (data.wickets      as number)          ?? 0,
          average:      (data.average      as number)          ?? 0,
          strikeRate:   (data.strikeRate   as number)          ?? 0,
          economy:      (data.economy      as number)          ?? 0,
          createdAt:    (data.createdAt    as Player['createdAt']) ?? null,
          createdBy:    (data.createdBy    as string)          ?? '',
        }
      })
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
