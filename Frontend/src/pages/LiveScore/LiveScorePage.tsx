// src/pages/LiveScore/LiveScorePage.tsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useAuth } from '../../context/AuthContext'
import { subscribeToMatch, startMatch } from '../../services/matchService'
import { getPlayersByTeam } from '../../services/playerService'
import {
  initLiveGame, recordBall, subscribeToLiveState, recomputeAndSaveLiveState, undoLastBall,
} from '../../services/liveScoreService'
import type { Match } from '../../types/match'
import type { Player } from '../../types/player'
import type { LiveGameState, BallOutcome } from '../../types/liveScore'
import '../../styles/teams.css'
import '../../styles/matches.css'
import '../../styles/liveScore.css'

// ── Ball outcome display ───────────────────────────────────────────────────────
const OUTCOMES: { outcome: BallOutcome; label: string; cls: string }[] = [
  { outcome: 'dot', label: '●',  cls: 'dot' },
  { outcome: '1',   label: '1',  cls: 'run' },
  { outcome: '2',   label: '2',  cls: 'run' },
  { outcome: '3',   label: '3',  cls: 'run' },
  { outcome: '4',   label: '4',  cls: 'four' },
  { outcome: '5',   label: '5',  cls: 'run' },
  { outcome: '6',   label: '6',  cls: 'six' },
  { outcome: 'W',   label: 'W',  cls: 'wicket' },
  { outcome: 'ro',  label: 'RO', cls: 'wicket' },
  { outcome: 'rh',  label: 'RH', cls: 'extra' },
  { outcome: 'wd',  label: 'Wd', cls: 'extra' },
  { outcome: 'nb',  label: 'Nb', cls: 'extra' },
  { outcome: 'lb',  label: 'Lb', cls: 'extra' },
  { outcome: 'b',   label: 'By', cls: 'extra' },
]

function ballCls(o: BallOutcome): string {
  if (o === 'dot') return 'dot'
  if (o === '4') return 'four'
  if (o === '6') return 'six'
  if (o === 'W' || o === 'ro') return 'wicket'
  if (o === 'wd' || o === 'nb' || o === 'lb' || o === 'b' || o === 'rh') return 'wide'
  return 'run'
}

