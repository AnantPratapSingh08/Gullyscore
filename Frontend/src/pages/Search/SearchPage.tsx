// src/pages/Search/SearchPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Global search page — search across tournaments, teams, players, matches.
// Tournament-isolated: results are scoped to joined tournaments.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/team/AppShell'
import { useActiveTournament } from '../../context/ActiveTournamentContext'
import { globalSearch, type SearchResult } from '../../services/searchService'
import type { SearchResultType } from '../../services/searchService'

// ── Result type config ────────────────────────────────────────────────────────

const TYPE_LABEL: Record<SearchResultType, string> = {
  tournament: 'Tournament',
  team:       'Team',
  player:     'Player',
  match:      'Match',
}

const TYPE_COLOR: Record<SearchResultType, string> = {
  tournament: '#22d3ee',
  team:       '#f59e0b',
  player:     '#a78bfa',
  match:      '#34d399',
}

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: SearchResult }) {
  const navigate = useNavigate()
  return (
    <div
      className="search-result-card"
      onClick={() => navigate(result.link)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(result.link)}
      style={{ '--search-accent': TYPE_COLOR[result.type] } as React.CSSProperties}
    >
      <div className="search-result-icon">{result.icon}</div>
      <div className="search-result-info">
        <div className="search-result-title">{result.title}</div>
        <div className="search-result-sub">{result.subtitle}</div>
      </div>
      <span
        className="search-result-type"
        style={{ color: TYPE_COLOR[result.type], borderColor: `${TYPE_COLOR[result.type]}33` }}
      >
        {TYPE_LABEL[result.type]}
      </span>
      <svg className="search-result-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const { joinedTournaments, activeTournamentId } = useActiveTournament()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [query,    setQuery]    = useState(searchParams.get('q') || '')
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState(false)

  const [activeFilter, setActiveFilter] = useState<SearchResultType | 'all'>('all')

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const joinedIds = joinedTournaments.map(t => t.id)

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    try {
      const res = await globalSearch(q, joinedIds, activeTournamentId)
      setResults(res)
      setSearched(true)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournamentId, JSON.stringify(joinedIds)])

  // Auto-search when URL param is set
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setQuery(q)
      doSearch(q)
    }
    inputRef.current?.focus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced search on query change
  function handleQueryChange(val: string) {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 400)
  }

  const filtered = activeFilter === 'all'
    ? results
    : results.filter(r => r.type === activeFilter)

  const typeCounts: Record<SearchResultType | 'all', number> = {
    all:        results.length,
    tournament: results.filter(r => r.type === 'tournament').length,
    team:       results.filter(r => r.type === 'team').length,
    player:     results.filter(r => r.type === 'player').length,
    match:      results.filter(r => r.type === 'match').length,
  }

  const FILTERS: Array<{ key: SearchResultType | 'all'; label: string; icon: string }> = [
    { key: 'all',        label: 'All',         icon: '🔍' },
    { key: 'tournament', label: 'Tournaments',  icon: '🎯' },
    { key: 'team',       label: 'Teams',        icon: '🏆' },
    { key: 'player',     label: 'Players',      icon: '🏏' },
    { key: 'match',      label: 'Matches',      icon: '📋' },
  ]

  return (
    <AppShell>
      <div className="search-page">
        <div className="search-header">
          <button className="team-back-btn" onClick={() => navigate(-1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          <h1 className="search-title">
            <span className="search-title-icon">🔍</span>
            Global Search
          </h1>
          <p className="search-subtitle">Search across tournaments, teams, players & matches</p>
        </div>

        {/* Search input */}
        <div className="search-input-wrap">
          <svg className="search-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            id="global-search-input"
            className="search-input"
            type="text"
            placeholder="Search tournament, player, team, match…"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            autoFocus
            autoComplete="off"
          />
          {query && (
            <button className="search-clear-btn" onClick={() => { setQuery(''); setResults([]); setSearched(false) }}>
              ×
            </button>
          )}
          {loading && <div className="search-loading-spin" />}
        </div>

        {/* Filter pills */}
        {searched && (
          <div className="search-filters" role="group">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`search-filter-pill${activeFilter === f.key ? ' search-filter-pill--active' : ''}`}
                onClick={() => setActiveFilter(f.key)}
              >
                {f.icon} {f.label}
                <span className="search-filter-count">{typeCounts[f.key]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="search-state">
            <div className="team-spinner team-spinner--lg" />
            <p>Searching…</p>
          </div>
        ) : searched && filtered.length === 0 ? (
          <div className="search-state">
            <div className="search-state-icon">🔍</div>
            <h2 className="search-state-title">No results found</h2>
            <p className="search-state-sub">
              Try a different search term or check your spelling.
            </p>
          </div>
        ) : !searched ? (
          <div className="search-state">
            <div className="search-state-icon">✨</div>
            <h2 className="search-state-title">Start Searching</h2>
            <p className="search-state-sub">
              Type at least 2 characters to search across your tournaments.
            </p>
          </div>
        ) : (
          <div className="search-results">
            <p className="search-count">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
            <div className="search-results-list">
              {filtered.map(result => (
                <ResultCard key={`${result.type}-${result.id}`} result={result} />
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{SEARCH_PAGE_STYLES}</style>
    </AppShell>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const SEARCH_PAGE_STYLES = `
  .search-page {
    max-width: 740px;
    margin: 0 auto;
    padding: 0 0 60px;
  }
  .search-header {
    margin-bottom: 28px;
  }
  .search-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: clamp(22px, 4vw, 30px);
    font-weight: 800;
    color: #f1f5f9;
    margin: 12px 0 6px;
  }
  .search-title-icon { font-size: 0.9em; }
  .search-subtitle {
    font-size: 14px;
    color: #64748b;
    margin: 0;
  }

  /* Input */
  .search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }
  .search-input-icon {
    position: absolute;
    left: 16px;
    color: #475569;
    pointer-events: none;
    flex-shrink: 0;
  }
  .search-input {
    width: 100%;
    padding: 14px 48px 14px 48px;
    background: rgba(255,255,255,0.05);
    border: 1.5px solid rgba(255,255,255,0.10);
    border-radius: 14px;
    color: #f1f5f9;
    font-size: 16px;
    font-family: inherit;
    transition: border-color 0.2s;
    outline: none;
  }
  .search-input:focus {
    border-color: rgba(34,211,238,0.4);
    box-shadow: 0 0 0 3px rgba(34,211,238,0.08);
  }
  .search-input::placeholder { color: #475569; }
  .search-clear-btn {
    position: absolute;
    right: 48px;
    background: none;
    border: none;
    color: #475569;
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    transition: color 0.15s;
  }
  .search-clear-btn:hover { color: #94a3b8; }
  .search-loading-spin {
    position: absolute;
    right: 16px;
    width: 18px;
    height: 18px;
    border: 2px solid rgba(34,211,238,0.2);
    border-top-color: #22d3ee;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Filter pills */
  .search-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 24px;
  }
  .search-filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1.5px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    color: #94a3b8;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.18s ease;
  }
  .search-filter-pill:hover:not(.search-filter-pill--active) {
    border-color: rgba(34,211,238,0.3);
    color: #e2e8f0;
  }
  .search-filter-pill--active {
    border-color: #22d3ee;
    background: rgba(34,211,238,0.1);
    color: #22d3ee;
  }
  .search-filter-count {
    background: rgba(255,255,255,0.08);
    border-radius: 999px;
    padding: 1px 7px;
    font-size: 11px;
    font-weight: 700;
  }
  .search-filter-pill--active .search-filter-count {
    background: rgba(34,211,238,0.2);
  }

  /* State (empty/initial) */
  .search-state {
    text-align: center;
    padding: 60px 20px;
  }
  .search-state-icon { font-size: 48px; margin-bottom: 16px; }
  .search-state-title {
    font-size: 20px;
    font-weight: 700;
    color: #e2e8f0;
    margin: 0 0 8px;
  }
  .search-state-sub {
    font-size: 14px;
    color: #64748b;
    margin: 0;
  }

  /* Results */
  .search-count {
    font-size: 12px;
    color: #64748b;
    margin: 0 0 16px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .search-results-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .search-result-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  .search-result-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--search-accent, #22d3ee);
    opacity: 0;
    transition: opacity 0.2s;
  }
  .search-result-card:hover {
    border-color: rgba(255,255,255,0.14);
    transform: translateX(4px);
    background: rgba(255,255,255,0.05);
  }
  .search-result-card:hover::before { opacity: 1; }
  .search-result-icon {
    font-size: 22px;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255,255,255,0.04);
    border-radius: 10px;
  }
  .search-result-info { flex: 1; min-width: 0; }
  .search-result-title {
    font-size: 14px;
    font-weight: 700;
    color: #f1f5f9;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .search-result-sub {
    font-size: 12px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .search-result-type {
    font-size: 10px;
    font-weight: 700;
    border: 1px solid;
    border-radius: 999px;
    padding: 2px 8px;
    white-space: nowrap;
    flex-shrink: 0;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .search-result-arrow {
    color: #334155;
    flex-shrink: 0;
    transition: color 0.2s;
  }
  .search-result-card:hover .search-result-arrow { color: #64748b; }

  /* Responsive */
  @media (max-width: 480px) {
    .search-input { font-size: 14px; padding: 12px 44px; }
    .search-result-type { display: none; }
    .search-filter-pill { padding: 5px 10px; font-size: 12px; }
  }
`
