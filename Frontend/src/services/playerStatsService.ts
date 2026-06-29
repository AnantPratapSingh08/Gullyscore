// src/services/playerStatsService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Commits per-player career stats to Firestore when a match ends.
//
// Algorithm (pure replay — same data `computeInnings` uses):
//  1. Read all ball events for both innings from `liveGameStates/{id}/ballEvents`.
//  2. Derive per-player batting & bowling scorecards for this match.
//  3. For every player that touched the match, fetch their current Firestore
//     document and merge the new numbers in.
//  4. Write every update in a single `writeBatch` → atomic, all-or-nothing.
//
// Guard: `liveGameStates/{matchId}.statsCommitted === true` means stats have
// already been committed for this match. Re-calling is a no-op.
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection, doc, getDoc, getDocs,
  query, orderBy, where, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import type { BallEvent } from '../types/liveScore'
import type {
  BattingStats, BowlingStats, FieldingStats,
  PlayerStatsPayload, MatchFormat,
} from '../types/player'
import { emptyBattingStats, emptyBowlingStats, emptyFieldingStats } from '../types/player'

const LIVE_STATES = 'liveGameStates'
const BALL_EVENTS = 'ballEvents'
const PLAYERS     = 'players'

// ── Internal structures ───────────────────────────────────────────────────────

interface MatchBattingLine {
  runs:       number
  balls:      number
  fours:      number
  sixes:      number
  isOut:      boolean
  dismissal:  string
}

interface MatchBowlingLine {
  balls:        number    // legal deliveries
  runsConceded: number
  wickets:      number
  wides:        number
  noBalls:      number
  maidens:      number
}

