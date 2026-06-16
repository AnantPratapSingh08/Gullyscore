// src/services/liveScoreService.ts
// Live Scoring Firestore service — ball events + LiveGameState.

import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  query, where, orderBy, onSnapshot, serverTimestamp,
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

export function ballsToOversDecimal(legalBalls: number): number {
  return parseFloat(`${Math.floor(legalBalls / 6)}.${legalBalls % 6}`)
}

function isLegalDelivery(o: BallOutcome): boolean {
  return o !== 'wd' && o !== 'nb'
}
function outcomeBatRuns(o: BallOutcome): number {
  if (['W','dot','wd','nb','lb','b'].includes(o)) return 0
  return parseInt(o, 10) || 0
}
function outcomeExtras(o: BallOutcome, extra = 0): number {
  if (o === 'wd' || o === 'nb') return 1 + extra
  if (o === 'lb' || o === 'b')  return extra
  return 0
}

function emptyInnings(
  battingTeamId: string, battingTeamName: string,
  bowlingTeamId: string, bowlingTeamName: string,
): LiveInningsState {
  return {
    battingTeamId, battingTeamName, bowlingTeamId, bowlingTeamName,
    runs: 0, wickets: 0, legalBalls: 0, oversDecimal: 0,
    extras: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0,
    currentRunRate: 0, batters: [], bowlers: [],
    currentOverEvents: [], isComplete: false,
  }
}

export async function initLiveGame(payload: LiveGameInitPayload): Promise<void> {
  const { matchId, innings1, strikerId, strikerName, nonStrikerId, nonStrikerName, bowlerId, bowlerName } = payload
  await setDoc(doc(db, LIVE_STATES, matchId), {
    matchId, currentInnings: 0,
    innings1: emptyInnings(innings1.battingTeamId, innings1.battingTeamName, innings1.bowlingTeamId, innings1.bowlingTeamName),
    innings2: null,
    strikerId, strikerName, nonStrikerId, nonStrikerName, bowlerId, bowlerName,
    isActive: true, lastUpdated: serverTimestamp(),
  })
}

export interface RecordBallParams {
  matchId: string; inningsIndex: 0 | 1; overNumber: number; ballInOver: number
  outcome: BallOutcome; extraRuns?: number
  wicket?: { dismissalType: DismissalType; batsmanId: string; batsmanName: string; bowlerId: string; bowlerName: string; fielderId?: string; fielderName?: string; description: string }
  strikerId: string; strikerName: string; nonStrikerId: string; nonStrikerName: string; bowlerId: string; bowlerName: string
}

export async function recordBall(p: RecordBallParams): Promise<string> {
  const extras  = outcomeExtras(p.outcome, p.extraRuns ?? 0)
  const batRuns = outcomeBatRuns(p.outcome)
  const ref = await addDoc(collection(db, LIVE_STATES, p.matchId, BALL_EVENTS), {
    matchId: p.matchId, inningsIndex: p.inningsIndex,
    overNumber: p.overNumber, ballInOver: p.ballInOver,
    outcome: p.outcome, runsScored: batRuns, extras,
    totalRuns: batRuns + extras, isLegal: isLegalDelivery(p.outcome),
    wicket: p.wicket,
    strikerId: p.strikerId, strikerName: p.strikerName,
    nonStrikerId: p.nonStrikerId, nonStrikerName: p.nonStrikerName,
    bowlerId: p.bowlerId, bowlerName: p.bowlerName,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function getBallEvents(matchId: string, inningsIndex: 0 | 1): Promise<BallEvent[]> {
  const snap = await getDocs(query(
    collection(db, LIVE_STATES, matchId, BALL_EVENTS),
    where('inningsIndex', '==', inningsIndex),
    orderBy('createdAt', 'asc'),
  ))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BallEvent))
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
    query(collection(db, LIVE_STATES, matchId, BALL_EVENTS),
      where('inningsIndex', '==', inningsIndex),
      where('overNumber', '==', overNumber),
      orderBy('createdAt', 'asc')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as BallEvent))),
  )
}

export async function getLiveState(matchId: string): Promise<LiveGameState | null> {
  const snap = await getDoc(doc(db, LIVE_STATES, matchId))
  if (!snap.exists()) return null
  return { matchId: snap.id, ...snap.data() } as LiveGameState
}

