/**
 * Token storage utilities
 * 
 * Currently uses localStorage for simplicity. For enhanced security,
 * consider using httpOnly cookies (requires backend changes) or
 * sessionStorage (clears on tab close).
 * 
 * Note: XSS protection is provided by React's automatic escaping
 * and Content-Security-Policy headers from the backend.
 */

import { STORAGE_KEYS } from '../config'

const TOKEN_KEY = STORAGE_KEYS.ADMIN_TOKEN

/**
 * Store authentication token
 */
export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch (error) {
    console.error('Failed to store token:', error)
    // Fallback to sessionStorage if localStorage is unavailable
    try {
      sessionStorage.setItem(TOKEN_KEY, token)
    } catch (sessionError) {
      console.error('Failed to store token in sessionStorage:', sessionError)
    }
  }
}

/**
 * Get authentication token
 */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
  } catch (error) {
    console.error('Failed to retrieve token:', error)
    return null
  }
}

/**
 * Remove authentication token
 */
export function removeToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
  } catch (error) {
    console.error('Failed to remove token:', error)
  }
}

/**
 * Check if token exists
 */
export function hasToken(): boolean {
  return getToken() !== null
}

/**
 * Clear all authentication data
 */
export function clearAuth(): void {
  removeToken()
}