interface MatchFieldingLine {
  catches:   number
  runOuts:   number
  stumpings: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bestFigures(current: string, newWkts: number, newRuns: number): string {
  const [cW, cR] = current.split('/').map(Number)
  if (newWkts > cW || (newWkts === cW && newRuns < cR)) {
    return `${newWkts}/${newRuns}`
  }
  return current
}

function ballsToOversFloat(balls: number): number {
  return parseFloat(`${Math.floor(balls / 6)}.${balls % 6}`)
}

// ── Replay ball events → per-player lines ─────────────────────────────────────

function replayInnings(events: BallEvent[]): {
  batting:  Map<string, MatchBattingLine>
  bowling:  Map<string, MatchBowlingLine>
  fielding: Map<string, MatchFieldingLine>
} {
  const batting  = new Map<string, MatchBattingLine>()
  const bowling  = new Map<string, MatchBowlingLine>()
  const fielding = new Map<string, MatchFieldingLine>()

  const getB = (id: string) => batting.get(id)  ?? batting.set(id,  { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissal: '' }).get(id)!
  const getW = (id: string) => bowling.get(id)  ?? bowling.set(id,  { balls: 0, runsConceded: 0, wickets: 0, wides: 0, noBalls: 0, maidens: 0 }).get(id)!
  const getF = (id: string) => fielding.get(id) ?? fielding.set(id, { catches: 0, runOuts: 0, stumpings: 0 }).get(id)!

  // Track current over per bowler for maiden detection
  const overBalls = new Map<string, number>()   // bowlerId → balls this over
  const overRuns  = new Map<string, number>()   // bowlerId → runs this over
  let   prevOver  = -1

  for (const ball of events) {
    const striker = getB(ball.strikerId)
    const bwlr    = getW(ball.bowlerId)

    // ── Batting ───────────────────────────────────────────────────────────
    if (ball.isLegal) {
      striker.balls++
    }
    striker.runs += ball.runsScored
    if (ball.outcome === '4') striker.fours++
    if (ball.outcome === '6') striker.sixes++

    // ── Bowling ───────────────────────────────────────────────────────────
    if (ball.isLegal) {
      bwlr.balls++
      const ob = (overBalls.get(ball.bowlerId) ?? 0) + 1
      const or_ = (overRuns.get(ball.bowlerId) ?? 0) + ball.runsScored + ball.extras
      overBalls.set(ball.bowlerId, ob)
      overRuns.set(ball.bowlerId, or_)
    } else if (ball.outcome === 'wd') {
      bwlr.wides++
      const or_ = (overRuns.get(ball.bowlerId) ?? 0) + ball.extras
      overRuns.set(ball.bowlerId, or_)
    } else if (ball.outcome === 'nb') {
      bwlr.noBalls++
      const or_ = (overRuns.get(ball.bowlerId) ?? 0) + ball.extras
      overRuns.set(ball.bowlerId, or_)
    }
    bwlr.runsConceded += ball.runsScored + ball.extras

    // Maiden detection: when over changes, check if previous over had 0 runs
    if (prevOver !== -1 && ball.overNumber !== prevOver) {
      // Check all bowlers who bowled last over
      overBalls.forEach((_, bowlerId) => {
        const or_ = overRuns.get(bowlerId) ?? 0
        if (or_ === 0) {
          getW(bowlerId).maidens++
        }
      })
      // Reset over tracking for bowlers not bowling this over
      overBalls.clear()
      overRuns.clear()
    }
    prevOver = ball.overNumber

    // ── Wicket ────────────────────────────────────────────────────────────
    if (ball.outcome === 'W' && ball.wicket) {
      const w = ball.wicket
      // Batter out
      const outBatter = batting.get(w.batsmanId) ?? getB(w.batsmanId)
      outBatter.isOut    = true
      outBatter.dismissal = w.description

      // Bowler wicket (not run out, not retired)
      if (w.dismissalType !== 'run_out' && w.dismissalType !== 'retired') {
        bwlr.wickets++
      }

      // Fielder
      if (w.fielderId) {
        if (w.dismissalType === 'caught')   getF(w.fielderId).catches++
        if (w.dismissalType === 'stumped')  getF(w.fielderId).stumpings++
        if (w.dismissalType === 'run_out')  getF(w.fielderId).runOuts++
      }
    }

    if (ball.outcome === 'ro') {
      // Run out — attributed to non-striker's team fielder (no specific fielder id in ball)
      // Still mark the striker as out
      const outBatter = getB(ball.strikerId)
      outBatter.isOut    = true
      outBatter.dismissal = 'run out'
    }

    if (ball.outcome === 'rh') {
      // Retired hurt — not out
      const outBatter = getB(ball.strikerId)
      outBatter.isOut    = true
      outBatter.dismissal = 'retired hurt'
    }
  }

  // Final over maiden check
  if (prevOver !== -1) {
    overBalls.forEach((_, bowlerId) => {
      const or_ = overRuns.get(bowlerId) ?? 0
      if (or_ === 0 && (overBalls.get(bowlerId) ?? 0) >= 6) {
        getW(bowlerId).maidens++
      }
    })
  }

  return { batting, bowling, fielding }
}

// ── Merge a match line into existing career BattingStats ─────────────────────

function mergeBatting(existing: BattingStats, line: MatchBattingLine): BattingStats {
  const innings   = existing.innings + 1
  const notOuts   = line.isOut ? existing.notOuts : existing.notOuts + 1
  const runs      = existing.runs + line.runs
  const balls     = existing.ballsFaced + line.balls
  const fours     = existing.fours + line.fours
  const sixes     = existing.sixes + line.sixes
  const highScore = Math.max(existing.highScore, line.runs)
  const ducks     = line.runs === 0 && line.isOut ? existing.ducks + 1 : existing.ducks
  const fifties   = line.runs >= 50 && line.runs < 100 ? existing.fifties + 1 : existing.fifties
  const hundreds  = line.runs >= 100 ? existing.hundreds + 1 : existing.hundreds
  const dismissals = innings - notOuts
  const average    = dismissals > 0 ? parseFloat((runs / dismissals).toFixed(2)) : runs
  const strikeRate = balls > 0 ? parseFloat(((runs / balls) * 100).toFixed(2)) : 0

  return {
    matches: existing.matches + 1,
    innings, notOuts, runs, highScore, average, strikeRate,
    ballsFaced: balls, fours, sixes, fifties, hundreds, ducks,
  }
}

// ── Merge a match line into existing career BowlingStats ─────────────────────

function mergeBowling(existing: BowlingStats, line: MatchBowlingLine): BowlingStats {
  const balls       = existing.balls + line.balls
  const overs       = ballsToOversFloat(balls)
  const runs        = existing.runsConceded + line.runsConceded
  const wickets     = existing.wickets + line.wickets
  const maidens     = existing.maidens + line.maidens
  const economy     = balls > 0 ? parseFloat(((runs / balls) * 6).toFixed(2)) : 0
  const average     = wickets > 0 ? parseFloat((runs / wickets).toFixed(2)) : 0
  const strikeRate  = wickets > 0 ? parseFloat((balls / wickets).toFixed(2)) : 0
  const bestFigs    = bestFigures(existing.bestFigures || '0/0', line.wickets, line.runsConceded)
  const threeWkts   = line.wickets >= 3 ? existing.threeWickets + 1 : existing.threeWickets
  const fiveWkts    = line.wickets >= 5 ? existing.fiveWickets + 1 : existing.fiveWickets
  const tenWkts     = line.wickets >= 10 ? existing.tenWickets + 1 : existing.tenWickets

  return {
    matches: existing.matches + 1,
    innings: existing.innings + 1,
    overs, balls, runsConceded: runs, wickets, economy, average, strikeRate,
    bestFigures: bestFigs, threeWickets: threeWkts, fiveWickets: fiveWkts,
    tenWickets: tenWkts, maidens,
  }
}

// ── Merge fielding ────────────────────────────────────────────────────────────

function mergeFielding(existing: FieldingStats, line: MatchFieldingLine): FieldingStats {
  return {
    catches:         existing.catches + line.catches,
    runOuts:         existing.runOuts + line.runOuts,
    directRunOuts:   existing.directRunOuts,
    assistedRunOuts: existing.assistedRunOuts,
    stumpings:       existing.stumpings + line.stumpings,
    droppedCatches:  existing.droppedCatches,
  }
}

// ── Format key mapping ────────────────────────────────────────────────────────

type FormatKey = 'battingT20' | 'battingODI' | 'battingTest' | 'batting'
               | 'bowlingT20' | 'bowlingODI' | 'bowlingTest' | 'bowling'

function getBattingKey(format: MatchFormat): FormatKey {
  if (format === 'T20' || format === 'T10') return 'battingT20'
  if (format === 'ODI')                     return 'battingODI'
  if (format === 'Test')                    return 'battingTest'
  return 'batting'   // Custom → overall only
}

function getBowlingKey(format: MatchFormat): FormatKey {
  if (format === 'T20' || format === 'T10') return 'bowlingT20'
  if (format === 'ODI')                     return 'bowlingODI'
  if (format === 'Test')                    return 'bowlingTest'
  return 'bowling'
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface CommitMatchStatsParams {
  matchId:   string
  format:    MatchFormat
  /** Result from the perspective of team1 */
  result:    'team1' | 'team2' | 'tie' | 'no_result' | ''
  team1Id:   string
  team2Id:   string
}

/**
 * Commits career stats for every player who participated in this match.
 *
 * Idempotent: if `liveGameStates/{matchId}.statsCommitted === true`, returns
 * immediately without touching any player documents.
 *
 * Uses a single `writeBatch` for atomicity — either all stats are written or none.
 */
export async function commitMatchStats(p: CommitMatchStatsParams): Promise<void> {
  console.log('[playerStats] commitMatchStats → matchId:', p.matchId, 'format:', p.format)

  // ── Guard: already committed? ──────────────────────────────────────────────
  const liveDocRef = doc(db, LIVE_STATES, p.matchId)
  const liveSnap   = await getDoc(liveDocRef)
  if (liveSnap.exists() && liveSnap.data()?.statsCommitted === true) {
    console.log('[playerStats] already committed — skipping')
    return
  }

  // ── Read all ball events ───────────────────────────────────────────────────
  const eventsSnap = await getDocs(
    query(collection(db, LIVE_STATES, p.matchId, BALL_EVENTS), orderBy('seq', 'asc'))
  )
  const allEvents  = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BallEvent))
  const inn1Events = allEvents.filter(e => e.inningsIndex === 0)
  const inn2Events = allEvents.filter(e => e.inningsIndex === 1)

