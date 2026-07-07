// src/services/pdfService.ts
// PDF export service using jsPDF — stats, points table, scorecard.

import jsPDF from 'jspdf'

// ── Design tokens ─────────────────────────────────────────────────────────────
const CLR = {
  bg:      '#0a0f1e',
  surface: '#111827',
  accent:  '#22d3ee',
  gold:    '#f59e0b',
  text:    '#f1f5f9',
  muted:   '#64748b',
  green:   '#34d399',
  red:     '#f87171',
  purple:  '#a78bfa',
}

function stripEmojis(str: string): string {
  if (!str) return ''
  return String(str).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{2B50}]/gu, '').trim()
}

function hexToRgb(color: string): [number, number, number] {
  if (color.startsWith('rgb')) {
    const match = color.match(/[\d.]+/g)
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10)
      const g = parseInt(match[1], 10)
      const b = parseInt(match[2], 10)
      if (match.length >= 4) {
        const a = parseFloat(match[3])
        return [
          Math.round(r * a + 10 * (1 - a)),
          Math.round(g * a + 15 * (1 - a)),
          Math.round(b * a + 30 * (1 - a))
        ]
      }
      return [r, g, b]
    }
  }
  let hex = color.startsWith('#') ? color.slice(1) : color
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  const r = parseInt(hex.slice(0, 2), 16) || 0
  const g = parseInt(hex.slice(2, 4), 16) || 0
  const b = parseInt(hex.slice(4, 6), 16) || 0
  return [r, g, b]
}

function setFill(pdf: jsPDF, hex: string) {
  pdf.setFillColor(...hexToRgb(hex))
}
function setTextColor(pdf: jsPDF, hex: string) {
  pdf.setTextColor(...hexToRgb(hex))
}
function setDrawColor(pdf: jsPDF, hex: string) {
  pdf.setDrawColor(...hexToRgb(hex))
}

// ── Header banner ────────────────────────────────────────────────────────────

function drawHeader(pdf: jsPDF, title: string, subtitle: string, logo?: string) {
  const W = pdf.internal.pageSize.getWidth()
  // Background
  setFill(pdf, CLR.bg)
  pdf.rect(0, 0, W, 42, 'F')
  // Accent stripe
  setFill(pdf, CLR.accent)
  pdf.rect(0, 0, 4, 42, 'F')

  // Logo/emoji (left side)
  if (logo) {
    pdf.setFontSize(22)
    pdf.text(stripEmojis(logo), 14, 20)
  }

  const x = logo ? 34 : 14
  setTextColor(pdf, CLR.accent)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.text(stripEmojis('GULLYSCORE'), x, 12)

  setTextColor(pdf, CLR.text)
  pdf.setFontSize(16)
  pdf.text(stripEmojis(title), x, 24)

  setTextColor(pdf, CLR.muted)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.text(stripEmojis(subtitle), x, 33)

  // Date stamp
  setTextColor(pdf, CLR.muted)
  pdf.setFontSize(7)
  pdf.text(`Generated: ${new Date().toLocaleString('en-IN')}`, W - 14, 12, { align: 'right' })
}

// ── Section heading ───────────────────────────────────────────────────────────

function drawSection(pdf: jsPDF, title: string, y: number): number {
  const W = pdf.internal.pageSize.getWidth()
  setFill(pdf, CLR.surface)
  pdf.rect(0, y, W, 10, 'F')
  setTextColor(pdf, CLR.accent)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.text(stripEmojis(title), 14, y + 7)
  return y + 14
}

// ── Table helpers ─────────────────────────────────────────────────────────────

interface ColDef { label: string; key: string; width: number; align?: 'left' | 'center' | 'right' }

