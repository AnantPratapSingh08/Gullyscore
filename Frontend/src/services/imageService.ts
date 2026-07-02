// src/services/imageService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Firebase Storage image upload service.
// Handles: team logos, tournament logos, player profile pictures.
// Uses local Base64 data URLs as fallback when Storage quota is exceeded.
// ─────────────────────────────────────────────────────────────────────────────

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from './firebase'
import app from './firebase'

const storage = getStorage(app)

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 2
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// ── Validators ────────────────────────────────────────────────────────────────

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, WebP, GIF, and SVG files are allowed.'
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `File size must be under ${MAX_FILE_SIZE_MB}MB.`
  }
  return null
}

// ── Base64 fallback ───────────────────────────────────────────────────────────

/** Convert a file to a Base64 data URL (used as fallback if Storage fails). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Compress an image using HTML5 Canvas before uploading. */
export async function compressImage(file: File, maxWidth = 800): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            } else {
              reject(new Error('Canvas to Blob failed'))
            }
          },
          file.type === 'image/webp' ? 'image/webp' : 'image/jpeg',
          0.85
        )
      }
      img.onerror = () => reject(new Error('Failed to load image for compression'))
      img.src = event.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// ── Storage upload helpers ────────────────────────────────────────────────────

/** Upload to Firebase Storage; falls back to Base64 data URL on failure. */
async function uploadWithFallback(
  storagePath: string,
  rawFile: File,
): Promise<string> {
  try {
    const file = await compressImage(rawFile)
    const storageRef = ref(storage, storagePath)
    await uploadBytes(storageRef, file, { contentType: file.type })
    return await getDownloadURL(storageRef)
  } catch (err) {
    console.warn('[imageService] Storage upload failed, using Base64 fallback:', err)
    return fileToDataUrl(rawFile)
  }
}

/** Delete an image from Firebase Storage (best-effort, no throws). */
export async function deleteStorageImage(url: string): Promise<void> {
  if (!url || url.startsWith('data:')) return // Base64 data, nothing to delete
  try {
    const storageRef = ref(storage, url)
    await deleteObject(storageRef)
  } catch {
    // Ignore — might not exist
  }
}

// ── Team logo upload ──────────────────────────────────────────────────────────

/**
 * Upload a team logo image and update the team document's `logoUrl` field.
 * @returns The public download URL (or Base64 data URL on fallback).
 */
export async function uploadTeamLogo(
  teamId: string,
  file: File,
): Promise<string> {
  const error = validateImageFile(file)
  if (error) throw new Error(error)

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `teams/${teamId}/logo.${ext}`
  const url = await uploadWithFallback(path, file)

  await updateDoc(doc(db, 'teams', teamId), { logoUrl: url })
  return url
}

// ── Tournament logo upload ────────────────────────────────────────────────────

/**
 * Upload a tournament logo image and update the tournament document's `logo` field.
 * @returns The public download URL (or Base64 data URL on fallback).
 */
export async function uploadTournamentLogo(
  tournamentId: string,
  file: File,
): Promise<string> {
  const error = validateImageFile(file)
  if (error) throw new Error(error)

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `tournaments/${tournamentId}/logo.${ext}`
  const url = await uploadWithFallback(path, file)

  await updateDoc(doc(db, 'tournaments', tournamentId), { logo: url })
  return url
}

// ── Player avatar upload ──────────────────────────────────────────────────────

/**
 * Upload a player avatar image and update the player document's `avatarUrl` field.
 * @returns The public download URL (or Base64 data URL on fallback).
 */
export async function uploadPlayerAvatar(
  playerId: string,
  file: File,
): Promise<string> {
  const error = validateImageFile(file)
  if (error) throw new Error(error)

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `players/${playerId}/avatar.${ext}`
  const url = await uploadWithFallback(path, file)

  await updateDoc(doc(db, 'players', playerId), { avatarUrl: url })
  return url
}