function computeInnings(events: BallEvent[], bId: string, bName: string, wId: string, wName: string, totalOvers: number, target?: number): LiveInningsState {
  const state = emptyInnings(bId, bName, wId, wName)
  if (target) { state.target = target; state.runsRequired = target }
  const batterMap = new Map<string, LiveBatterEntry>()
  const bowlerMap = new Map<string, LiveBowlerEntry>()
  let currentOver = 0, overBalls = 0, lastBowler = ''

  for (const ball of events) {
    state.runs   += ball.totalRuns
    state.extras += ball.extras
    if (ball.outcome === 'wd') state.wides  += ball.extras
    if (ball.outcome === 'nb') state.noBalls += ball.extras
    if (ball.outcome === 'lb') state.legByes += ball.extras
    if (ball.outcome === 'b')  state.byes    += ball.extras
    if (ball.isLegal) { state.legalBalls++; overBalls++; if (overBalls > 6) { currentOver++; overBalls = 1 } }
    if (ball.wicket) {
      state.wickets++
      const bt = batterMap.get(ball.wicket.batsmanId)
      if (bt) { bt.isOut = true; bt.dismissal = ball.wicket.description }
    }
    if (!batterMap.has(ball.strikerId)) batterMap.set(ball.strikerId, { playerId: ball.strikerId, playerName: ball.strikerName, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissal: '', isOnStrike: true })
    const striker = batterMap.get(ball.strikerId)!
    striker.runs += ball.runsScored
    if (ball.isLegal) striker.balls++
    if (ball.outcome === '4') striker.fours++
    if (ball.outcome === '6') striker.sixes++
    if (!bowlerMap.has(ball.bowlerId)) bowlerMap.set(ball.bowlerId, { playerId: ball.bowlerId, playerName: ball.bowlerName, overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noBalls: 0, isCurrentBowler: false })
    const bwlr = bowlerMap.get(ball.bowlerId)!
    bwlr.runs += ball.runsScored
    if (ball.outcome === 'wd') bwlr.wides++
    if (ball.outcome === 'nb') bwlr.noBalls++
    if (ball.isLegal) { bwlr.balls++; bwlr.overs = ballsToOversDecimal(bwlr.balls) }
    if (ball.wicket && ball.wicket.bowlerId === ball.bowlerId) bwlr.wickets++
    lastBowler = ball.bowlerId
  }

  state.oversDecimal   = ballsToOversDecimal(state.legalBalls)
  state.currentRunRate = state.legalBalls > 0 ? parseFloat(((state.runs / state.legalBalls) * 6).toFixed(2)) : 0
  if (target) {
    state.runsRequired    = Math.max(0, target - state.runs)
    const remBalls        = Math.max(0, totalOvers * 6 - state.legalBalls)
    state.ballsRemaining  = remBalls
    state.requiredRunRate = remBalls > 0 ? parseFloat(((state.runsRequired / remBalls) * 6).toFixed(2)) : 0
  }
  if (lastBowler) { const b = bowlerMap.get(lastBowler); if (b) b.isCurrentBowler = true }
  state.isComplete = state.wickets >= 10 || state.legalBalls >= totalOvers * 6 || (!!target && state.runs >= target)
  state.batters = Array.from(batterMap.values())
  state.bowlers = Array.from(bowlerMap.values())
  state.currentOverEvents = events.filter(e => e.overNumber === currentOver)
  return state
}

export async function recomputeAndSaveLiveState(
  matchId: string, totalOvers: number,
  team1Id: string, team1Name: string,
  team2Id: string, team2Name: string,
): Promise<void> {
  const [ev1, ev2] = await Promise.all([getBallEvents(matchId, 0), getBallEvents(matchId, 1)])
  const inn1 = computeInnings(ev1, team1Id, team1Name, team2Id, team2Name, totalOvers)
  const inn2 = computeInnings(ev2, team2Id, team2Name, team1Id, team1Name, totalOvers, inn1.runs + 1)
  const ci: 0 | 1 = inn1.isComplete ? 1 : 0
  const lastBall = ci === 0 ? ev1[ev1.length - 1] : ev2[ev2.length - 1]
  await setDoc(doc(db, LIVE_STATES, matchId), {
    matchId, currentInnings: ci,
    innings1: inn1, innings2: inn1.isComplete ? inn2 : null,
    strikerId:     lastBall?.strikerId     ?? '',
    strikerName:   lastBall?.strikerName   ?? '',
    nonStrikerId:  lastBall?.nonStrikerId  ?? '',
    nonStrikerName:lastBall?.nonStrikerName ?? '',
    bowlerId:      lastBall?.bowlerId      ?? '',
    bowlerName:    lastBall?.bowlerName    ?? '',
    isActive:  !inn2.isComplete,
    lastUpdated: serverTimestamp(),
  })
}