  console.log('[playerStats] inn1 events:', inn1Events.length, '| inn2 events:', inn2Events.length)

  // ── Replay both innings ────────────────────────────────────────────────────
  const inn1 = replayInnings(inn1Events)
  const inn2 = replayInnings(inn2Events)

  // ── Collect all player IDs that touched the match ─────────────────────────
  const allPlayerIds = new Set<string>([
    ...inn1.batting.keys(),
    ...inn1.bowling.keys(),
    ...inn1.fielding.keys(),
    ...inn2.batting.keys(),
    ...inn2.bowling.keys(),
    ...inn2.fielding.keys(),
  ])

  console.log('[playerStats] updating', allPlayerIds.size, 'players')

  // Innings 1 batting team = team1 (or whatever innings1.battingTeamId is —
  // we use event strikerId/bowlerId to look up the players collection directly,
  // so we don't need to know which team each player is on).

  // ── Fetch current player docs and build updates ────────────────────────────
  const batch = writeBatch(db)

  for (const playerId of allPlayerIds) {
    const playerSnap = await getDoc(doc(db, PLAYERS, playerId))
    if (!playerSnap.exists()) {
      console.warn('[playerStats] player not found in Firestore:', playerId)
      continue
    }

    const data = playerSnap.data() as Record<string, unknown>

    // Current career stats (with defaults for any missing fields)
    let batting      = (data.batting      as BattingStats)  ?? emptyBattingStats()
    let battingFmt   = (data[getBattingKey(p.format)] as BattingStats) ?? emptyBattingStats()
    let bowling      = (data.bowling      as BowlingStats)  ?? emptyBowlingStats()
    let bowlingFmt   = (data[getBowlingKey(p.format)] as BowlingStats) ?? emptyBowlingStats()
    let fielding     = (data.fielding     as FieldingStats) ?? emptyFieldingStats()

    // Determine which innings this player batted/bowled in
    // (check both innings — a player only bats once but could theoretically
    //  bowl in both if something unusual happened)

    // ── Batting contributions ─────────────────────────────────────────────
    const batLine1 = inn1.batting.get(playerId) ?? null
    const batLine2 = inn2.batting.get(playerId) ?? null

    if (batLine1) {
      batting    = mergeBatting(batting,    batLine1)
      battingFmt = mergeBatting(battingFmt, batLine1)
    }
    if (batLine2) {
      batting    = mergeBatting(batting,    batLine2)
      battingFmt = mergeBatting(battingFmt, batLine2)
    }

    // ── Bowling contributions ─────────────────────────────────────────────
    const bwlLine1 = inn1.bowling.get(playerId) ?? null
    const bwlLine2 = inn2.bowling.get(playerId) ?? null

    if (bwlLine1 && bwlLine1.balls > 0) {
      bowling    = mergeBowling(bowling,    bwlLine1)
      bowlingFmt = mergeBowling(bowlingFmt, bwlLine1)
    }
    if (bwlLine2 && bwlLine2.balls > 0) {
      bowling    = mergeBowling(bowling,    bwlLine2)
      bowlingFmt = mergeBowling(bowlingFmt, bwlLine2)
    }

    // ── Fielding contributions ────────────────────────────────────────────
    const fldLine1 = inn1.fielding.get(playerId) ?? null
    const fldLine2 = inn2.fielding.get(playerId) ?? null
    if (fldLine1) fielding = mergeFielding(fielding, fldLine1)
    if (fldLine2) fielding = mergeFielding(fielding, fldLine2)

    // ── Top-level aggregate summary fields ────────────────────────────────
    const totalMatches  = (data.matches as number ?? 0) + 1
    const totalRuns     = batting.runs
    const totalWickets  = bowling.wickets
    const topAverage    = batting.average
    const topSR         = batting.strikeRate
    const topEconomy    = bowling.economy

    // ── Build the payload ─────────────────────────────────────────────────
    const update: PlayerStatsPayload & Record<string, unknown> = {
      matches:    totalMatches,
      runs:       totalRuns,
      wickets:    totalWickets,
      average:    topAverage,
      strikeRate: topSR,
      economy:    topEconomy,
      batting,
      bowling,
      fielding,
      [getBattingKey(p.format)]: battingFmt,
      [getBowlingKey(p.format)]: bowlingFmt,
    }

    batch.update(doc(db, PLAYERS, playerId), update as Record<string, unknown>)
    console.log('[playerStats] batched update for player:', playerId,
      '| runs:', totalRuns, '| wickets:', totalWickets)
  }

