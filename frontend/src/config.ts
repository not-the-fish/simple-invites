/**
 * Application configuration
 * 
 * Centralizes all configurable values including branding.
 * Uses environment variables with sensible defaults.
 */

// App branding - configurable via environment variable
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Simple Invites'

// API configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// Storage keys - use a generic prefix based on app name slug
const APP_SLUG = APP_NAME.toLowerCase().replace(/[^a-z0-9]/g, '_')
export const STORAGE_KEYS = {
  RSVPS: `${APP_SLUG}_rsvps`,
  ADMIN_TOKEN: 'admin_token', // Keep consistent for backwards compatibility
  EDIT_TOKEN_PREFIX: 'edit_token_',
}

// Calendar branding
export const CALENDAR_PRODID = `-//${APP_NAME}//Event Calendar//EN`
export const CALENDAR_UID_DOMAIN = APP_SLUG
