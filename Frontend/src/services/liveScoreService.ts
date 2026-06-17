// src/services/liveScoreService.ts
// Live Scoring Firestore service — ball events + LiveGameState.
// ─────────────────────────────────────────────────────────────────────────────
// KEY FIXES:
// • Removed compound Firestore queries (no composite index needed)
// • Full striker rotation logic (odd runs + end of over)
// • New batter selection after wicket
// • Partnership + projected score tracking
// • Undo last ball support
// • New outcomes: '5', 'ro' (run out), 'rh' (retired hurt)
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  BallEvent, BallOutcome, DismissalType,
  LiveGameState, LiveInningsState, LiveBatterEntry,
  LiveBowlerEntry, LiveGameInitPayload,
} from '../types/liveScore'

const LIVE_STATES = 'liveGameStates'
const BALL_EVENTS = 'ballEvents'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function ballsToOversDecimal(legalBalls: number): number {
  return parseFloat(`${Math.floor(legalBalls / 6)}.${legalBalls % 6}`)
}

function isLegalDelivery(o: BallOutcome): boolean {
  return o !== 'wd' && o !== 'nb'
}

function outcomeBatRuns(o: BallOutcome): number {
  if (['W', 'ro', 'rh', 'dot', 'wd', 'nb', 'lb', 'b'].includes(o)) return 0
  return parseInt(o, 10) || 0
}

function outcomeExtras(o: BallOutcome, extra = 0): number {
  if (o === 'wd' || o === 'nb') return 1 + extra
  if (o === 'lb' || o === 'b')  return extra
  return 0
}

function shouldRotateStrike(o: BallOutcome): boolean {
  const runs = outcomeBatRuns(o)
  return runs % 2 === 1   // 1, 3, 5 → rotate
}

function emptyInnings(
  battingTeamId: string, battingTeamName: string,
  bowlingTeamId: string, bowlingTeamName: string,
): LiveInningsState {
  return {
    battingTeamId, battingTeamName, bowlingTeamId, bowlingTeamName,
    runs: 0, wickets: 0, legalBalls: 0, oversDecimal: 0,
    extras: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0,
    currentRunRate: 0,
    partnership: { runs: 0, balls: 0 },
    projectedScore: 0,
    batters: [], bowlers: [],
    currentOverEvents: [], isComplete: false,
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initLiveGame(payload: LiveGameInitPayload): Promise<void> {
  const {
    matchId, innings1,
    strikerId, strikerName, nonStrikerId, nonStrikerName, bowlerId, bowlerName,
  } = payload
  await setDoc(doc(db, LIVE_STATES, matchId), {
    matchId, currentInnings: 0,
    innings1: emptyInnings(
      innings1.battingTeamId, innings1.battingTeamName,
      innings1.bowlingTeamId, innings1.bowlingTeamName,
    ),
    innings2: null,
    strikerId, strikerName,
    nonStrikerId, nonStrikerName,
    bowlerId, bowlerName,
    isActive: true, lastUpdated: serverTimestamp(),
  })
}

// ── Record Ball ───────────────────────────────────────────────────────────────

export interface RecordBallParams {
  matchId: string; inningsIndex: 0 | 1; overNumber: number; ballInOver: number
  outcome: BallOutcome; extraRuns?: number
  wicket?: {
    dismissalType: DismissalType
    batsmanId: string; batsmanName: string
    bowlerId: string; bowlerName: string
    fielderId?: string; fielderName?: string
    description: string
  }
  strikerId: string; strikerName: string
  nonStrikerId: string; nonStrikerName: string
  bowlerId: string; bowlerName: string
}

export async function recordBall(p: RecordBallParams): Promise<string> {
  const extras  = outcomeExtras(p.outcome, p.extraRuns ?? 0)
  const batRuns = outcomeBatRuns(p.outcome)
  const ref = await addDoc(collection(db, LIVE_STATES, p.matchId, BALL_EVENTS), {
    matchId: p.matchId, inningsIndex: p.inningsIndex,
    overNumber: p.overNumber, ballInOver: p.ballInOver,
    outcome: p.outcome, runsScored: batRuns, extras,
    totalRuns: batRuns + extras, isLegal: isLegalDelivery(p.outcome),
    wicket: p.wicket ?? null,
    strikerId: p.strikerId, strikerName: p.strikerName,
    nonStrikerId: p.nonStrikerId, nonStrikerName: p.nonStrikerName,
    bowlerId: p.bowlerId, bowlerName: p.bowlerName,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// ── Undo last ball ────────────────────────────────────────────────────────────

export async function undoLastBall(matchId: string, inningsIndex: 0 | 1): Promise<void> {
  // Fetch all events ordered by createdAt, filter by innings, delete the last one
  const snap = await getDocs(
    query(collection(db, LIVE_STATES, matchId, BALL_EVENTS), orderBy('createdAt', 'asc'))
  )
  const events = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as BallEvent & { id: string }))
    .filter(e => e.inningsIndex === inningsIndex)

  if (events.length === 0) return

  const last = events[events.length - 1]
  await deleteDoc(doc(db, LIVE_STATES, matchId, BALL_EVENTS, last.id))
}

// ── Query helpers (no compound queries — index-safe) ──────────────────────────

export async function getBallEvents(matchId: string, inningsIndex: 0 | 1): Promise<BallEvent[]> {
  const snap = await getDocs(
    query(collection(db, LIVE_STATES, matchId, BALL_EVENTS), orderBy('createdAt', 'asc'))
  )
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as BallEvent))
    .filter(e => e.inningsIndex === inningsIndex)
}

export function subscribeToLiveState(matchId: string, callback: (s: LiveGameState | null) => void): Unsubscribe {
  return onSnapshot(doc(db, LIVE_STATES, matchId), snap => {
    if (!snap.exists()) { callback(null); return }
    callback({ matchId: snap.id, ...snap.data() } as LiveGameState)
  })
}

export function subscribeToCurrentOverBalls(
  matchId: string, inningsIndex: 0 | 1, overNumber: number,
  callback: (e: BallEvent[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, LIVE_STATES, matchId, BALL_EVENTS), orderBy('createdAt', 'asc')),
    snap => callback(
      snap.docs
        .map(d => ({ id: d.id, ...d.data() } as BallEvent))
        .filter(e => e.inningsIndex === inningsIndex && e.overNumber === overNumber)
    ),
  )
}