  // ── Mark as committed on the liveGameState doc ────────────────────────────
  batch.update(liveDocRef, { statsCommitted: true })

  // ── Commit ────────────────────────────────────────────────────────────────
  await batch.commit()
  console.log('[playerStats] commitMatchStats ✓ — batch committed for', allPlayerIds.size, 'players')
}

// ── Stat Recalculation Engine (Phase 3) ──────────────────────────────────────
//
// When a completed match is deleted, cancelled, edited, or voided, the
// additive commitMatchStats is no longer valid. We must RESET all player
// stats for the tournament and REPLAY every remaining completed match.
//
// Algorithm:
//  1. Fetch all players in the tournament (via tournamentId field).
//  2. Reset their stats to zero.
//  3. Fetch all completed matches for the tournament.
//  4. For each completed match that has a liveGameState, replay ball events
//     and re-commit stats (clearing the statsCommitted flag first).
//  5. Write all updates atomically.
//
// This function is IDEMPOTENT — safe to call multiple times.

function zeroPlayerStats(): Record<string, unknown> {
  return {
    matches: 0, runs: 0, wickets: 0, average: 0, strikeRate: 0, economy: 0,
    batting:     emptyBattingStats(),
    bowling:     emptyBowlingStats(),
    fielding:    emptyFieldingStats(),
    battingT20:  emptyBattingStats(),
    bowlingT20:  emptyBowlingStats(),
    battingODI:  emptyBattingStats(),
    bowlingODI:  emptyBowlingStats(),
    battingTest: emptyBattingStats(),
    bowlingTest: emptyBowlingStats(),
  }
}

