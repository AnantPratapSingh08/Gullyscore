// src/services/notificationService.ts
// ─────────────────────────────────────────────────────────────────────────────
// In-app notification system using Firestore.
// Notifications are stored per-user under: users/{uid}/notifications/{notifId}
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection, doc, addDoc, updateDoc, getDocs, deleteDoc,
  onSnapshot, query, orderBy, limit, where,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'tournament_joined'
  | 'match_starting'
  | 'team_added'
  | 'player_added'
  | 'result_published'
  | 'info'

export interface Notification {
  id:          string
  type:        NotificationType
  title:       string
  message:     string
  read:        boolean
  link?:       string
  tournamentId?: string
  createdAt:   number   // epoch ms for ordering
}

// ── Emoji map ─────────────────────────────────────────────────────────────────

export const NOTIF_ICON: Record<NotificationType, string> = {
  tournament_joined: '🎯',
  match_starting:    '🏏',
  team_added:        '🏆',
  player_added:      '👤',
  result_published:  '🏆',
  info:              'ℹ️',
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createNotification(
  uid: string,
  payload: Omit<Notification, 'id' | 'read' | 'createdAt'>,
): Promise<void> {
  try {
    await addDoc(collection(db, 'users', uid, 'notifications'), {
      ...payload,
      read:      false,
      createdAt: Date.now(),
    })
  } catch {
    // Notifications are non-critical — swallow errors silently
  }
}

// ── Subscribe (real-time) ─────────────────────────────────────────────────────

export function subscribeToNotifications(
  uid: string,
  callback: (notifs: Notification[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, 'users', uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50),
    ),
    snap => {
      const notifs: Notification[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as Notification))
      callback(notifs)
    },
    () => callback([]),  // error → emit empty
  )
}

// ── Mark as read ───────────────────────────────────────────────────────────────

export async function markNotificationRead(uid: string, notifId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid, 'notifications', notifId), { read: true })
  } catch {}
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'notifications'), where('read', '==', false))
    )
    await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read: true })))
  } catch {}
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deleteNotification(uid: string, notifId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid, 'notifications', notifId))
  } catch {}
}

export async function clearAllNotifications(uid: string): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'notifications'))
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
  } catch {}
}
