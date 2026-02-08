/**
 * Local storage service for managing RSVP edit tokens.
 * 
 * Tokens are stored keyed by invitation_token, allowing users to edit their
 * RSVPs without authentication on the same device.
 */

import { STORAGE_KEYS } from '../config'

const STORAGE_KEY = STORAGE_KEYS.RSVPS

export interface StoredRSVP {
  submissionId: number
  editToken: string
  identity: string
  response: 'yes' | 'no' | 'maybe'
  savedAt: string // ISO date string
}

interface RSVPStorage {
  [invitationToken: string]: StoredRSVP
}

/**
 * Get all stored RSVPs from localStorage.
 */
function getAllStoredRSVPs(): RSVPStorage {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

/**
 * Save all RSVPs to localStorage.
 */
function saveAllStoredRSVPs(rsvps: RSVPStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rsvps))
  } catch (error) {
    console.error('Failed to save RSVP to localStorage:', error)
  }
}

/**
 * Get stored RSVP for a specific event.
 */
export function getStoredRSVP(invitationToken: string): StoredRSVP | null {
  const rsvps = getAllStoredRSVPs()
  return rsvps[invitationToken] || null
}

/**
 * Save RSVP data for a specific event.
 */
export function saveStoredRSVP(
  invitationToken: string,
  data: Omit<StoredRSVP, 'savedAt'>
): void {
  const rsvps = getAllStoredRSVPs()
  rsvps[invitationToken] = {
    ...data,
    savedAt: new Date().toISOString(),
  }
  saveAllStoredRSVPs(rsvps)
}

/**
 * Remove stored RSVP for a specific event (e.g., when user wants to start fresh).
 */
export function removeStoredRSVP(invitationToken: string): void {
  const rsvps = getAllStoredRSVPs()
  delete rsvps[invitationToken]
  saveAllStoredRSVPs(rsvps)
}

/**
 * Check if there's a stored RSVP for a specific event.
 */
export function hasStoredRSVP(invitationToken: string): boolean {
  return getStoredRSVP(invitationToken) !== null
}

/**
 * Extract edit token from URL fragment (for email link recovery).
 * URL format: /event/abc123#edit=xyz789
 */
export function getEditTokenFromURL(): string | null {
  const hash = window.location.hash
  if (!hash || !hash.startsWith('#edit=')) {
    return null
  }
  return hash.substring(6) // Remove '#edit=' prefix
}

/**
 * Clear edit token from URL fragment after processing.
 */
export function clearEditTokenFromURL(): void {
  if (window.location.hash.startsWith('#edit=')) {
    // Remove hash without triggering navigation
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}
