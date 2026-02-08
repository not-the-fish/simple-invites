/**
 * Get the user's timezone name (e.g., "America/New_York", "Europe/London")
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    // Fallback if timezone API is not available
    const offset = -new Date().getTimezoneOffset() / 60
    return `UTC${offset >= 0 ? '+' : ''}${offset}`
  }
}

/**
 * Get a short timezone abbreviation (e.g., "EST", "PST")
 * Note: This is approximate as timezone abbreviations can be ambiguous
 */
export function getTimezoneAbbreviation(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZoneName: 'short',
    })
    const parts = formatter.formatToParts(new Date())
    const timeZoneName = parts.find(part => part.type === 'timeZoneName')
    return timeZoneName?.value || getUserTimezone()
  } catch {
    return getUserTimezone()
  }
}

/**
 * Format a date with timezone information
 * Converts UTC dates to the user's local timezone and displays the timezone
 */
export function formatDateWithTimezone(date: Date | string): string {
  let dateObj: Date
  
  if (typeof date === 'string') {
    // Parse the date string - if it's an ISO string without timezone, treat as UTC
    // Check if it's a valid ISO date string without timezone info (ends with just time, no Z or offset)
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/
    if (isoDatePattern.test(date)) {
      // ISO string without timezone - append 'Z' to indicate UTC
      dateObj = new Date(date + 'Z')
    } else {
      // Already has timezone info or is in a different format
      dateObj = new Date(date)
    }
  } else {
    dateObj = date
  }
  
  // Use the user's local timezone for display
  // This will automatically convert UTC to the user's local timezone
  return dateObj.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

/**
 * Format a date with full timezone information (includes timezone name)
 */
export function formatDateWithFullTimezone(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  return dateObj.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'long',
  })
}

