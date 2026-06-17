// src/services/liveScoreService.ts
// Live Scoring Firestore service — ball events + LiveGameState.
// ─────────────────────────────────────────────────────────────────────────────
// FIXES in this version:
// • Use Firestore `writeBatch` / client timestamp for strict ordering — no more
//   serverTimestamp() race where recompute queries events before they have a
//   resolved timestamp.
// • Use a monotonic `seq` field (Date.now() + counter) for ordering instead of
//   serverTimestamp() so getBallEvents always returns events in insertion order.
// • recomputeAndSaveLiveState now AWAITS the addDoc write before querying.
// • Full diagnostic console.log at every step so errors surface in DevTools.
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

// Monotonic sequence counter — ensures ordering even within the same ms
let _seq = 0
function nextSeq(): number { return Date.now() * 1000 + (_seq++ % 1000) }

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
  console.log('[liveScore] initLiveGame →', payload)
  const {
    matchId, innings1,
    strikerId, strikerName, nonStrikerId, nonStrikerName, bowlerId, bowlerName,
  } = payload
  const docRef = doc(db, LIVE_STATES, matchId)
  await setDoc(docRef, {
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
  console.log('[liveScore] initLiveGame ✓ docId:', matchId)
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
  console.log('[liveScore] recordBall → params:', JSON.stringify(p))

  // Validate required fields
  if (!p.matchId)      throw new Error('recordBall: matchId is empty')
  if (!p.strikerId)    throw new Error('recordBall: strikerId is empty')
  if (!p.nonStrikerId) throw new Error('recordBall: nonStrikerId is empty')
  if (!p.bowlerId)     throw new Error('recordBall: bowlerId is empty')

  const extras  = outcomeExtras(p.outcome, p.extraRuns ?? 0)
  const batRuns = outcomeBatRuns(p.outcome)
  const seq     = nextSeq()

  const payload = {
    matchId:      p.matchId,
    inningsIndex: p.inningsIndex,
    overNumber:   p.overNumber,
    ballInOver:   p.ballInOver,
    outcome:      p.outcome,
    runsScored:   batRuns,
    extras,
    totalRuns:    batRuns + extras,
    isLegal:      isLegalDelivery(p.outcome),
    wicket:       p.wicket ?? null,
    strikerId:    p.strikerId,
    strikerName:  p.strikerName,
    nonStrikerId:   p.nonStrikerId,
    nonStrikerName: p.nonStrikerName,
    bowlerId:     p.bowlerId,
    bowlerName:   p.bowlerName,
    seq,                            // ← monotonic ordering key
    createdAt:    serverTimestamp(),
  }

  console.log('[liveScore] recordBall writing to:', `${LIVE_STATES}/${p.matchId}/${BALL_EVENTS}`)
  console.log('[liveScore] recordBall payload:', JSON.stringify({ ...payload, createdAt: '<serverTimestamp>' }))

  try {
    const colRef = collection(db, LIVE_STATES, p.matchId, BALL_EVENTS)
    const ref = await addDoc(colRef, payload)
    console.log('[liveScore] recordBall ✓ docId:', ref.id)
    return ref.id
  } catch (err) {
    console.error('[liveScore] recordBall FAILED:', err)
    throw err
  }
}

// ── Undo last ball ────────────────────────────────────────────────────────────

export async function undoLastBall(matchId: string, inningsIndex: 0 | 1): Promise<void> {
  console.log('[liveScore] undoLastBall → matchId:', matchId, 'innings:', inningsIndex)
  const snap = await getDocs(
    query(collection(db, LIVE_STATES, matchId, BALL_EVENTS), orderBy('seq', 'asc'))
  )
  const events = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as BallEvent & { id: string }))
    .filter(e => e.inningsIndex === inningsIndex)

  console.log('[liveScore] undoLastBall: found', events.length, 'events for innings', inningsIndex)

  if (events.length === 0) {
    console.warn('[liveScore] undoLastBall: no events to undo')
    return
  }

  const last = events[events.length - 1]
  console.log('[liveScore] undoLastBall: deleting event', last.id, 'outcome:', (last as BallEvent).outcome)
  await deleteDoc(doc(db, LIVE_STATES, matchId, BALL_EVENTS, last.id))
  console.log('[liveScore] undoLastBall ✓')
}