// ── Setup Panel ───────────────────────────────────────────────────────────────
interface SetupPanelProps {
  players1: Player[]
  players2: Player[]
  onStart: (striker: Player, nonStriker: Player, bowler: Player) => Promise<void>
}
function SetupPanel({ players1, players2, onStart }: SetupPanelProps) {
  const [strikerId,    setStrikerId]    = useState('')
  const [nonStrikerId, setNonStrikerId] = useState('')
  const [bowlerId,     setBowlerId]     = useState('')
  const [loading, setLoading] = useState(false)

  const allBatters = players1
  const allBowlers = players2

  async function handleStart() {
    const striker    = allBatters.find(p => p.id === strikerId)
    const nonStriker = allBatters.find(p => p.id === nonStrikerId)
    const bowler     = allBowlers.find(p => p.id === bowlerId)
    if (!striker || !nonStriker || !bowler) return
    setLoading(true)
    try { await onStart(striker, nonStriker, bowler) }
    finally { setLoading(false) }
  }

  const sel = (label: string, id: string, val: string, setter: (v: string) => void, opts: Player[]) => (
    <div className="team-form-field">
      <label className="team-form-label" htmlFor={id}>{label}</label>
      <select id={id} className="team-form-input" value={val} onChange={e => setter(e.target.value)}>
        <option value="">— Select —</option>
        {opts.map(p => <option key={p.id} value={p.id}>{p.name} #{p.jerseyNumber}</option>)}
      </select>
    </div>
  )

  return (
    <div className="live-setup-panel">
      <div className="live-setup-icon">🏏</div>
      <h2 className="live-setup-title">Set Up Live Scoring</h2>
      <p className="live-setup-sub">Choose opening batters and first bowler to begin ball-by-ball scoring.</p>
      <div className="live-setup-form">
        {sel('Striker (batting)', 'setup-striker', strikerId, setStrikerId, allBatters)}
        {sel('Non-Striker',       'setup-non',     nonStrikerId, setNonStrikerId, allBatters.filter(p => p.id !== strikerId))}
        {sel('Opening Bowler',    'setup-bowler',  bowlerId, setBowlerId, allBowlers)}
        <button
          className="live-record-btn"
          style={{ marginTop: 8 }}
          onClick={handleStart}
          disabled={!strikerId || !nonStrikerId || !bowlerId || loading}
        >
          {loading ? <><span className="team-spinner" /> Starting…</> : '▶ Start Live Scoring'}
        </button>
      </div>
    </div>
  )
}

// ── Scoring Pad ───────────────────────────────────────────────────────────────
interface ScoringPadProps {
  liveState: LiveGameState
  match: Match
  players1: Player[]
  players2: Player[]
  onBall: (outcome: BallOutcome, extra?: string, wicketDesc?: string, newBowler?: Player, newBatter?: Player) => Promise<void>
}

function ScoringPad({ liveState, match, players1, players2, onBall }: ScoringPadProps) {
  const [selected,    setSelected]    = useState<BallOutcome | null>(null)
  const [wicketDesc,  setWicketDesc]  = useState('')
  const [newBowlerId, setNewBowlerId] = useState('')
  const [newBatterId, setNewBatterId] = useState('')
  const [saving, setSaving] = useState(false)

  const ci       = liveState.currentInnings
  const inn      = ci === 0 ? liveState.innings1 : liveState.innings2
  const batters  = ci === 0 ? players1 : players2
  const bowlers  = ci === 0 ? players2 : players1

  const isNewOver = inn ? inn.legalBalls % 6 === 0 && inn.legalBalls > 0 : false

  // Players already out (can't bat again)
  const outIds = new Set((inn?.batters ?? []).filter(b => b.isOut).map(b => b.playerId))
  // Available new batters: not already at crease and not out
  const availableBatters = batters.filter(
    p => p.id !== liveState.strikerId &&
         p.id !== liveState.nonStrikerId &&
         !outIds.has(p.id)
  )

  async function handleRecord() {
    if (!selected) return
    setSaving(true)
    try {
      const nb      = bowlers.find(p => p.id === newBowlerId)
      const batter  = batters.find(p => p.id === newBatterId)
      await onBall(
        selected,
        undefined,
        selected === 'W' ? wicketDesc : undefined,
        isNewOver ? nb : undefined,
        selected === 'W' ? batter : undefined,
      )
      setSelected(null)
      setWicketDesc('')
      setNewBowlerId('')
      setNewBatterId('')
    } finally { setSaving(false) }
  }

  return (
    <div className="live-scoring-pad">
      <h3 className="live-scoring-pad-title">⚡ Record Ball</h3>

      {/* Current players */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 140, background: 'rgba(34,211,238,0.06)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', marginBottom: 4 }}>STRIKER</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#22d3ee' }}>{liveState.strikerName || '—'}</div>
        </div>
        <div style={{ flex: 1, minWidth: 140, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', marginBottom: 4 }}>NON-STRIKER</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>{liveState.nonStrikerName || '—'}</div>
        </div>
        <div style={{ flex: 1, minWidth: 140, background: 'rgba(167,139,250,0.06)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', marginBottom: 4 }}>BOWLER</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa' }}>{liveState.bowlerName || '—'}</div>
        </div>
      </div>

      {/* New over — pick next bowler */}
      {isNewOver && (
        <div className="team-form-field" style={{ marginBottom: 16 }}>
          <label className="team-form-label" htmlFor="new-bowler">New Bowler (over ended)</label>
          <select id="new-bowler" className="team-form-input" value={newBowlerId} onChange={e => setNewBowlerId(e.target.value)}>
            <option value="">— Select bowler —</option>
            {bowlers.filter(p => p.id !== liveState.bowlerId).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Outcome grid */}
      <div className="live-outcome-grid">
        {OUTCOMES.map(o => (
          <button
            key={o.outcome}
            className={`live-outcome-btn live-outcome-btn--${o.cls}${selected === o.outcome ? ' live-outcome-btn--active' : ''}`}
            onClick={() => setSelected(o.outcome)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Wicket details + new batter */}
      {selected === 'W' && (
        <div className="live-wicket-panel">
          <div className="live-wicket-title">🔴 Wicket Details</div>
          <div className="team-form-field">
            <label className="team-form-label" htmlFor="wkt-desc">Dismissal (e.g. "c Sharma b Kumar")</label>
            <input id="wkt-desc" type="text" className="team-form-input" value={wicketDesc}
              onChange={e => setWicketDesc(e.target.value)} placeholder="c Sharma b Kumar" maxLength={80} />
          </div>
          <div className="team-form-field" style={{ marginTop: 10 }}>
            <label className="team-form-label" htmlFor="new-batter">New Batter (incoming)</label>
            <select id="new-batter" className="team-form-input" value={newBatterId} onChange={e => setNewBatterId(e.target.value)}>
              <option value="">— Select new batter —</option>
              {availableBatters.map(p => (
                <option key={p.id} value={p.id}>{p.name} #{p.jerseyNumber}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <button
        className="live-record-btn"
        onClick={handleRecord}
        disabled={
          !selected || saving ||
          (selected === 'W' && (!wicketDesc || !newBatterId)) ||
          (isNewOver && !newBowlerId)
        }
      >
        {saving ? <><span className="team-spinner" /> Recording…</> : `Record ${selected ? OUTCOMES.find(o => o.outcome === selected)?.label ?? '' : '—'}`}
      </button>

      {/* Over result button */}
      {match.status === 'live' && inn && inn.legalBalls > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            className="team-btn team-btn--outline team-btn--sm"
            style={{ flex: 1 }}
            onClick={() => {
              /* Swap striker and non-striker after over */
            }}
          >
            🔄 Rotate Strike
          </button>
        </div>
      )}
    </div>
  )
}

// ── Scoreboard display ────────────────────────────────────────────────────────
function Scoreboard({ liveState, match }: { liveState: LiveGameState; match: Match }) {
  const ci  = liveState.currentInnings
  const inn = ci === 0 ? liveState.innings1 : liveState.innings2

  return (
    <div className="live-scoreboard">
      <div className="live-scoreboard-bar" />
      <div className="live-scoreboard-inner">
        <div className="live-scoreboard-header">
          <div className="live-badge">
            <span className="live-badge-dot" />
            LIVE
          </div>
          <span className="live-innings-label">
            {ci === 0 ? '1st Innings' : '2nd Innings'} · {match.format} {match.totalOvers} ov
          </span>
        </div>

        <div className="live-teams-row">
          <div className="live-team">
            <span className="live-team-logo">{match.team1Logo}</span>
            <span className="live-team-name">{match.team1Name}</span>
            <span className={`live-team-score${ci === 1 ? ' live-team-score--dim' : ''}`}>
              {ci === 0 && inn ? `${inn.runs}/${inn.wickets}` : `${match.team1Score}/${match.team1Wickets}`}
            </span>
            {inn && ci === 0 && <span className="live-team-overs">({inn.oversDecimal} ov)</span>}
          </div>

          <div className="live-vs"><span className="live-vs-text">VS</span></div>

          <div className="live-team live-team--right">
            <span className="live-team-logo">{match.team2Logo}</span>
            <span className="live-team-name">{match.team2Name}</span>
            <span className={`live-team-score${ci === 0 ? ' live-team-score--dim' : ''}`}>
              {ci === 1 && inn ? `${inn.runs}/${inn.wickets}` : `${match.team2Score}/${match.team2Wickets}`}
            </span>
            {inn && ci === 1 && <span className="live-team-overs">({inn.oversDecimal} ov)</span>}
          </div>
        </div>

        {/* Rate strip */}
        {inn && (
          <div className="live-rate-strip">
            <div className="live-rate-item">
              <span className="live-rate-label">CRR</span>
              <span className="live-rate-value">{inn.currentRunRate}</span>
            </div>
            {inn.partnership && inn.partnership.runs > 0 && (
              <div className="live-rate-item">
                <span className="live-rate-label">Partnership</span>
                <span className="live-rate-value">{inn.partnership.runs} ({inn.partnership.balls})</span>
              </div>
            )}
            {!inn.target && inn.projectedScore > 0 && (
              <div className="live-rate-item">
                <span className="live-rate-label">Projected</span>
                <span className="live-rate-value" style={{ color: '#a78bfa' }}>{inn.projectedScore}</span>
              </div>
            )}
            {inn.target && (
              <>
                <div className="live-rate-item">
                  <span className="live-rate-label">Target</span>
                  <span className="live-rate-value">{inn.target}</span>
                </div>
                <div className="live-rate-item">
                  <span className="live-rate-label">Need</span>
                  <span className={`live-rate-value${(inn.requiredRunRate ?? 0) > 12 ? ' live-rate-value--danger' : (inn.requiredRunRate ?? 0) > 9 ? ' live-rate-value--warn' : ''}`}>
                    {inn.runsRequired} off {inn.ballsRemaining} balls
                  </span>
                </div>
                <div className="live-rate-item">
                  <span className="live-rate-label">RRR</span>
                  <span className={`live-rate-value${(inn.requiredRunRate ?? 0) > 12 ? ' live-rate-value--danger' : ''}`}>
                    {inn.requiredRunRate ?? '—'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Current Over ──────────────────────────────────────────────────────────────
function CurrentOverTicker({ liveState }: { liveState: LiveGameState }) {
  const ci  = liveState.currentInnings
  const inn = ci === 0 ? liveState.innings1 : liveState.innings2
  if (!inn) return null

  const balls = inn.currentOverEvents
  const pending = Math.max(0, 6 - balls.filter(b => b.isLegal).length)

  return (
    <div className="live-over-section">
      <div className="live-over-title">
        This Over · {inn.oversDecimal} ov
      </div>
      <div className="live-balls-row">
        {balls.map((b, i) => (
          <div key={i} className={`live-ball live-ball--${ballCls(b.outcome)}`}>
            {b.outcome === 'W' ? 'W' : b.outcome === 'dot' ? '·' : b.totalRuns}
          </div>
        ))}
        {Array.from({ length: pending }).map((_, i) => (
          <div key={`p${i}`} className="live-ball-pending" />
        ))}
      </div>
    </div>
  )
}

// ── Batters table ─────────────────────────────────────────────────────────────
function BattersTable({ liveState }: { liveState: LiveGameState }) {
  const ci  = liveState.currentInnings
  const inn = ci === 0 ? liveState.innings1 : liveState.innings2
  if (!inn || inn.batters.length === 0) return null

  return (
    <div className="live-scorecard">
      <div className="live-scorecard-title">🏏 Batting</div>
      <table className="live-scorecard-table">
        <thead>
          <tr>
            <th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th>
          </tr>
        </thead>
        <tbody>
          {inn.batters.map(b => {
            const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '—'
            const nameClass = b.isOut
              ? 'live-player-name live-player-name--out'
              : b.isOnStrike && b.playerId === liveState.strikerId
              ? 'live-player-name live-player-name--strike'
              : 'live-player-name'
            return (
              <tr key={b.playerId}>
                <td>
                  <span className={nameClass}>{b.playerName}</span>
                  {!b.isOut && b.playerId === liveState.strikerId && <span style={{ color: '#22d3ee', fontSize: 10, marginLeft: 4 }}>*</span>}
                  {b.isOut && <div style={{ fontSize: 11, color: '#475569' }}>{b.dismissal}</div>}
                </td>
                <td style={{ color: '#f1f5f9', fontWeight: 700 }}>{b.runs}</td>
                <td>{b.balls}</td>
                <td>{b.fours}</td>
                <td>{b.sixes}</td>
                <td className="live-player-sr">{sr}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Bowlers table ─────────────────────────────────────────────────────────────
function BowlersTable({ liveState }: { liveState: LiveGameState }) {
  const ci  = liveState.currentInnings
  const inn = ci === 0 ? liveState.innings1 : liveState.innings2
  if (!inn || inn.bowlers.length === 0) return null

  return (
    <div className="live-scorecard">
      <div className="live-scorecard-title">⚡ Bowling</div>
      <table className="live-scorecard-table">
        <thead>
          <tr>
            <th>Bowler</th><th>O</th><th>R</th><th>W</th><th>Econ</th>
          </tr>
        </thead>
        <tbody>
          {inn.bowlers.map(b => {
            const econ = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(2) : '—'
            return (
              <tr key={b.playerId}>
                <td>
                  <span className={b.isCurrentBowler ? 'live-player-name live-player-name--current-bowler' : 'live-player-name'}>
                    {b.playerName}{b.isCurrentBowler ? ' *' : ''}
                  </span>
                </td>
                <td>{b.overs}</td>
                <td>{b.runs}</td>
                <td style={{ color: b.wickets > 0 ? '#a78bfa' : undefined, fontWeight: b.wickets > 0 ? 700 : undefined }}>{b.wickets}</td>
                <td className="live-player-sr">{econ}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LiveScorePage() {
  const { matchId }  = useParams<{ matchId: string }>()
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const { toasts, showToast, dismissToast } = useToast()

  const [match,     setMatch]     = useState<Match | null>(null)
  const [liveState, setLiveState] = useState<LiveGameState | null>(null)
  const [players1,  setPlayers1]  = useState<Player[]>([])
  const [players2,  setPlayers2]  = useState<Player[]>([])
  const [loading,   setLoading]   = useState(true)

  const isOwner = !!user && !!match && user.uid === match.createdBy

  // Load match + players + live state
  useEffect(() => {
    if (!matchId) return
    const unsubMatch = subscribeToMatch(matchId, m => {
      setMatch(m)
      setLoading(false)
      if (m) {
        getPlayersByTeam(m.team1Id).then(setPlayers1)
        getPlayersByTeam(m.team2Id).then(setPlayers2)
      }
    })
    const unsubLive  = subscribeToLiveState(matchId, setLiveState)
    return () => { unsubMatch(); unsubLive() }
  }, [matchId])

  const handleSetup = useCallback(async (striker: Player, nonStriker: Player, bowler: Player) => {
    if (!match) return
    try {
      await startMatch(match.id)
      await initLiveGame({
        matchId: match.id,
        currentInnings: 0,
        innings1: {
          battingTeamId:   match.team1Id,
          battingTeamName: match.team1Name,
          bowlingTeamId:   match.team2Id,
          bowlingTeamName: match.team2Name,
        },
        strikerId:      striker.id,
        strikerName:    striker.name,
        nonStrikerId:   nonStriker.id,
        nonStrikerName: nonStriker.name,
        bowlerId:       bowler.id,
        bowlerName:     bowler.name,
      })
      showToast('Live scoring started! 🏏', 'success')
    } catch { showToast('Failed to start.', 'error') }
  }, [match, showToast])

  const handleBall = useCallback(async (
    outcome: BallOutcome,
    _extra?: string,
    wicketDesc?: string,
    newBowler?: Player,
    newBatter?: Player,
  ) => {
    if (!match || !liveState) return
    const ci  = liveState.currentInnings
    const inn = ci === 0 ? liveState.innings1 : liveState.innings2
    if (!inn) return

    const legalBalls = inn.legalBalls
    const overNumber = Math.floor(legalBalls / 6)
    const ballInOver = legalBalls % 6

    // After a wicket the NEW batter becomes the striker for this delivery record
    const effectiveStrikerId   = outcome === 'W' && newBatter ? newBatter.id   : liveState.strikerId
    const effectiveStrikerName = outcome === 'W' && newBatter ? newBatter.name : liveState.strikerName

    try {
      await recordBall({
        matchId:        match.id,
        inningsIndex:   ci,
        overNumber,
        ballInOver,
        outcome,
        strikerId:      effectiveStrikerId,
        strikerName:    effectiveStrikerName,
        nonStrikerId:   liveState.nonStrikerId,
        nonStrikerName: liveState.nonStrikerName,
        bowlerId:       newBowler?.id   ?? liveState.bowlerId,
        bowlerName:     newBowler?.name ?? liveState.bowlerName,
        wicket: outcome === 'W' && wicketDesc ? {
          dismissalType: 'caught',
          batsmanId:     liveState.strikerId,   // who got out
          batsmanName:   liveState.strikerName,
          bowlerId:      liveState.bowlerId,
          bowlerName:    liveState.bowlerName,
          description:   wicketDesc,
        } : undefined,
      })
      await recomputeAndSaveLiveState(
        match.id, match.totalOvers,
        match.team1Id, match.team1Name,
        match.team2Id, match.team2Name,
      )
    } catch (err) {
      console.error('[handleBall] error:', err)
      showToast('Failed to record ball.', 'error')
    }
  }, [match, liveState, showToast])

  const handleUndo = useCallback(async () => {
    if (!match || !liveState) return
    try {
      await undoLastBall(match.id, liveState.currentInnings)
      await recomputeAndSaveLiveState(
        match.id, match.totalOvers,
        match.team1Id, match.team1Name,
        match.team2Id, match.team2Name,
      )
      showToast('Last ball undone.', 'info')
    } catch (err) {
      console.error('[handleUndo] error:', err)
      showToast('Failed to undo.', 'error')
    }
  }, [match, liveState, showToast])

  if (loading) {
    return (
      <AppShell>
        <div className="teams-loading">
          <div className="team-spinner team-spinner--lg" /><p>Loading…</p>
        </div>
      </AppShell>
    )
  }
  if (!match) {
    return (
      <AppShell>
        <div className="teams-empty">
          <div className="teams-empty-icon">😕</div>
          <h2 className="teams-empty-title">Match not found</h2>
          <button className="team-btn team-btn--primary" onClick={() => navigate('/matches')}>All Matches</button>
        </div>
      </AppShell>
    )
  }

  const gameEnded = liveState?.innings2?.isComplete ?? false

  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="live-score-page">
        <button className="team-back-btn" onClick={() => navigate(`/matches/${match.id}`)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Match Detail
        </button>

        {/* Match not started yet — owner sees setup */}
        {match.status === 'upcoming' && isOwner && (
          <SetupPanel
            players1={players1}
            players2={players2}
            onStart={handleSetup}
          />
        )}

        {/* Match not started — spectator */}
        {match.status === 'upcoming' && !isOwner && (
          <div className="live-spectator-note">
            ⏳ This match hasn't started yet. Check back soon!
          </div>
        )}

        {/* Game ended */}
        {gameEnded && liveState?.innings2 && (
          <div className="live-result-overlay">
            <div className="live-result-icon">🏆</div>
            <div className="live-result-title">Match Complete</div>
            <div className="live-result-sub">{match.resultSummary || 'Result declared'}</div>
          </div>
        )}

        {/* Live game */}
        {(match.status === 'live' || (match.status === 'completed' && liveState)) && liveState && (
          <>
            <Scoreboard liveState={liveState} match={match} />
            <CurrentOverTicker liveState={liveState} />

            <div className="live-layout">
              <div className="live-layout-main">
                <BattersTable liveState={liveState} />
                <BowlersTable liveState={liveState} />
              </div>
              <div className="live-layout-aside">
                {isOwner && !gameEnded && match.status === 'live' && (
                  <>
                    <ScoringPad
                      liveState={liveState}
                      match={match}
                      players1={players1}
                      players2={players2}
                      onBall={handleBall}
                    />
                    <button
                      id="undo-ball-btn"
                      className="live-record-btn"
                      style={{ marginTop: 8, background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
                      onClick={handleUndo}
                    >
                      ↩ Undo Last Ball
                    </button>
                  </>
                )}
                {!isOwner && (
                  <div className="live-spectator-note">
                    👀 Watching live — scores update automatically
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