export async function recalculateAllPlayerStats(tournamentId: string): Promise<void> {
  console.log('[recalcStats] Starting full recalculation for tournament:', tournamentId)

  // ── Step 1: Fetch all players in this tournament ──────────────────────────
  const playersSnap = await getDocs(
    query(collection(db, PLAYERS), where('tournamentId', '==', tournamentId))
  )
  if (playersSnap.empty) {
    console.log('[recalcStats] No players found for tournament — nothing to reset')
    return
  }

  // ── Step 2: Reset all player stats to zero (batched) ──────────────────────
  const resetBatch = writeBatch(db)
  playersSnap.docs.forEach(d => {
    resetBatch.update(d.ref, zeroPlayerStats())
  })
  await resetBatch.commit()
  console.log('[recalcStats] Reset', playersSnap.size, 'players to zero')

  // ── Step 3: Fetch all completed matches for this tournament ────────────────
  const matchesSnap = await getDocs(
    query(
      collection(db, 'matches'),
      where('tournamentId', '==', tournamentId),
      where('status',       '==', 'completed')
    )
  )
  console.log('[recalcStats] Found', matchesSnap.size, 'completed matches to replay')

  // ── Step 4: Replay each match's stats ─────────────────────────────────────
  for (const matchDoc of matchesSnap.docs) {
    const matchData = matchDoc.data() as Record<string, unknown>
    const matchId   = matchDoc.id
    const format    = (matchData.format   as MatchFormat) ?? 'T20'
    const result    = (matchData.result   as CommitMatchStatsParams['result']) ?? ''
    const team1Id   = (matchData.team1Id  as string) ?? ''
    const team2Id   = (matchData.team2Id  as string) ?? ''

    // Clear the statsCommitted guard so commitMatchStats re-runs
    const liveDocRef = doc(db, LIVE_STATES, matchId)
    const liveSnap   = await getDoc(liveDocRef)
    if (liveSnap.exists()) {
      const clearBatch = writeBatch(db)
      clearBatch.update(liveDocRef, { statsCommitted: false })
      await clearBatch.commit()

      // Re-commit stats for this match from ball events
      await commitMatchStats({ matchId, format, result, team1Id, team2Id })
    } else {
      console.log('[recalcStats] No liveGameState for match:', matchId, '— skipping (no ball data)')
    }
  }

  console.log('[recalcStats] Full recalculation complete for tournament:', tournamentId)
}