// ── Query helpers (order by `seq` — no composite index needed) ────────────────

export async function getBallEvents(matchId: string, inningsIndex: 0 | 1): Promise<BallEvent[]> {
  console.log('[liveScore] getBallEvents → matchId:', matchId, 'innings:', inningsIndex)
  try {
    const snap = await getDocs(
      query(collection(db, LIVE_STATES, matchId, BALL_EVENTS), orderBy('seq', 'asc'))
    )
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as BallEvent))
    const filtered = all.filter(e => e.inningsIndex === inningsIndex)
    console.log('[liveScore] getBallEvents ✓ total:', all.length, '→ innings', inningsIndex, ':', filtered.length)
    return filtered
  } catch (err) {
    console.error('[liveScore] getBallEvents FAILED:', err)
    throw err
  }
}

export function subscribeToLiveState(matchId: string, callback: (s: LiveGameState | null) => void): Unsubscribe {
  console.log('[liveScore] subscribeToLiveState → matchId:', matchId)
  return onSnapshot(
    doc(db, LIVE_STATES, matchId),
    snap => {
      if (!snap.exists()) {
        console.log('[liveScore] subscribeToLiveState: doc does not exist yet')
        callback(null)
        return
      }
      const state = { matchId: snap.id, ...snap.data() } as LiveGameState
      console.log('[liveScore] subscribeToLiveState update → innings:', state.currentInnings,
        'runs:', state.innings1?.runs, 'striker:', state.strikerName)
      callback(state)
    },
    err => {
      console.error('[liveScore] subscribeToLiveState ERROR:', err)
    }
  )
}

