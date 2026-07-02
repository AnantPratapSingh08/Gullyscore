// src/pages/Leaderboard/LeaderboardPage.tsx
import { useState, useEffect } from 'react'
import { AppShell } from '../../components/team/AppShell'
import { useToast, ToastContainer } from '../../components/common/Toast'
import { useActiveTournament } from '../../context/ActiveTournamentContext'
import {
  subscribeToTournamentLeaderboard,
  type LeaderboardData,
  type PlayerRankEntry,
  type TeamRankEntry,
} from '../../services/leaderboardService'
import { exportPlayerStatsPDF } from '../../services/pdfService'
import '../../styles/teams.css'
import '../../styles/leaderboard.css'

// ── Category config ───────────────────────────────────────────────────────────

type CategoryKey =
  | 'runs'
  | 'wickets'
  | 'sixes'
  | 'fours'
  | 'strikeRate'
  | 'economy'
  | 'teams'

interface Category {
  key:       CategoryKey
  label:     string
  icon:      string
  valueLabel: string
  subLabel:  string
  colorCls:  string
  isTeam?:   boolean
}

const CATEGORIES: Category[] = [
  { key: 'runs',       label: 'Run Scorers',  icon: '🏏', valueLabel: 'Runs',    subLabel: 'Matches',  colorCls: 'lb-value--amber'  },
  { key: 'wickets',    label: 'Wicket Takers',icon: '⚡', valueLabel: 'Wickets', subLabel: 'Matches',  colorCls: 'lb-value--purple' },
  { key: 'sixes',      label: 'Power Hitters',icon: '💥', valueLabel: 'Power',   subLabel: 'Runs',     colorCls: 'lb-value--red'    },
  { key: 'fours',      label: 'Run Makers',   icon: '🎯', valueLabel: 'Runs',    subLabel: 'Matches',  colorCls: 'lb-value--cyan'   },
  { key: 'strikeRate', label: 'Strike Rate',  icon: '📈', valueLabel: 'SR',      subLabel: 'Matches',  colorCls: 'lb-value--green'  },
  { key: 'economy',    label: 'Economy',      icon: '🎳', valueLabel: 'Eco',     subLabel: 'Wickets',  colorCls: 'lb-value--cyan'   },
  { key: 'teams',      label: 'Teams',        icon: '🏆', valueLabel: 'Runs',    subLabel: 'Players',  colorCls: 'lb-value--amber', isTeam: true },
]

function getEntries(data: LeaderboardData, key: CategoryKey): PlayerRankEntry[] {
  switch (key) {
    case 'runs':       return data.topRunScorers
    case 'wickets':    return data.topWicketTakers
    case 'sixes':      return data.mostSixes
    case 'fours':      return data.mostFours
    case 'strikeRate': return data.bestStrikeRate
    case 'economy':    return data.bestEconomy
    default:           return []
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div
      className="lb-podium-avatar"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  )
}

