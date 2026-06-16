// src/pages/Leaderboard/LeaderboardPage.tsx
import { useState, useEffect } from 'react'
import { AppShell } from '../../components/team/AppShell'
import { useToast, ToastContainer } from '../../components/common/Toast'
import {
  subscribeToLeaderboard,
  type LeaderboardData,
  type PlayerRankEntry,
  type TeamRankEntry,
} from '../../services/leaderboardService'
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

// ── Podium (top 3) ────────────────────────────────────────────────────────────
function Podium({ entries, cat }: { entries: PlayerRankEntry[]; cat: Category }) {
  const top3 = entries.slice(0, 3)
  if (top3.length === 0) return null

  // Display order: 2nd, 1st, 3rd
  const order = [top3[1], top3[0], top3[2]].filter(Boolean)

  return (
    <div className="lb-podium">
      {order.map((e) => (
        <div key={e.playerId} className={`lb-podium-card lb-podium-card--${e.rank}`}>
          <div className="lb-podium-badge">{e.badge}</div>
          <Avatar name={e.playerName} size={e.rank === 1 ? 60 : 48} />
          <div className="lb-podium-name">{e.playerName}</div>
          <div className="lb-podium-team">{e.teamName}</div>
          <div className={`lb-podium-value ${cat.colorCls}`}>
            {cat.key === 'strikeRate' || cat.key === 'economy' ? e.value.toFixed(2) : e.value}
          </div>
          <div className="lb-podium-label">{cat.valueLabel}</div>
        </div>
      ))}
    </div>
  )
}

// ── Player ranked rows (4th onwards) ─────────────────────────────────────────
function PlayerRows({ entries, cat }: { entries: PlayerRankEntry[]; cat: Category }) {
  const rest = entries.slice(3)
  if (rest.length === 0) return null

  return (
    <div className="lb-list">
      {rest.map(e => (
        <div key={e.playerId} className={`lb-row${e.rank <= 3 ? ' lb-row--top' : ''}`}>
          <div className={`lb-rank${e.rank <= 3 ? ` lb-rank--${e.rank}` : ''}`}>
            {e.badge ?? e.rank}
          </div>
          <div className="lb-player-info">
            <div className="lb-player-name">{e.playerName}</div>
            <div className="lb-player-team">{e.teamName}</div>
          </div>
          <div className="lb-value-col">
            <span className={`lb-value ${cat.colorCls}`}>
              {cat.key === 'strikeRate' || cat.key === 'economy' ? e.value.toFixed(2) : e.value}
            </span>
            {e.secondary !== undefined && (
              <span className="lb-value-sub">{e.secondary} {cat.subLabel.toLowerCase()}</span>
            )}
          </div>
        </div>
      ))}
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
        <span>Players</span>
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
        <>
          <Podium entries={entries} cat={cat} />
          <PlayerRows entries={entries} cat={cat} />
        </>
      ) : (
        <EmptyState label={cat.label.toLowerCase()} />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const { toasts, dismissToast } = useToast()
  const [activeKey, setActiveKey] = useState<CategoryKey>('runs')
  const [data,    setData]    = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = subscribeToLeaderboard(lb => {
      setData(lb)
      setLoading(false)
    })
    return unsub
  }, [])

  const activeCat = CATEGORIES.find(c => c.key === activeKey)!

  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="lb-page">

        {/* Header */}
        <div className="lb-header">
          <div className="lb-title-block">
            <h1 className="lb-title">
              <span className="lb-title-icon">🏆</span>
              Leaderboard
            </h1>
            <p className="lb-subtitle">Real-time rankings across all players and teams</p>
            {data && (
              <div className="lb-updated">
                <span className="lb-updated-dot" />
                Updated {data.lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
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