function drawTable(
  pdf: jsPDF,
  cols: ColDef[],
  rows: Record<string, string | number>[],
  startY: number,
  rowHighlight?: (row: Record<string, string | number>, i: number) => string | null,
): number {
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const HEADER_H = 9
  const ROW_H    = 8
  const PAD_L    = 14

  let y = startY
  const totalW = cols.reduce((s, c) => s + c.width, 0)
  const scale  = (W - PAD_L * 2) / totalW

  // Column headers
  setFill(pdf, '#1e293b')
  pdf.rect(0, y, W, HEADER_H, 'F')
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')

  let cx = PAD_L
  for (const col of cols) {
    const cw = col.width * scale
    setTextColor(pdf, CLR.muted)
    const tx = col.align === 'right' ? cx + cw - 2 : col.align === 'center' ? cx + cw / 2 : cx + 2
    pdf.text(stripEmojis(col.label.toUpperCase()), tx, y + 6.5, { align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left' })
    cx += cw
  }
  y += HEADER_H

  // Rows
  pdf.setFont('helvetica', 'normal')
  for (let i = 0; i < rows.length; i++) {
    if (y + ROW_H > H - 16) {
      pdf.addPage()
      setFill(pdf, CLR.bg)
      pdf.rect(0, 0, W, H, 'F')
      y = 12
    }

    const row = rows[i]
    const hlColor = rowHighlight?.(row, i)
    if (hlColor) {
      setFill(pdf, hlColor)
      pdf.rect(0, y, W, ROW_H, 'F')
    } else if (i % 2 === 0) {
      setFill(pdf, 'rgba(255,255,255,0.02)')
      pdf.rect(0, y, W, ROW_H, 'F')
    }

    cx = PAD_L
    for (const col of cols) {
      const cw = col.width * scale
      const val = String(row[col.key] ?? '—')
      pdf.setFontSize(7.5)
      setTextColor(pdf, CLR.text)
      const tx = col.align === 'right' ? cx + cw - 2 : col.align === 'center' ? cx + cw / 2 : cx + 2
      pdf.text(stripEmojis(val), tx, y + 5.5, { align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left' })
      cx += cw
    }

    // Row separator
    setDrawColor(pdf, '#1e293b')
    pdf.setLineWidth(0.2)
    pdf.line(0, y + ROW_H, W, y + ROW_H)
    y += ROW_H
  }

  return y + 6
}

// ── Footer ────────────────────────────────────────────────────────────────────

function drawFooter(pdf: jsPDF) {
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  setFill(pdf, CLR.accent)
  pdf.rect(0, H - 2, W, 2, 'F')
  setTextColor(pdf, CLR.muted)
  pdf.setFontSize(6)
  pdf.text('GullyScore — Gully Cricket, Reimagined', W / 2, H - 4, { align: 'center' })
}

// ── Full page background ──────────────────────────────────────────────────────

function initPage(pdf: jsPDF) {
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  setFill(pdf, CLR.bg)
  pdf.rect(0, 0, W, H, 'F')
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

// ── 1. Points Table PDF ───────────────────────────────────────────────────────

export interface PointsTableRow {
  rank:     number
  team:     string
  logo:     string
  played:   number
  won:      number
  lost:     number
  nr:       number
  nrr:      string
  points:   number
  form:     string
}

export function exportPointsTablePDF(
  tournamentName: string,
  tournamentLogo: string,
  rows: PointsTableRow[],
): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  initPage(pdf)
  drawHeader(pdf, 'Points Table', tournamentName, tournamentLogo?.startsWith('http') ? undefined : tournamentLogo)

  let y = 48
  y = drawSection(pdf, '🏆 STANDINGS', y)

  const cols: ColDef[] = [
    { label: '#',      key: 'rank',   width: 10, align: 'center' },
    { label: 'Team',   key: 'team',   width: 55, align: 'left'   },
    { label: 'P',      key: 'played', width: 14, align: 'center' },
    { label: 'W',      key: 'won',    width: 14, align: 'center' },
    { label: 'L',      key: 'lost',   width: 14, align: 'center' },
    { label: 'NR',     key: 'nr',     width: 14, align: 'center' },
    { label: 'NRR',    key: 'nrr',    width: 22, align: 'right'  },
    { label: 'Pts',    key: 'points', width: 16, align: 'center' },
    { label: 'Form',   key: 'form',   width: 30, align: 'center' },
  ]

  const tableRows = rows.map(r => ({
    rank:   r.rank,
    team:   r.team,
    played: r.played,
    won:    r.won,
    lost:   r.lost,
    nr:     r.nr,
    nrr:    r.nrr,
    points: r.points,
    form:   r.form,
  }))

  drawTable(pdf, cols, tableRows, y, (_, i) => i === 0 ? 'rgba(34,211,238,0.08)' : null)
  drawFooter(pdf)
  pdf.save(`${(tournamentName || 'Tournament').replace(/\s+/g, '_')}_Points_Table.pdf`)
}

// ── 2. Player Stats PDF ───────────────────────────────────────────────────────

export interface PlayerStatRow {
  [key: string]: any
  name:       string
  team:       string
  role:       string
  matches:    number
  runs:       number
  hs:         number | string
  avg:        string
  sr:         string
  fours:      number
  sixes:      number
  wickets:    number
  economy:    string
  catches:    number
}

export function exportPlayerStatsPDF(
  tournamentName: string,
  tournamentLogo: string,
  players: PlayerStatRow[],
): void {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  initPage(pdf)
  drawHeader(pdf, 'Player Statistics', tournamentName, tournamentLogo?.startsWith('http') ? undefined : tournamentLogo)

  let y = 48

  // Batting section
  y = drawSection(pdf, '🏏 BATTING STATS', y)
  const battingCols: ColDef[] = [
    { label: 'Player',  key: 'name',    width: 40, align: 'left'   },
    { label: 'Team',    key: 'team',    width: 30, align: 'left'   },
    { label: 'Role',    key: 'role',    width: 22, align: 'left'   },
    { label: 'M',       key: 'matches', width: 12, align: 'center' },
    { label: 'Runs',    key: 'runs',    width: 16, align: 'center' },
    { label: 'HS',      key: 'hs',      width: 14, align: 'center' },
    { label: 'Avg',     key: 'avg',     width: 16, align: 'center' },
    { label: 'SR',      key: 'sr',      width: 16, align: 'center' },
    { label: '4s',      key: 'fours',   width: 12, align: 'center' },
    { label: '6s',      key: 'sixes',   width: 12, align: 'center' },
  ]
  const sorted = [...players].sort((a, b) => b.runs - a.runs)
  y = drawTable(pdf, battingCols, sorted, y)

  // Bowling section
  if (y + 60 > pdf.internal.pageSize.getHeight() - 20) {
    pdf.addPage(); initPage(pdf); y = 16
  }
  y = drawSection(pdf, '⚡ BOWLING STATS', y)
  const bowlingCols: ColDef[] = [
    { label: 'Player',   key: 'name',     width: 40, align: 'left'   },
    { label: 'Team',     key: 'team',     width: 30, align: 'left'   },
    { label: 'M',        key: 'matches',  width: 12, align: 'center' },
    { label: 'Wickets',  key: 'wickets',  width: 18, align: 'center' },
    { label: 'Economy',  key: 'economy',  width: 18, align: 'center' },
    { label: 'Catches',  key: 'catches',  width: 18, align: 'center' },
  ]
  const bowlSorted = [...players].sort((a, b) => b.wickets - a.wickets)
  drawTable(pdf, bowlingCols, bowlSorted, y)

  drawFooter(pdf)
  pdf.save(`${(tournamentName || 'Tournament').replace(/\s+/g, '_')}_Player_Stats.pdf`)
}

// ── 3. Match Scorecard PDF ────────────────────────────────────────────────────

export interface ScorecardBatsmanRow {
  [key: string]: any
  name:       string
  dismissal:  string
  runs:       number
  balls:      number
  fours:      number
  sixes:      number
  sr:         string
}

export interface ScorecardBowlerRow {
  [key: string]: any
  name:    string
  overs:   string
  maidens: number
  runs:    number
  wickets: number
  economy: string
}

export interface ScorecardInnings {
  teamName:  string
  score:     string
  overs:     string
  batsmen:   ScorecardBatsmanRow[]
  bowlers:   ScorecardBowlerRow[]
  extras?:   number
}

export function exportScorecardPDF(
  matchTitle:  string,
  venue:       string,
  date:        string,
  result:      string,
  innings1:    ScorecardInnings,
  innings2?:   ScorecardInnings,
): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  initPage(pdf)
  drawHeader(pdf, 'Match Scorecard', matchTitle, '🏏')

  // Result badge
  const W = pdf.internal.pageSize.getWidth()
  setFill(pdf, 'rgba(34,211,238,0.12)')
  pdf.roundedRect(14, 44, W - 28, 10, 2, 2, 'F')
  setTextColor(pdf, CLR.gold)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.text(result, W / 2, 50.5, { align: 'center' })

  setTextColor(pdf, CLR.muted)
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`📍 ${venue}   📅 ${date}`, W / 2, 60, { align: 'center' })

  let y = 66

  const renderInnings = (inn: ScorecardInnings) => {
    if (y + 20 > pdf.internal.pageSize.getHeight() - 20) {
      pdf.addPage(); initPage(pdf); y = 16
    }

    // Innings header
    setFill(pdf, CLR.surface)
    pdf.rect(0, y, W, 12, 'F')
    setFill(pdf, CLR.purple)
    pdf.rect(0, y, 3, 12, 'F')
    setTextColor(pdf, CLR.text)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.text(inn.teamName, 12, y + 8)
    setTextColor(pdf, CLR.accent)
    pdf.text(`${inn.score} (${inn.overs} ov)`, W - 14, y + 8, { align: 'right' })
    y += 16

    // Batting
    y = drawSection(pdf, 'BATTING', y)
    const batCols: ColDef[] = [
      { label: 'Batsman',  key: 'name',      width: 42, align: 'left'   },
      { label: 'Dismissal',key: 'dismissal', width: 48, align: 'left'   },
      { label: 'R',        key: 'runs',      width: 12, align: 'center' },
      { label: 'B',        key: 'balls',     width: 12, align: 'center' },
      { label: '4s',       key: 'fours',     width: 12, align: 'center' },
      { label: '6s',       key: 'sixes',     width: 12, align: 'center' },
      { label: 'SR',       key: 'sr',        width: 18, align: 'center' },
    ]
    y = drawTable(pdf, batCols, inn.batsmen, y)

    if (inn.extras !== undefined) {
      setTextColor(pdf, CLR.muted)
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'italic')
      pdf.text(`Extras: ${inn.extras}`, 14, y)
      y += 7
    }

    // Bowling
    if (y + 20 > pdf.internal.pageSize.getHeight() - 20) {
      pdf.addPage(); initPage(pdf); y = 16
    }
    y = drawSection(pdf, 'BOWLING', y)
    const bowlCols: ColDef[] = [
      { label: 'Bowler',  key: 'name',    width: 45, align: 'left'   },
      { label: 'O',       key: 'overs',   width: 16, align: 'center' },
      { label: 'M',       key: 'maidens', width: 14, align: 'center' },
      { label: 'R',       key: 'runs',    width: 16, align: 'center' },
      { label: 'W',       key: 'wickets', width: 16, align: 'center' },
      { label: 'Econ',    key: 'economy', width: 18, align: 'center' },
    ]
    y = drawTable(pdf, bowlCols, inn.bowlers, y)
    y += 4
  }

  renderInnings(innings1)
  if (innings2) renderInnings(innings2)

  drawFooter(pdf)
  pdf.save(`${(matchTitle || 'Match').replace(/\s+/g, '_')}_Scorecard.pdf`)
}