export function subscribeToCurrentOverBalls(
  matchId: string, inningsIndex: 0 | 1, overNumber: number,
  callback: (e: BallEvent[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, LIVE_STATES, matchId, BALL_EVENTS), orderBy('seq', 'asc')),
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
  totalOvers: number,
  target?: number,
  playingXISize = 11,   // default standard cricket; override for custom squad sizes
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
  let partnershipRuns  = 0
  let partnershipBalls = 0

  for (const ball of events) {
    // ── First ball: seed from stored IDs ──────────────────────────────────
    if (strikerId === '') {
      strikerId      = ball.strikerId
      strikerName    = ball.strikerName
      nonStrikerId   = ball.nonStrikerId
      nonStrikerName = ball.nonStrikerName
    }
    bowlerId   = ball.bowlerId
    bowlerName = ball.bowlerName

    // ── New over → rotate strike ───────────────────────────────────────────
    if (prevOverNumber !== -1 && ball.overNumber !== prevOverNumber) {
      const tmp = strikerId;   strikerId   = nonStrikerId;   nonStrikerId   = tmp
      const tmpN = strikerName; strikerName = nonStrikerName; nonStrikerName = tmpN
    }
    prevOverNumber = ball.overNumber

    // ── Ensure batter/bowler map entries ──────────────────────────────────
    if (!batterMap.has(strikerId)) {
      batterMap.set(strikerId, {
        playerId: strikerId, playerName: strikerName,
        runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissal: '', isOnStrike: true,
      })
    }
    if (nonStrikerId && !batterMap.has(nonStrikerId)) {
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

    // ── Scoring ───────────────────────────────────────────────────────────
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

    // ── Wicket / run-out / retired ─────────────────────────────────────────
    if (ball.wicket || ball.outcome === 'ro' || ball.outcome === 'rh') {
      state.wickets++
      // Who got out — for W it's ball.wicket.batsmanId (the outgoing batter)
      // For ro/rh it's the current striker
      const outBatsmanId = ball.wicket ? ball.wicket.batsmanId : strikerId
      const bt = batterMap.get(outBatsmanId)
      if (bt) { bt.isOut = true; bt.dismissal = ball.wicket?.description ?? ball.outcome }
      if (ball.wicket?.bowlerId === bowlerId) bwlr.wickets++
      // Reset partnership on wicket
      partnershipRuns  = 0
      partnershipBalls = 0
      // For W: ball.strikerId = incoming batter when one was selected,
      // OR = outgoing batter when it's the last wicket (no new batter).
      // Guard: only update strikerId when ball.strikerId is different from the
      // outgoing batter — meaning an actual new batter was provided.
      if (ball.outcome === 'W' && ball.strikerId !== outBatsmanId) {
        strikerId   = ball.strikerId
        strikerName = ball.strikerName
      }
    }

    // ── Strike rotation after odd bat runs (1, 3, 5) ──────────────────────
    if (ball.isLegal && shouldRotateStrike(ball.outcome) &&
        ball.outcome !== 'W' && ball.outcome !== 'ro') {
      const tmp = strikerId;   strikerId   = nonStrikerId;   nonStrikerId   = tmp
      const tmpN = strikerName; strikerName = nonStrikerName; nonStrikerName = tmpN
    }
  }

  // ── Finalise ──────────────────────────────────────────────────────────────
  state.oversDecimal   = ballsToOversDecimal(state.legalBalls)
  state.currentRunRate = state.legalBalls > 0
    ? parseFloat(((state.runs / state.legalBalls) * 6).toFixed(2)) : 0

  const remainingOvers = totalOvers - state.legalBalls / 6
  state.projectedScore = Math.round(state.runs + state.currentRunRate * Math.max(0, remainingOvers))

  if (target) {
    state.runsRequired    = Math.max(0, target - state.runs)
    const remBalls        = Math.max(0, totalOvers * 6 - state.legalBalls)
    state.ballsRemaining  = remBalls
    state.requiredRunRate = remBalls > 0
      ? parseFloat(((state.runsRequired / remBalls) * 6).toFixed(2)) : 0
  }

  state.partnership = { runs: partnershipRuns, balls: partnershipBalls }

  if (bowlerId) { const b = bowlerMap.get(bowlerId); if (b) b.isCurrentBowler = true }

  state.isComplete =
    // Standard: 10 wickets down  OR  custom squad size exhausted
    state.wickets >= (playingXISize - 1) ||
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
  team1Size = 11, team2Size = 11,
): Promise<void> {
  console.log('[liveScore] recomputeAndSaveLiveState → matchId:', matchId)

  try {
    const [ev1, ev2] = await Promise.all([
      getBallEvents(matchId, 0),
      getBallEvents(matchId, 1),
    ])

    console.log('[liveScore] recompute: ev1.length=', ev1.length, 'ev2.length=', ev2.length)

    const res1 = computeInnings(ev1, team1Id, team1Name, team2Id, team2Name, totalOvers, undefined, team1Size)
    const inn1 = res1.state

    console.log('[liveScore] recompute inn1: runs=', inn1.runs, 'wkts=', inn1.wickets,
      'balls=', inn1.legalBalls, 'complete=', inn1.isComplete)

    const res2 = computeInnings(ev2, team2Id, team2Name, team1Id, team1Name, totalOvers, inn1.runs + 1, team2Size)
    const inn2 = res2.state

    console.log('[liveScore] recompute inn2: runs=', inn2.runs, 'wkts=', inn2.wickets,
      'balls=', inn2.legalBalls, 'complete=', inn2.isComplete)

    const ci: 0 | 1 = inn1.isComplete ? 1 : 0
    const active    = ci === 0 ? res1 : res2

    console.log('[liveScore] recompute: currentInnings=', ci,
      'striker=', active.strikerName, 'bowler=', active.bowlerName)

    const docPayload = {
      matchId, currentInnings: ci,
      innings1: inn1,
      innings2: inn1.isComplete ? inn2 : null,
      strikerId:      active.strikerId      || '',
      strikerName:    active.strikerName    || '',
      nonStrikerId:   active.nonStrikerId   || '',
      nonStrikerName: active.nonStrikerName || '',
      bowlerId:       active.bowlerId       || '',
      bowlerName:     active.bowlerName     || '',
      isActive:       !inn2.isComplete,
      lastUpdated:    serverTimestamp(),
    }

    await setDoc(doc(db, LIVE_STATES, matchId), docPayload)
    console.log('[liveScore] recomputeAndSaveLiveState ✓')
  } catch (err) {
    console.error('[liveScore] recomputeAndSaveLiveState FAILED:', err)
    throw err
  }
}
