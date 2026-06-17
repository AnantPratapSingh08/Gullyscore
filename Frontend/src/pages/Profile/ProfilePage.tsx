// src/pages/Profile/ProfilePage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// User Profile page.
//  - Displays account info (name, email, joined date, provider)
//  - Edit display name (persisted to Firebase Auth + Firestore)
//  - Shows career stats aggregated across all Firestore player documents
//    linked to this user account.
//  - Change password (send reset email).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth'
import {
  doc, updateDoc, collection, query, where, getDocs,
} from 'firebase/firestore'
import { auth, db } from '../../services/firebase'
import { useAuth } from '../../context/AuthContext'
import { AppShell } from '../../components/team/AppShell'
import { useToast, ToastContainer } from '../../components/common/Toast'
import '../../styles/profile.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CareerStats {
  matches:    number
  runs:       number
  wickets:    number
  sixes:      number
  fours:      number
  strikeRate: number
  economy:    number
  average:    number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: unknown): string {
  if (!ts) return '—'
  // Firestore Timestamp
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    return new Date((ts as { seconds: number }).seconds * 1000).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }
  return '—'
}

function buildInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function StatCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="profile-stat-card">
      <span className="profile-stat-value">{value}{unit}</span>
      <span className="profile-stat-label">{label}</span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, userProfile } = useAuth()
  const { toasts, showToast, dismissToast } = useToast()

  // ── Derived display name ───────────────────────────────────────────────────
  const currentName =
    userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'Player'

  const [editMode,   setEditMode]   = useState(false)
  const [nameInput,  setNameInput]  = useState(currentName)
  const [saving,     setSaving]     = useState(false)
  const [resetting,  setResetting]  = useState(false)
  const [stats,      setStats]      = useState<CareerStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Sync name input when profile loads
  useEffect(() => {
    setNameInput(currentName)
  }, [currentName])

  // ── Fetch aggregated career stats ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return

    const fetchStats = async () => {
      try {
        const q = query(
          collection(db, 'players'),
          where('createdBy', '==', user.uid),
        )
        const snap = await getDocs(q)

        let matches    = 0
        let runs       = 0
        let wickets    = 0
        let sixes      = 0
        let fours      = 0
        let ballsFaced = 0
        let ballsBowled= 0
        let runsConceded= 0

        snap.docs.forEach(d => {
          const p = d.data() as Record<string, unknown>
          matches     += (p.matches     as number) ?? 0
          runs        += (p.runs        as number) ?? 0
          wickets     += (p.wickets     as number) ?? 0
          sixes       += (p.sixes       as number) ?? 0
          fours       += (p.fours       as number) ?? 0
          ballsFaced  += (p.ballsFaced  as number) ?? 0
          ballsBowled += (p.ballsBowled as number) ?? 0
          runsConceded+= (p.runsConceded as number) ?? 0
        })

        const strikeRate = ballsFaced > 0 ? parseFloat(((runs / ballsFaced) * 100).toFixed(1)) : 0
        const economy    = ballsBowled > 0 ? parseFloat(((runsConceded / ballsBowled) * 6).toFixed(1)) : 0
        const average    = matches > 0 ? parseFloat((runs / matches).toFixed(1)) : 0

        setStats({ matches, runs, wickets, sixes, fours, strikeRate, economy, average })
      } catch (err) {
        console.error('[Profile] fetchStats error:', err)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchStats()
  }, [user])

  // ── Edit display name ──────────────────────────────────────────────────────
  const handleSaveName = async () => {
    const trimmed = nameInput.trim()
    if (!trimmed || !user) return
    if (trimmed === currentName) { setEditMode(false); return }

    setSaving(true)
    try {
      // Update Firebase Auth profile
      await updateProfile(user, { displayName: trimmed })
      // Update Firestore user document
      await updateDoc(doc(db, 'users', user.uid), { name: trimmed })
      showToast('Display name updated!', 'success')
      setEditMode(false)
    } catch (err) {
      console.error('[Profile] updateName error:', err)
      showToast('Failed to update name. Try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Reset password ─────────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!user?.email) return
    setResetting(true)
    try {
      await sendPasswordResetEmail(auth, user.email)
      showToast(`Reset link sent to ${user.email}`, 'success')
    } catch (err) {
      console.error('[Profile] resetPassword error:', err)
      showToast('Failed to send reset email.', 'error')
    } finally {
      setResetting(false)
    }
  }

  const isGoogleUser = user?.providerData?.some(p => p.providerId === 'google.com')
  const initials = buildInitials(currentName)
  const joinedDate = formatDate(userProfile?.createdAt)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="profile-page">
        {/* Page header */}
        <div className="profile-header-section">
          <div className="profile-hero-card">
            {/* Avatar ring */}
            <div className="profile-avatar-ring">
              <div className="profile-avatar-inner">{initials}</div>
            </div>

            {/* Name / edit inline */}
            <div className="profile-hero-info">
              {editMode ? (
                <div className="profile-edit-row">
                  <input
                    id="profile-name-input"
                    className="profile-name-input"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
                    autoFocus
                    maxLength={50}
                  />
                  <button
                    id="profile-save-btn"
                    className="profile-btn profile-btn--save"
                    onClick={handleSaveName}
                    disabled={saving}
                  >
                    {saving ? <span className="team-spinner" style={{ width: 14, height: 14 }} /> : 'Save'}
                  </button>
                  <button
                    id="profile-cancel-btn"
                    className="profile-btn profile-btn--cancel"
                    onClick={() => { setEditMode(false); setNameInput(currentName) }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="profile-name-row">
                  <h1 className="profile-display-name">{currentName}</h1>
                  {!isGoogleUser && (
                    <button
                      id="profile-edit-btn"
                      className="profile-edit-pencil"
                      onClick={() => setEditMode(true)}
                      title="Edit display name"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              )}

              <p className="profile-email">{user?.email}</p>

              <div className="profile-badges">
                <span className="profile-badge profile-badge--provider">
                  {isGoogleUser ? '🌐 Google Account' : '📧 Email Account'}
                </span>
                {joinedDate !== '—' && (
                  <span className="profile-badge profile-badge--joined">
                    📅 Joined {joinedDate}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Career Stats */}
        <section className="profile-section">
          <h2 className="profile-section-title">
            <span className="profile-section-icon">📊</span>
            Career Stats
          </h2>

          {statsLoading ? (
            <div className="profile-stats-loading">
              <div className="team-spinner" />
              <span>Loading career stats…</span>
            </div>
          ) : stats === null || stats.matches === 0 ? (
            <div className="profile-stats-empty">
              <span className="profile-empty-icon">🏏</span>
              <p>No stats yet — add players from your teams and start recording matches!</p>
            </div>
          ) : (
            <div className="profile-stats-grid">
              <StatCard label="Matches"     value={stats.matches} />
              <StatCard label="Runs"        value={stats.runs} />
              <StatCard label="Wickets"     value={stats.wickets} />
              <StatCard label="Sixes"       value={stats.sixes} />
              <StatCard label="Fours"       value={stats.fours} />
              <StatCard label="Average"     value={stats.average} />
              <StatCard label="Strike Rate" value={stats.strikeRate} />
              <StatCard label="Economy"     value={stats.economy} />
            </div>
          )}
        </section>

        {/* Account Actions */}
        <section className="profile-section">
          <h2 className="profile-section-title">
            <span className="profile-section-icon">⚙️</span>
            Account Actions
          </h2>

          <div className="profile-actions-grid">
            {!isGoogleUser && (
              <div className="profile-action-card">
                <div className="profile-action-icon">🔑</div>
                <div className="profile-action-info">
                  <h3>Change Password</h3>
                  <p>We'll send a reset link to your email address.</p>
                </div>
                <button
                  id="profile-reset-password-btn"
                  className="profile-btn profile-btn--secondary"
                  onClick={handleResetPassword}
                  disabled={resetting}
                >
                  {resetting ? (
                    <><span className="team-spinner" style={{ width: 14, height: 14 }} /> Sending…</>
                  ) : 'Send Reset Email'}
                </button>
              </div>
            )}

            <div className="profile-action-card profile-action-card--info">
              <div className="profile-action-icon">🆔</div>
              <div className="profile-action-info">
                <h3>User ID</h3>
                <p className="profile-uid">{user?.uid ?? '—'}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
