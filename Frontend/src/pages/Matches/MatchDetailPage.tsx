// src/pages/Matches/MatchDetailPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Match Detail — real-time scoreboard, toss, result, score editor (owner only).
// Now upgraded with professional scorecards, dynamic summaries, PDF downloads, 
// and ball-by-ball timeline for both authenticated and guest users.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { MatchForm, type MatchFormData } from '../../components/match/MatchForm'
import { ConfirmModal } from '../../components/common/ConfirmModal'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useAuth } from '../../context/AuthContext'
import {
  updateMatch,
  deleteMatch,
  startMatch,
  completeMatch,
  updateScore,
  subscribeToMatch,
} from '../../services/matchService'
import { getAllTeams } from '../../services/teamService'
import type { Match } from '../../types/match'
import type { Team } from '../../types/team'

import { getBallEvents } from '../../services/liveScoreService'
import type { BallEvent } from '../../types/liveScore'
import { jsPDF } from 'jspdf'
import '../../styles/teams.css'
import '../../styles/matches.css'

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Match['status'], string> = {
  live:      'Live',
  upcoming:  'Upcoming',
  completed: 'Completed',
  abandoned: 'Abandoned',
}

const STATUS_COLOR: Record<Match['status'], string> = {
  live:      '#4ade80',
  upcoming:  '#38bdf8',
  completed: '#94a3b8',
  abandoned: '#f87171',
}

function formatDate(iso: string) {
  if (!iso) return 'TBD'
  try {
    return new Date(iso).toLocaleString('en-IN', {
      weekday: 'long', day: '2-digit', month: 'long',
      year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    })
  } catch { return iso }
}

// ── Score Editor ──────────────────────────────────────────────────────────────

interface ScoreEditorProps {
  match:   Match
  onSave:  (team: 1 | 2, score: number, wickets: number, overs: number) => Promise<void>
}

function ScoreEditor({ match, onSave }: ScoreEditorProps) {
  const [t1s, setT1s] = useState(match.team1Score)
  const [t1w, setT1w] = useState(match.team1Wickets)
  const [t1o, setT1o] = useState(match.team1Overs)
  const [t2s, setT2s] = useState(match.team2Score)
  const [t2w, setT2w] = useState(match.team2Wickets)
  const [t2o, setT2o] = useState(match.team2Overs)
  const [saving, setSaving] = useState<1 | 2 | null>(null)

  async function save(team: 1 | 2) {
    setSaving(team)
    try {
      await onSave(
        team,
        team === 1 ? t1s : t2s,
        team === 1 ? t1w : t2w,
        team === 1 ? t1o : t2o,
      )
    } finally { setSaving(null) }
  }

  const numInput = (
    val: number,
    setter: (v: number) => void,
    max: number,
    label: string,
    id: string,
  ) => (
    <div className="team-form-field">
      <label className="team-form-label" htmlFor={id} style={{ fontSize: 11 }}>{label}</label>
      <input
        id={id}
        type="number"
        className="team-form-input"
        value={val}
        min={0}
        max={max}
        step={id.includes('overs') ? 0.1 : 1}
        onChange={e => setter(parseFloat(e.target.value) || 0)}
        style={{ padding: '8px 12px' }}
      />
    </div>
  )

  return (
    <div className="match-section">
      <h3 className="match-section-title">⚡ Update Scores</h3>

      {/* Team 1 */}
      <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>
        {match.team1Logo} {match.team1Name}
      </p>
      <div className="match-score-grid" style={{ marginBottom: 12 }}>
        {numInput(t1s, setT1s, 9999, 'Runs',    'se-t1-runs')}
        {numInput(t1w, setT1w, 10,   'Wickets', 'se-t1-wkts')}
        {numInput(t1o, setT1o, match.totalOvers, 'Overs', 'se-t1-overs')}
      </div>
      <button
        className="team-btn team-btn--outline team-btn--sm"
        style={{ marginBottom: 20 }}
        onClick={() => save(1)}
        disabled={saving === 1}
      >
        {saving === 1 ? <span className="team-spinner" /> : 'Save Team 1 Score'}
      </button>

      {/* Team 2 */}
      <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>
        {match.team2Logo} {match.team2Name}
      </p>
      <div className="match-score-grid" style={{ marginBottom: 12 }}>
        {numInput(t2s, setT2s, 9999, 'Runs',    'se-t2-runs')}
        {numInput(t2w, setT2w, 10,   'Wickets', 'se-t2-wkts')}
        {numInput(t2o, setT2o, match.totalOvers, 'Overs', 'se-t2-overs')}
      </div>
      <button
        className="team-btn team-btn--outline team-btn--sm"
        onClick={() => save(2)}
        disabled={saving === 2}
      >
        {saving === 2 ? <span className="team-spinner" /> : 'Save Team 2 Score'}
      </button>
    </div>
  )
}