export async function getLiveState(matchId: string): Promise<LiveGameState | null> {
  const snap = await getDoc(doc(db, LIVE_STATES, matchId))
  if (!snap.exists()) return null
  return { matchId: snap.id, ...snap.data() } as LiveGameState
}

// ── computeInnings ────────────────────────────────────────────────────────────

interface ComputedInnings {
  state: LiveInningsState
  strikerId: string; strikerName: string
  nonStrikerId: string; nonStrikerName: string
  bowlerId: string; bowlerName: string
}

function computeInnings(
  events: BallEvent[],
  battingTeamId: string, battingTeamName: string,
  bowlingTeamId: string, bowlingTeamName: string,
  totalOvers: number, target?: number,
): ComputedInnings {
  const state = emptyInnings(battingTeamId, battingTeamName, bowlingTeamId, bowlingTeamName)
  if (target) { state.target = target; state.runsRequired = target }

  const batterMap = new Map<string, LiveBatterEntry>()
  const bowlerMap = new Map<string, LiveBowlerEntry>()

  let strikerId      = ''
  let strikerName    = ''
  let nonStrikerId   = ''
  let nonStrikerName = ''
  let bowlerId       = ''
  let bowlerName     = ''
  let prevOverNumber = -1
  // Partnership tracking
  let partnershipRuns  = 0
  let partnershipBalls = 0

  for (const ball of events) {
    // ── First ball: seed from stored IDs ────────────────────────────────────
    if (strikerId === '') {
      strikerId      = ball.strikerId
      strikerName    = ball.strikerName
      nonStrikerId   = ball.nonStrikerId
      nonStrikerName = ball.nonStrikerName
    }
    bowlerId   = ball.bowlerId
    bowlerName = ball.bowlerName

    // ── New over → rotate strike + reset partnership balls ──────────────────
    if (prevOverNumber !== -1 && ball.overNumber !== prevOverNumber) {
      const tmp = strikerId;   strikerId   = nonStrikerId;   nonStrikerId   = tmp
      const tmpN = strikerName; strikerName = nonStrikerName; nonStrikerName = tmpN
    }
    prevOverNumber = ball.overNumber

    // ── Ensure batter/bowler map entries ────────────────────────────────────
    if (!batterMap.has(strikerId)) {
      batterMap.set(strikerId, {
        playerId: strikerId, playerName: strikerName,
        runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissal: '', isOnStrike: true,
      })
    }
    if (!batterMap.has(nonStrikerId) && nonStrikerId) {
      batterMap.set(nonStrikerId, {
        playerId: nonStrikerId, playerName: nonStrikerName,
        runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissal: '', isOnStrike: false,
      })
    }
    if (!bowlerMap.has(bowlerId)) {
      bowlerMap.set(bowlerId, {
        playerId: bowlerId, playerName: bowlerName,
        overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0,
        wides: 0, noBalls: 0, isCurrentBowler: false,
      })
    }

    // ── Scoring ──────────────────────────────────────────────────────────────
    state.runs   += ball.totalRuns
    state.extras += ball.extras
    if (ball.outcome === 'wd') state.wides   += ball.extras
    if (ball.outcome === 'nb') state.noBalls += ball.extras
    if (ball.outcome === 'lb') state.legByes += ball.extras
    if (ball.outcome === 'b')  state.byes    += ball.extras

    const striker = batterMap.get(strikerId)!
    const bwlr    = bowlerMap.get(bowlerId)!

    striker.runs += ball.runsScored
    if (ball.outcome === '4') striker.fours++
    if (ball.outcome === '6') striker.sixes++

    bwlr.runs += ball.runsScored + ball.extras
    if (ball.outcome === 'wd') bwlr.wides++
    if (ball.outcome === 'nb') bwlr.noBalls++

    if (ball.isLegal) {
      state.legalBalls++
      striker.balls++
      bwlr.balls++
      bwlr.overs = ballsToOversDecimal(bwlr.balls)
      partnershipBalls++
    }
    partnershipRuns += ball.totalRuns

    // ── Wicket / run-out / retired ───────────────────────────────────────────
    if (ball.wicket || ball.outcome === 'ro' || ball.outcome === 'rh') {
      state.wickets++
      const bt = ball.wicket ? batterMap.get(ball.wicket.batsmanId) : batterMap.get(strikerId)
      if (bt) { bt.isOut = true; bt.dismissal = ball.wicket?.description ?? ball.outcome }
      if (ball.wicket?.bowlerId === bowlerId) bwlr.wickets++
      // Reset partnership on wicket
      partnershipRuns  = 0
      partnershipBalls = 0
      // New batter comes in at striker end (next ball carries new strikerId)
      strikerId   = ball.strikerId
      strikerName = ball.strikerName
    }

    // ── Strike rotation after odd bat runs (1, 3, 5) ─────────────────────────
    if (ball.isLegal && shouldRotateStrike(ball.outcome) && ball.outcome !== 'W' && ball.outcome !== 'ro') {
      const tmp = strikerId;   strikerId   = nonStrikerId;   nonStrikerId   = tmp
      const tmpN = strikerName; strikerName = nonStrikerName; nonStrikerName = tmpN
    }
  }

  // ── Finalise ──────────────────────────────────────────────────────────────
  state.oversDecimal   = ballsToOversDecimal(state.legalBalls)
  state.currentRunRate = state.legalBalls > 0
    ? parseFloat(((state.runs / state.legalBalls) * 6).toFixed(2)) : 0

  // Projected score
  const remainingOvers = totalOvers - state.legalBalls / 6
  state.projectedScore = Math.round(state.runs + state.currentRunRate * remainingOvers)

  if (target) {
    state.runsRequired    = Math.max(0, target - state.runs)
    const remBalls        = Math.max(0, totalOvers * 6 - state.legalBalls)
    state.ballsRemaining  = remBalls
    state.requiredRunRate = remBalls > 0
      ? parseFloat(((state.runsRequired / remBalls) * 6).toFixed(2)) : 0
  }

  // Partnership
  state.partnership = { runs: partnershipRuns, balls: partnershipBalls }

  if (bowlerId) { const b = bowlerMap.get(bowlerId); if (b) b.isCurrentBowler = true }

  state.isComplete =
    state.wickets >= 10 ||
    state.legalBalls >= totalOvers * 6 ||
    (!!target && state.runs >= target)

  state.batters = Array.from(batterMap.values())
  state.bowlers = Array.from(bowlerMap.values())

  const lastEvent = events[events.length - 1]
  const curOver   = lastEvent ? lastEvent.overNumber : 0
  state.currentOverEvents = events.filter(e => e.overNumber === curOver)

  return { state, strikerId, strikerName, nonStrikerId, nonStrikerName, bowlerId, bowlerName }
}