// ── Player Stats Table ────────────────────────────────────────────────────────
function PlayerStatsTable({ entries, cat }: { entries: PlayerRankEntry[]; cat: Category }) {
  if (entries.length === 0) return null

  const isBowling = cat.key === 'wickets' || cat.key === 'economy'

  return (
    <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid rgba(31, 41, 55, 0.05)' }}>
      <table className="dash-table" style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(31, 41, 55, 0.02)', borderBottom: '1px solid rgba(31, 41, 55, 0.05)' }}>
            <th style={{ padding: '12px 14px', textAlign: 'left', width: 60 }}>Rank</th>
            <th style={{ padding: '12px 14px', textAlign: 'left' }}>Player</th>
            <th style={{ padding: '12px 14px', textAlign: 'left' }}>Team</th>
            <th style={{ padding: '12px 14px', textAlign: 'center' }}>Mat</th>
            {!isBowling ? (
              <>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Runs</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Avg</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>SR</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>4s</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>6s</th>
              </>
            ) : (
              <>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Wkts</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Eco</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Avg</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const rowBg = i % 2 === 0 ? 'rgba(31, 41, 55, 0.02)' : 'transparent'
            return (
              <tr 
                key={e.playerId} 
                style={{ 
                  background: rowBg,
                  borderBottom: '1px solid rgba(31, 41, 55, 0.05)',
                  transition: 'background 0.2s'
                }}
              >
                <td style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>
                  {e.rank <= 3 ? ['🥇','🥈','🥉'][e.rank - 1] : `#${e.rank}`}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={e.playerName} size={32} />
                    <span style={{ color: '#1f2937', fontWeight: 600 }}>{e.playerName}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'left', color: '#64748b' }}>{e.teamName}</td>
                <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b' }}>{e.matches}</td>
                
                {!isBowling ? (
                  <>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: cat.key === 'runs' ? '#10b981' : '#1f2937' }}>{e.runs}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b' }}>{e.average.toFixed(2)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: cat.key === 'strikeRate' ? '#10b981' : '#64748b' }}>{e.strikeRate.toFixed(2)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: cat.key === 'fours' ? '#10b981' : '#64748b' }}>{e.fours}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: cat.key === 'sixes' ? '#10b981' : '#64748b' }}>{e.sixes}</td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: cat.key === 'wickets' ? '#10b981' : '#1f2937' }}>{e.wickets}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: cat.key === 'economy' ? '#10b981' : '#64748b' }}>{e.economy.toFixed(2)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b' }}>{e.average.toFixed(2)}</td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Team rows ─────────────────────────────────────────────────────────────────
function TeamRows({ entries }: { entries: TeamRankEntry[] }) {
  if (entries.length === 0) return null

  return (
    <>
      <div className="lb-team-thead">
        <span>#</span>
        <span>Team</span>
        <span>Runs</span>
        <span>Matches</span>
      </div>
      <div className="lb-list">
        {entries.map(t => (
          <div key={t.teamId} className="lb-team-row">
            <div className={`lb-rank${t.rank <= 3 ? ` lb-rank--${t.rank}` : ''}`}>
              {t.rank <= 3 ? ['🥇','🥈','🥉'][t.rank - 1] : t.rank}
            </div>
            <div className="lb-team-info">
              <div className="lb-team-name">{t.logo} {t.teamName}</div>
              <div className="lb-team-sub">Team</div>
            </div>
            <div>
              <div className="lb-team-stat">{t.totalRuns.toLocaleString()}</div>
              <div className="lb-team-stat-label">Runs</div>
            </div>
            <div>
              <div className="lb-team-stat">{t.matches || '—'}</div>
              <div className="lb-team-stat-label">Matches</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ label }: { label: string }) {
  return (
    <div className="lb-empty">
      <div className="lb-empty-icon">📊</div>
      <p className="lb-empty-title">No {label} data yet</p>
      <p className="lb-empty-sub">Rankings will appear once players have recorded statistics.</p>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function LbSection({
  cat, data,
}: {
  cat: Category
  data: LeaderboardData
}) {
  if (cat.isTeam) {
    const entries = data.teamRankings
    return (
      <div className="lb-section">
        <div className="lb-section-header">
          <h2 className="lb-section-title">
            <span className="lb-section-icon">{cat.icon}</span>
            Team Rankings
          </h2>
          <span className="lb-section-desc">Ranked by total team runs</span>
        </div>
        {entries.length > 0 ? <TeamRows entries={entries} /> : <EmptyState label="team" />}
      </div>
    )
  }

  const entries = getEntries(data, cat.key)

  const descMap: Record<CategoryKey, string> = {
    runs:       'Most career runs scored',
    wickets:    'Most career wickets taken',
    sixes:      'Highest power-hitting index (SR × Runs / 100)',
    fours:      'Most runs scored (boundary contributors)',
    strikeRate: 'Best batting strike rate (min 1 match)',
    economy:    'Best bowling economy (min 1 match)',
    teams:      '',
  }

  return (
    <div className="lb-section">
      <div className="lb-section-header">
        <h2 className="lb-section-title">
          <span className="lb-section-icon">{cat.icon}</span>
          {cat.label}
        </h2>
        <span className="lb-section-desc">{descMap[cat.key]}</span>
      </div>
      {entries.length > 0 ? (
        <PlayerStatsTable entries={entries} cat={cat} />
      ) : (
        <EmptyState label={cat.label.toLowerCase()} />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const { toasts, dismissToast } = useToast()
  const { activeTournament } = useActiveTournament()
  const [activeKey, setActiveKey] = useState<CategoryKey>('runs')
  const [data,    setData]    = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const tournamentId = activeTournament?.id
  const teamIds = activeTournament?.teamIds ?? []

  useEffect(() => {
    setLoading(true)
    const unsub = subscribeToTournamentLeaderboard(tournamentId, teamIds, lb => {
      setData(lb)
      setLoading(false)
    })
    return unsub
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, JSON.stringify(teamIds)])

  const activeCat = CATEGORIES.find(c => c.key === activeKey)!

  const handleExportStats = () => {
    if (!data || !activeTournament) return
    const map = new Map<string, any>()
    const getPlayer = (id: string, name: string, team: string) => {
      if (!map.has(id)) map.set(id, { name, team, role: 'Player', matches: 0, runs: 0, hs: '-', avg: '-', sr: '-', fours: 0, sixes: 0, wickets: 0, economy: '-', catches: 0 })
      return map.get(id)
    }
    
    data.topRunScorers.forEach(e => { const p = getPlayer(e.playerId, e.playerName, e.teamName); p.runs = e.value; p.matches = Math.max(p.matches, e.secondary || 0) })
    data.topWicketTakers.forEach(e => { const p = getPlayer(e.playerId, e.playerName, e.teamName); p.wickets = e.value; p.matches = Math.max(p.matches, e.secondary || 0) })
    data.mostSixes.forEach(e => { const p = getPlayer(e.playerId, e.playerName, e.teamName); p.sixes = e.value })
    data.mostFours.forEach(e => { const p = getPlayer(e.playerId, e.playerName, e.teamName); p.fours = e.value })
    data.bestStrikeRate.forEach(e => { const p = getPlayer(e.playerId, e.playerName, e.teamName); p.sr = e.value.toFixed(2) })
    data.bestEconomy.forEach(e => { const p = getPlayer(e.playerId, e.playerName, e.teamName); p.economy = e.value.toFixed(2) })
    ;(data.mostCatches || []).forEach(e => { const p = getPlayer(e.playerId, e.playerName, e.teamName); p.catches = e.value })
    
    exportPlayerStatsPDF(activeTournament.name, activeTournament.logo, Array.from(map.values()))
  }

  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="lb-page">

        {/* Header */}
        <div className="lb-header">
          <div className="lb-title-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div>
              <h1 className="lb-title">
                <span className="lb-title-icon">🏆</span>
                Leaderboard
                {activeTournament && <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b', marginLeft: 8 }}>· {activeTournament.name}</span>}
              </h1>
              <p className="lb-subtitle">Real-time rankings for this tournament</p>
              {data && (
                <div className="lb-updated">
                  <span className="lb-updated-dot" />
                  Updated {data.lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
            {data && (
              <button className="team-btn team-btn--outline team-btn--sm" onClick={handleExportStats}>
                📄 Download Stats PDF
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="lb-tabs" role="tablist">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              role="tab"
              aria-selected={activeKey === cat.key}
              className={`lb-tab${activeKey === cat.key ? ` lb-tab--active${cat.isTeam ? ' lb-tab--teams' : ''}` : ''}`}
              onClick={() => setActiveKey(cat.key)}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="lb-loading">
            <div className="team-spinner team-spinner--lg" />
            <p>Loading leaderboards…</p>
          </div>
        ) : data ? (
          <LbSection key={activeKey} cat={activeCat} data={data} />
        ) : (
          <EmptyState label="leaderboard" />
        )}
      </div>
    </AppShell>
  )
}