// ── Result Panel ──────────────────────────────────────────────────────────────

interface ResultPanelProps {
  match:    Match
  onResult: (result: Match['result'], summary: string, playerOfMatch?: string) => Promise<void>
}

function ResultPanel({ match, onResult }: ResultPanelProps) {
  const [result,  setResult]  = useState<Match['result']>('team1')
  const [summary, setSummary] = useState('')
  const [playerOfMatch, setPlayerOfMatch] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim()) return
    setLoading(true)
    try { await onResult(result, summary.trim(), playerOfMatch.trim()) }
    finally { setLoading(false) }
  }

  return (
    <div className="match-section">
      <h3 className="match-section-title">🏆 Declare Result</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([
            { value: 'team1',     label: `${match.team1Logo} ${match.team1Name} Won` },
            { value: 'team2',     label: `${match.team2Logo} ${match.team2Name} Won` },
            { value: 'tie',       label: '🤝 Tie' },
            { value: 'no_result', label: '🚫 No Result' },
          ] as Array<{ value: Match['result']; label: string }>).map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`player-form-chip${result === opt.value ? ' player-form-chip--active' : ''}`}
              onClick={() => setResult(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="team-form-field">
          <label className="team-form-label" htmlFor="result-summary">Result Summary</label>
          <input
            id="result-summary"
            type="text"
            className="team-form-input"
            placeholder="e.g. Warriors won by 24 runs"
            value={summary}
            onChange={e => setSummary(e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="team-form-field">
          <label className="team-form-label" htmlFor="result-pom">Player of the Match (Optional)</label>
          <input
            id="result-pom"
            type="text"
            className="team-form-input"
            placeholder="e.g. Rahul Prasad"
            value={playerOfMatch}
            onChange={e => setPlayerOfMatch(e.target.value)}
            maxLength={50}
          />
        </div>
        <button id="declare-result-btn" type="submit" className="team-btn team-btn--primary" disabled={loading || !summary.trim()}>
          {loading ? <><span className="team-spinner" /> Saving…</> : 'Declare Result'}
        </button>
      </form>
    </div>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function useMatchDetail(matchId: string | undefined) {
  const [match,   setMatch]   = useState<Match | null>(null)
  const [teams,   setTeams]   = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!matchId) return
    let unsub: (() => void) | undefined
    unsub = subscribeToMatch(matchId, data => {
      if (!data) { setError('Match not found.'); setLoading(false); return }
      setMatch(data)
      setLoading(false)
    })
    getAllTeams().then(setTeams)
    return () => { unsub?.() }
  }, [matchId])

  return { match, teams, loading, error }
}

// ── Timeline & Summary Helpers ───────────────────────────────────────────────

interface FOWEntry {
  wicketNum: number
  score: number
  overs: string
  batsmanName: string
}

function calculateFOW(events: BallEvent[]): FOWEntry[] {
  const fow: FOWEntry[] = []
  let runs = 0
  let wickets = 0
  let legalBalls = 0

  for (const ball of events) {
    runs += ball.totalRuns
    if (ball.isLegal) {
      legalBalls++
    }
    if (ball.wicket || ball.outcome === 'ro' || ball.outcome === 'rh') {
      wickets++
      const overNumDecimal = parseFloat(`${Math.floor(legalBalls / 6)}.${legalBalls % 6}`).toFixed(1)
      const batsmanName = ball.wicket ? ball.wicket.batsmanName : ball.strikerName
      fow.push({
        wicketNum: wickets,
        score: runs,
        overs: overNumDecimal,
        batsmanName
      })
    }
  }
  return fow
}

interface OverGroup {
  overNumber: number
  bowlerName: string
  balls: BallEvent[]
}

function groupBallsByOver(events: BallEvent[]): OverGroup[] {
  const groups: OverGroup[] = []
  for (const ball of events) {
    let group = groups.find(g => g.overNumber === ball.overNumber)
    if (!group) {
      group = {
        overNumber: ball.overNumber,
        bowlerName: ball.bowlerName,
        balls: []
      }
      groups.push(group)
    }
    group.balls.push(ball)
  }
  return groups.sort((a, b) => a.overNumber - b.overNumber)
}

function getBallOutcomeBadgeInfo(outcome: string) {
  switch (outcome) {
    case 'dot':
      return { label: '•', className: 'timeline-ball-badge--dot' }
    case 'W':
    case 'ro':
    case 'rh':
      return { label: 'W', className: 'timeline-ball-badge--wicket' }
    case '4':
      return { label: '4', className: 'timeline-ball-badge--boundary' }
    case '6':
      return { label: '6', className: 'timeline-ball-badge--six' }
    case 'wd':
    case 'nb':
    case 'lb':
    case 'b':
      return { label: outcome, className: 'timeline-ball-badge--extra' }
    default:
      return { label: outcome, className: 'timeline-ball-badge--runs' }
  }
}

function formatOutcomeDisplay(ball: BallEvent): string {
  if (ball.outcome === 'W') {
    return ball.wicket ? `Wicket (${ball.wicket.description})` : 'Wicket'
  }
  const outcomeLabels: Record<string, string> = {
    dot: 'Dot Ball',
    '1': '1 Run',
    '2': '2 Runs',
    '3': '3 Runs',
    '4': 'Four',
    '5': '5 Runs',
    '6': 'Six',
    ro: 'Run Out',
    rh: 'Retired Hurt',
    wd: 'Wide',
    nb: 'No-ball',
    lb: 'Leg Bye',
    b: 'Bye',
  }
  return outcomeLabels[ball.outcome] || `${ball.outcome} Runs`
}

function generateAutoSummary(match: Match): string {
  if (match.status !== 'completed') return ''

  const inn1 = match.innings1
  const inn2 = match.innings2

  // 1. Result summary
  let resultText = match.resultSummary || ''
  if (!resultText) {
    if (match.result === 'team1') {
      resultText = `${match.team1Name} won by ${inn1 ? inn1.runs - (inn2?.runs || 0) : 0} runs.`
    } else if (match.result === 'team2') {
      const wicketsLeft = inn2 ? (10 - inn2.wickets) : 0
      resultText = `${match.team2Name} won by ${wicketsLeft} wickets.`
    } else if (match.result === 'tie') {
      resultText = `Match tied.`
    } else {
      resultText = `No result.`
    }
  }

  // 2. Find top scorer
  let topScorerName = ''
  let topScorerRuns = -1
  let topScorerBalls = 0

  const allBatters = [
    ...(inn1?.batters || []),
    ...(inn2?.batters || []),
  ]
  for (const b of allBatters) {
    if (b.runs > topScorerRuns) {
      topScorerRuns = b.runs
      topScorerName = b.playerName
      topScorerBalls = b.balls
    }
  }

  // 3. Find top bowler
  let topBowlerName = ''
  let topBowlerWickets = -1
  let topBowlerRuns = 0

  const allBowlers = [
    ...(inn1?.bowlers || []),
    ...(inn2?.bowlers || []),
  ]
  for (const bw of allBowlers) {
    if (bw.wickets > topBowlerWickets || (bw.wickets === topBowlerWickets && bw.runs < topBowlerRuns)) {
      topBowlerWickets = bw.wickets
      topBowlerName = bw.playerName
      topBowlerRuns = bw.runs
    }
  }

  let statsText = ''
  if (topScorerName && topScorerRuns > 0) {
    statsText += `${topScorerName} scored ${topScorerRuns} runs from ${topScorerBalls} balls`
  }
  if (topBowlerName && topBowlerWickets > 0) {
    if (statsText) statsText += ' while '
    statsText += `${topBowlerName} took ${topBowlerWickets} wicket${topBowlerWickets !== 1 ? 's' : ''}`
  }
  if (statsText) {
    statsText += '.'
  }

  // 4. Chase details
  let chaseText = ''
  if (inn2) {
    if (match.result === 'team2') {
      chaseText = `${match.team2Name} chased ${inn1 ? inn1.runs + 1 : 0} in ${(inn2.oversDecimal ?? inn2.overs ?? 0).toFixed(1)} overs.`
    } else {
      chaseText = `${match.team2Name} scored ${(inn2.runs)}/${inn2.wickets} in ${(inn2.oversDecimal ?? inn2.overs ?? 0).toFixed(1)} overs.`
    }
  }

  return [resultText, statsText, chaseText].filter(Boolean).join('\n')
}

// ── PDF Scorecard Function ──────────────────────────────────────────────────

function downloadPDFScorecard(match: Match, ballEvents1: BallEvent[], ballEvents2: BallEvent[]) {
  const doc = new jsPDF()

  // Title / Brand
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(34, 211, 238) // Neon cyan
  doc.text('GullyScore Match Scorecard', 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text('Generated by GullyScore', 14, 26)

  // Divider
  doc.setLineWidth(0.5)
  doc.setDrawColor(226, 232, 240)
  doc.line(14, 30, 196, 30)

  // Match Info
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.setFont('Helvetica', 'bold')
  doc.text(`Match: ${match.title}`, 14, 40)

  doc.setFont('Helvetica', 'normal')
  doc.text(`Date: ${formatDate(match.scheduledAt)}`, 14, 46)
  doc.text(`Venue: ${match.venue || 'N/A'}`, 14, 52)

  // Result
  doc.setFont('Helvetica', 'bold')
  doc.setTextColor(52, 211, 153) // Green
  doc.text(`Result: ${match.resultSummary || 'Completed'}`, 14, 62)

  if (match.playerOfMatch) {
    doc.text(`Player of Match: ${match.playerOfMatch}`, 14, 68)
  }

  let y = 78

  // Helper to calculate FOW in PDF
  const calculateFOW = (events: BallEvent[]): Array<{ wicketNum: number; score: number; overs: string; batsmanName: string }> => {
    const fow = []
    let runs = 0
    let wickets = 0
    let legalBalls = 0

    for (const ball of events) {
      runs += ball.totalRuns
      if (ball.isLegal) {
        legalBalls++
      }
      if (ball.wicket || ball.outcome === 'ro' || ball.outcome === 'rh') {
        wickets++
        const overNumDecimal = parseFloat(`${Math.floor(legalBalls / 6)}.${legalBalls % 6}`).toFixed(1)
        const batsmanName = ball.wicket ? ball.wicket.batsmanName : ball.strikerName
        fow.push({
          wicketNum: wickets,
          score: runs,
          overs: overNumDecimal,
          batsmanName
        })
      }
    }
    return fow
  }

  const drawInnings = (inn: any, title: string, events: BallEvent[]) => {
    if (!inn) return
    if (y > 240) { doc.addPage(); y = 20 }

    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(34, 211, 238)
    doc.text(title, 14, y)
    y += 8

    // Batting Header
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text('Batter', 14, y)
    doc.text('R', 85, y)
    doc.text('B', 105, y)
    doc.text('4s', 125, y)
    doc.text('6s', 145, y)
    doc.text('SR', 165, y)
    y += 4
    doc.line(14, y, 196, y)
    y += 6

    // Batters list
    doc.setFont('Helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    for (const b of (inn.batters || [])) {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.text(b.playerName, 14, y)
      doc.text(String(b.runs), 85, y)
      doc.text(String(b.balls), 105, y)
      doc.text(String(b.fours), 125, y)
      doc.text(String(b.sixes), 145, y)
      const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'
      doc.text(sr, 165, y)
      if (b.dismissal) {
        y += 4
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text(b.dismissal, 14, y)
        doc.setFontSize(10)
        doc.setTextColor(15, 23, 42)
      }
      y += 6
    }

    y += 2
    doc.line(14, y, 196, y)
    y += 6

    // Extras
    const wides = inn.wides ?? 0
    const noBalls = inn.noBalls ?? 0
    const byes = inn.byes ?? 0
    const legByes = inn.legByes ?? 0
    const extrasTotal = inn.extras ?? (wides + noBalls + byes + legByes)
    doc.setFont('Helvetica', 'bold')
    doc.text(`Total: ${inn.runs}/${inn.wickets} (${(inn.oversDecimal ?? inn.overs ?? 0).toFixed(1)} ov)`, 14, y)
    doc.setFont('Helvetica', 'normal')
    doc.text(`Extras: ${extrasTotal} (Wd: ${wides}, Nb: ${noBalls}, B: ${byes}, Lb: ${legByes})`, 85, y)
    y += 8

    // Bowling Header
    if (y > 250) { doc.addPage(); y = 20 }
    doc.setFont('Helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('Bowler', 14, y)
    doc.text('O', 85, y)
    doc.text('R', 105, y)
    doc.text('W', 125, y)
    doc.text('Econ', 145, y)
    y += 4
    doc.line(14, y, 196, y)
    y += 6

    doc.setFont('Helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    for (const b of (inn.bowlers || [])) {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.text(b.playerName, 14, y)
      const ov = b.oversDecimal ?? b.overs ?? 0
      doc.text(String(ov.toFixed(1)), 85, y)
      doc.text(String(b.runs), 105, y)
      doc.text(String(b.wickets), 125, y)
      // Econ
      const legalDeliveries = b.balls ?? (Math.floor(ov) * 6 + Math.round((ov % 1) * 10))
      const econ = legalDeliveries > 0 ? ((b.runs / legalDeliveries) * 6).toFixed(2) : '0.00'
      doc.text(econ, 145, y)
      y += 6
    }
    y += 2
    doc.line(14, y, 196, y)
    y += 6

    // Fall of Wickets
    const fow = calculateFOW(events)
    if (fow.length > 0) {
      if (y > 260) { doc.addPage(); y = 20 }
      doc.setFont('Helvetica', 'bold')
      doc.setTextColor(100, 116, 139)
      doc.text('Fall of Wickets:', 14, y)
      doc.setFont('Helvetica', 'normal')
      doc.setTextColor(15, 23, 42)
      const fowStr = fow.map(f => `${f.wicketNum}-${f.score} (${f.batsmanName}, ${f.overs} ov)`).join(', ')
      const splitFow = doc.splitTextToSize(fowStr, 130)
      doc.text(splitFow, 45, y)
      y += (splitFow.length * 5) + 3
    }
  }

  // Draw Innings 1
  drawInnings(match.innings1, `${match.team1Name} Innings`, ballEvents1)

  // Draw Innings 2
  if (match.innings2) {
    y += 6
    drawInnings(match.innings2, `${match.team2Name} Innings`, ballEvents2)
  }

  // Save PDF
  doc.save(`Scorecard_${match.title.replace(/\s+/g, '_')}.pdf`)
}

// ── Page Component ────────────────────────────────────────────────────────────

interface MatchDetailPageProps {
  isPublic?: boolean
}

export default function MatchDetailPage({ isPublic = false }: MatchDetailPageProps) {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate    = useNavigate()
  const { user }    = useAuth()
  const { toasts, showToast, dismissToast } = useToast()

  const { match, teams, loading, error } = useMatchDetail(matchId)

  const [showEdit,   setShowEdit]   = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [startLoading,  setStartLoading]  = useState(false)

  // Chronological timeline events
  const [ballEvents1, setBallEvents1] = useState<BallEvent[]>([])
  const [ballEvents2, setBallEvents2] = useState<BallEvent[]>([])

  // Tab state for scoreboard / timeline
  const [activeTab, setActiveTab] = useState<'scorecard' | 'timeline'>('scorecard')

  // Copy link share
  const [copied, setCopied] = useState(false)

  // Strict check: if public route, isOwner MUST be false
  const isOwner = !isPublic && !!user && !!match && user.uid === match.createdBy

  // Fetch timeline balls on load/update
  useEffect(() => {
    if (match && (match.status === 'completed' || match.status === 'live')) {
      getBallEvents(match.id, 0).then(setBallEvents1)
      getBallEvents(match.id, 1).then(setBallEvents2)
    }
  }, [match])

  // ── Actions ─────────────────────────────────────────────────────────────
  async function handleEdit(data: MatchFormData) {
    if (!match) return
    try {
      await updateMatch(match.id, data)
      showToast('Match updated! ✅', 'success')
      setShowEdit(false)
    } catch {
      showToast('Failed to update.', 'error')
      throw new Error('fail')
    }
  }

  async function handleDelete() {
    if (!match) return
    setDeleteLoading(true)
    try {
      await deleteMatch(match.id)
      navigate('/matches', { replace: true })
    } catch {
      showToast('Failed to delete match.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleStart() {
    if (!match) return
    setStartLoading(true)
    try {
      await startMatch(match.id)
      showToast('Match started! 🏏', 'success')
    } catch {
      showToast('Failed to start match.', 'error')
    } finally {
      setStartLoading(false)
    }
  }

  async function handleScore(team: 1 | 2, score: number, wickets: number, overs: number) {
    if (!match) return
    await updateScore(match.id, team, score, wickets, overs)
    showToast('Score updated!', 'success')
  }

  async function handleResult(result: Match['result'], summary: string, playerOfMatch?: string) {
    if (!match) return
    await completeMatch(match.id, result, summary, playerOfMatch)
    showToast(`Result declared: ${summary}`, 'success')
  }

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/match/${match?.id}`
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    showToast('Link copied to clipboard! 🔗', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell>
        <div className="teams-loading">
          <div className="team-spinner team-spinner--lg" /><p>Loading match…</p>
        </div>
      </AppShell>
    )
  }

  if (error || !match) {
    return (
      <AppShell>
        <div className="teams-empty">
          <div className="teams-empty-icon">😕</div>
          <h2 className="teams-empty-title">{error ?? 'Match not found'}</h2>
          <button className="team-btn team-btn--primary" onClick={() => navigate('/matches')}>
            All Matches
          </button>
        </div>
      </AppShell>
    )
  }

  const accent = STATUS_COLOR[match.status]

  // Auto generated summary text
  const autoSummary = generateAutoSummary(match)

  // Scorecard rendering subcomponents
  const renderScorecardInnings = (inn: any, innLabel: string, events: BallEvent[]) => {
    if (!inn || !inn.batters || inn.batters.length === 0) {
      return (
        <div className="teams-empty" style={{ padding: 20 }}>
          <p style={{ fontSize: 13, color: '#475569' }}>No scorecard entries recorded yet for {innLabel}.</p>
        </div>
      )
    }

    const wides = inn.wides ?? 0
    const noBalls = inn.noBalls ?? 0
    const byes = inn.byes ?? 0
    const legByes = inn.legByes ?? 0
    const extrasTotal = inn.extras ?? (wides + noBalls + byes + legByes)
    const fow = calculateFOW(events)

    return (
      <div className="scorecard-container" style={{ marginTop: 12 }}>
        <h4 className="scorecard-title">🏏 {innLabel} Batting</h4>
        <div className="scorecard-table-wrapper">
          <table className="scorecard-table">
            <thead>
              <tr>
                <th>Batter</th>
                <th>R</th>
                <th>B</th>
                <th>4s</th>
                <th>6s</th>
                <th>SR</th>
              </tr>
            </thead>
            <tbody>
              {inn.batters.map((b: any) => {
                const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'
                return (
                  <tr key={b.playerId}>
                    <td>
                      <div>
                        <span style={{ fontWeight: 600 }}>{b.playerName}</span>
                        {b.dismissal && (
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{b.dismissal}</div>
                        )}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{b.runs}</td>
                    <td>{b.balls}</td>
                    <td>{b.fours}</td>
                    <td>{b.sixes}</td>
                    <td style={{ color: '#22d3ee' }}>{sr}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="scorecard-extras-row">
          <span style={{ fontWeight: 700 }}>Total Score: {inn.runs}/{inn.wickets} ({(inn.oversDecimal ?? inn.overs ?? 0).toFixed(1)} ov)</span>
          <span style={{ color: '#94a3b8' }}>Extras: {extrasTotal} (Wd {wides}, Nb {noBalls}, B {byes}, Lb {legByes})</span>
        </div>

        <h4 className="scorecard-title" style={{ marginTop: 12 }}>🎳 {innLabel} Bowling</h4>
        <div className="scorecard-table-wrapper">
          <table className="scorecard-table">
            <thead>
              <tr>
                <th>Bowler</th>
                <th>O</th>
                <th>R</th>
                <th>W</th>
                <th>Econ</th>
              </tr>
            </thead>
            <tbody>
              {inn.bowlers.map((b: any) => {
                const ov = b.oversDecimal ?? b.overs ?? 0
                const legalDeliveries = b.balls ?? (Math.floor(ov) * 6 + Math.round((ov % 1) * 10))
                const econ = legalDeliveries > 0 ? ((b.runs / legalDeliveries) * 6).toFixed(2) : '0.00'
                return (
                  <tr key={b.playerId}>
                    <td style={{ fontWeight: 600 }}>{b.playerName}</td>
                    <td>{ov.toFixed(1)}</td>
                    <td>{b.runs}</td>
                    <td style={{ fontWeight: 700, color: '#f87171' }}>{b.wickets}</td>
                    <td style={{ color: '#22d3ee' }}>{econ}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {fow.length > 0 && (
          <div className="scorecard-fow">
            <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Fall of Wickets: </span>
            {fow.map((f, idx) => (
              <span key={f.wicketNum}>
                {f.wicketNum}-{f.score} ({f.batsmanName}, {f.overs} ov){idx < fow.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Timeline ball list rendering
  const renderTimelineInnings = (events: BallEvent[], innLabel: string) => {
    if (events.length === 0) {
      return (
        <div className="teams-empty" style={{ padding: 20 }}>
          <p style={{ fontSize: 13, color: '#475569' }}>No events recorded for {innLabel} yet.</p>
        </div>
      )
    }

    const overGroups = groupBallsByOver(events)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h4 className="scorecard-title">⏱ {innLabel} Ball-by-Ball</h4>
        {overGroups.map(g => (
          <div key={g.overNumber} className="timeline-over-group">
            <div className="timeline-over-header">
              <span>Over {g.overNumber + 1}</span>
              <span style={{ fontWeight: 500, color: '#94a3b8' }}>Bowler: {g.bowlerName}</span>
            </div>
            <div className="timeline-balls-list">
              {g.balls.map(ball => {
                const badge = getBallOutcomeBadgeInfo(ball.outcome)
                return (
                  <div key={ball.id} className="timeline-ball-row">
                    <span className="timeline-ball-index">{ball.overNumber}.{ball.ballInOver + 1}</span>
                    <span className={`timeline-ball-badge ${badge.className}`}>{badge.label}</span>
                    <span className="timeline-ball-desc">
                      <strong style={{ color: '#f1f5f9' }}>{ball.strikerName}</strong> to <strong style={{ color: '#f1f5f9' }}>{ball.bowlerName}</strong> - {formatOutcomeDisplay(ball)}
                    </span>
                    <span className="timeline-ball-bowler">runs: {ball.totalRuns}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const content = (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Edit panel */}
      {showEdit && (
        <div className="team-side-panel-overlay" onClick={() => setShowEdit(false)}>
          <div className="team-side-panel" onClick={e => e.stopPropagation()}>
            <div className="team-side-panel-header">
              <h2 className="team-side-panel-title">✏️ Edit Match</h2>
              <button className="team-side-panel-close" onClick={() => setShowEdit(false)}>×</button>
            </div>
            <MatchForm existing={match} teams={teams} onSubmit={handleEdit} onCancel={() => setShowEdit(false)} submitLabel="Save Changes" />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDelete}
        title="Delete Match"
        message={`Delete "${match.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
        dangerous
        loading={deleteLoading}
      />

      {/* Back button */}
      {!isPublic ? (
        <button className="team-back-btn" onClick={() => navigate('/matches')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Matches
        </button>
      ) : (
        <button className="team-back-btn" onClick={() => navigate('/')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Home
        </button>
      )}

      {/* Hero Banner */}
      <div className="match-detail-hero" style={{ marginTop: 16 }}>
        <div className="match-detail-hero-bar" style={{ background: accent }} />
        <div className="match-detail-hero-inner">
          <div className="match-detail-header">
            <div>
              <h1 style={{ fontSize: 'clamp(18px,3vw,24px)', fontWeight: 900, color: '#f1f5f9', margin: '0 0 8px' }}>
                {match.title}
              </h1>
              <span className={`match-status match-status--${match.status}`}>
                <span className="match-status-dot" />
                {STATUS_LABEL[match.status]}
              </span>
            </div>

            {isOwner && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button id="detail-edit-btn" className="team-icon-btn team-icon-btn--edit" onClick={() => setShowEdit(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
                <button id="detail-delete-btn" className="team-icon-btn team-icon-btn--delete" onClick={() => setShowDelete(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Scoreboard display */}
          <div className="match-detail-scoreboard">
            {/* Team 1 */}
            <div className="match-detail-team">
              <span className="match-detail-team-logo">{match.team1Logo}</span>
              <span className="match-detail-team-name">{match.team1Name}</span>
              <span className={`match-detail-score${match.status === 'upcoming' ? ' match-detail-score--dim' : ''}`}>
                {match.status === 'upcoming' ? '— / —' : `${match.team1Score}/${match.team1Wickets}`}
              </span>
              {match.status !== 'upcoming' && (
                <span className="match-detail-overs">({match.team1Overs.toFixed(1)} ov)</span>
              )}
            </div>

            <div className="match-detail-vs-col">
              <span className="match-detail-vs-text">VS</span>
              <span style={{ fontSize: 11, color: '#475569' }}>{match.format} · {match.totalOvers} ov</span>
            </div>

            {/* Team 2 */}
            <div className="match-detail-team match-detail-team--right">
              <span className="match-detail-team-logo">{match.team2Logo}</span>
              <span className="match-detail-team-name">{match.team2Name}</span>
              <span className={`match-detail-score${match.status === 'upcoming' ? ' match-detail-score--dim' : ''}`}>
                {match.status === 'upcoming' ? '— / —' : `${match.team2Score}/${match.team2Wickets}`}
              </span>
              {match.status !== 'upcoming' && (
                <span className="match-detail-overs">({match.team2Overs.toFixed(1)} ov)</span>
              )}
            </div>
          </div>

          {/* Toss */}
          {match.tossWinnerId && match.tossDecision && (
            <div className="match-toss-info">
              🪙 Toss: {match.tossWinnerId === match.team1Id ? match.team1Name : match.team2Name} won and elected to {match.tossDecision}
            </div>
          )}

          {/* Venue & Date */}
          <div className="match-detail-meta-row">
            <span className="match-detail-meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {match.venue || 'TBD'}
            </span>
            <span className="match-detail-meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {formatDate(match.scheduledAt)}
            </span>
          </div>

          {/* Result banner */}
          {match.status === 'completed' && match.resultSummary && (
            <div className="match-result-banner" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              <div style={{ fontWeight: 800 }}>🏆 {match.resultSummary}</div>
              {match.playerOfMatch && (
                <div style={{ fontSize: 12, color: '#38bdf8' }}>🥇 Player of the Match: {match.playerOfMatch}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Auto Summary Panel */}
      {match.status === 'completed' && autoSummary && (
        <div className="match-summary-card">
          <h3 className="match-summary-title">📝 Match Summary</h3>
          <p className="match-summary-text">{autoSummary}</p>
        </div>
      )}

      {/* Share / PDF Downloads Panel */}
      <div className="match-section share-card">
        <h3 className="match-section-title" style={{ width: '100%', justifyContent: 'center' }}>🔗 Share Match Scorecard</h3>
        <div className="share-url-container">
          <input
            className="share-url-input"
            type="text"
            readOnly
            value={`${window.location.origin}/match/${match.id}`}
          />
          <button className="team-btn team-btn--primary team-btn--sm" onClick={handleCopyLink}>
            {copied ? 'Copied! ✓' : 'Copy Link'}
          </button>
        </div>
        {match.status === 'completed' && (
          <button
            className="team-btn team-btn--outline"
            style={{ marginTop: 8 }}
            onClick={() => downloadPDFScorecard(match, ballEvents1, ballEvents2)}
          >
            📄 Download PDF Scorecard
          </button>
        )}
      </div>

      {/* Scorecard vs Timeline Tabs */}
      {(match.status === 'completed' || match.status === 'live') && (
        <>
          <div className="match-tabs">
            <button
              className={`match-tab${activeTab === 'scorecard' ? ' match-tab--active' : ''}`}
              onClick={() => setActiveTab('scorecard')}
            >
              📊 Detailed Scorecard
            </button>
            <button
              className={`match-tab${activeTab === 'timeline' ? ' match-tab--active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              ⏱ Match Timeline
            </button>
          </div>

          <div className="match-tab-content">
            {activeTab === 'scorecard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {renderScorecardInnings(match.innings1, match.team1Name, ballEvents1)}
                {match.innings2 && renderScorecardInnings(match.innings2, match.team2Name, ballEvents2)}
              </div>
            )}
            {activeTab === 'timeline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {renderTimelineInnings(ballEvents1, match.team1Name)}
                {match.innings2 && renderTimelineInnings(ballEvents2, match.team2Name)}
              </div>
            )}
          </div>
        </>
      )}

      {/* Admin actions (start match, declare result) */}
      {isOwner && (
        <>
          {match.status === 'upcoming' && (
            <div className="match-admin-bar" style={{ marginTop: 24 }}>
              <button
                id="start-match-btn"
                className="team-btn team-btn--primary"
                onClick={handleStart}
                disabled={startLoading}
              >
                {startLoading ? <><span className="team-spinner" /> Starting…</> : '▶ Start Match'}
              </button>
              <button
                className="team-btn team-btn--outline"
                onClick={() => navigate(`/matches/${match.id}/live`)}
              >
                🏏 Live Scoring Setup
              </button>
            </div>
          )}

          {match.status === 'live' && (
            <div className="match-admin-bar" style={{ marginTop: 24 }}>
              <button
                id="live-score-btn"
                className="team-btn team-btn--primary"
                style={{ background: 'linear-gradient(135deg,#4ade80,#16a34a)' }}
                onClick={() => navigate(`/matches/${match.id}/live`)}
              >
                ⚡ Open Live Scoring
              </button>
            </div>
          )}

          {match.status === 'live' && (
            <>
              <ScoreEditor match={match} onSave={handleScore} />
              <ResultPanel match={match} onResult={handleResult} />
            </>
          )}

          {/* Toss editor (upcoming or live) */}
          {(match.status === 'upcoming' || match.status === 'live') && (
            <div className="match-section">
              <h3 className="match-section-title">🪙 Toss</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  id="toss-winner-select"
                  className="team-form-input"
                  style={{ flex: 1, minWidth: 160 }}
                  value={match.tossWinnerId}
                  onChange={e => updateMatch(match.id, { tossWinnerId: e.target.value })}
                >
                  <option value="">— Toss winner —</option>
                  <option value={match.team1Id}>{match.team1Logo} {match.team1Name}</option>
                  <option value={match.team2Id}>{match.team2Logo} {match.team2Name}</option>
                </select>
                <select
                  id="toss-decision-select"
                  className="team-form-input"
                  style={{ flex: 1, minWidth: 140 }}
                  value={match.tossDecision}
                  onChange={e => updateMatch(match.id, { tossDecision: e.target.value as 'bat' | 'field' })}
                >
                  <option value="">— Decision —</option>
                  <option value="bat">Bat first</option>
                  <option value="field">Field first</option>
                </select>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )

  if (isPublic) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh', background: '#090d16', color: '#f1f5f9' }}>
        {/* Simple Public Header */}
        <nav className="shell-navbar" style={{ position: 'static', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
          <div className="shell-navbar-inner" style={{ justifyContent: 'space-between', padding: '0 24px' }}>
            <div className="shell-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
              <span className="shell-logo-icon">🏏</span>
              <span className="shell-logo-text">GullyScore</span>
            </div>
            <button className="team-btn team-btn--primary team-btn--sm" onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
        </nav>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 64px' }}>
          {content}
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      {content}
    </AppShell>
  )
}