// ── Recompute & Save ──────────────────────────────────────────────────────────

export async function recomputeAndSaveLiveState(
  matchId: string, totalOvers: number,
  team1Id: string, team1Name: string,
  team2Id: string, team2Name: string,
): Promise<void> {
  const [ev1, ev2] = await Promise.all([
    getBallEvents(matchId, 0),
    getBallEvents(matchId, 1),
  ])

  const res1 = computeInnings(ev1, team1Id, team1Name, team2Id, team2Name, totalOvers)
  const inn1 = res1.state

  const res2 = computeInnings(ev2, team2Id, team2Name, team1Id, team1Name, totalOvers, inn1.runs + 1)
  const inn2 = res2.state

  const ci: 0 | 1 = inn1.isComplete ? 1 : 0
  const active    = ci === 0 ? res1 : res2

  await setDoc(doc(db, LIVE_STATES, matchId), {
    matchId, currentInnings: ci,
    innings1: inn1,
    innings2: inn1.isComplete ? inn2 : null,
    strikerId:      active.strikerId,
    strikerName:    active.strikerName,
    nonStrikerId:   active.nonStrikerId,
    nonStrikerName: active.nonStrikerName,
    bowlerId:       active.bowlerId,
    bowlerName:     active.bowlerName,
    isActive:       !inn2.isComplete,
    lastUpdated:    serverTimestamp(),
  })
}
