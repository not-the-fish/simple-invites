import { CALENDAR_PRODID, CALENDAR_UID_DOMAIN } from '../config'

/**
 * Generate an iCalendar (.ics) file for an event
 * 
 * @param event - Event data including title, description, date, and location
 * @returns Blob containing the .ics file content
 */
export function generateCalendarFile(event: {
  title: string
  description?: string | null
  date: string | Date
  location?: string | null
}): Blob {
  const eventDate = typeof event.date === 'string' ? new Date(event.date) : event.date
  
  // Format date in iCalendar format (YYYYMMDDTHHMMSSZ)
  // iCalendar uses UTC time, so we convert the date to UTC
  const formatICalDate = (date: Date): string => {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    const seconds = String(date.getUTCSeconds()).padStart(2, '0')
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
  }
  
  // Generate a unique ID for the event (using timestamp and random string)
  const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}@${CALENDAR_UID_DOMAIN}`
  
  // Get current timestamp for DTSTAMP (when the calendar entry was created)
  const now = new Date()
  const dtstamp = formatICalDate(now)
  
  // Format the event date
  const dtstart = formatICalDate(eventDate)
  
  // For now, we'll set the end time to 2 hours after start (can be made configurable)
  // Use UTC methods to ensure consistency
  const endDate = new Date(eventDate)
  endDate.setUTCHours(endDate.getUTCHours() + 2)
  const dtend = formatICalDate(endDate)
  
  // Escape special characters in text fields (iCalendar format)
  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
  }
  
  // Build the iCalendar content
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${CALENDAR_PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeText(event.title)}`,
  ]
  
  if (event.description) {
    // Split description into multiple lines if needed (max 75 chars per line per RFC 5545)
    const description = escapeText(event.description)
    const currentLine = `DESCRIPTION:${description}`
    
    // If description is too long, we need to fold it (but for simplicity, we'll just add it)
    // Most calendar apps handle long descriptions fine
    lines.push(currentLine)
  }
  
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`)
  }
  
  lines.push(
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  )
  
  const icsContent = lines.join('\r\n')
  
  // Create a Blob with the .ics content
  return new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
}

/**
 * Download a calendar file for an event
 * 
 * @param event - Event data including title, description, date, and location
 */
export function downloadCalendarFile(event: {
  title: string
  description?: string | null
  date: string | Date
  location?: string | null
}): void {
  const blob = generateCalendarFile(event)
  
  // Create a temporary URL for the blob
  const url = URL.createObjectURL(blob)
  
  // Create a temporary anchor element to trigger download
  const link = document.createElement('a')
  link.href = url
  
  // Sanitize filename (remove special characters)
  const sanitizedTitle = event.title
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()
    .substring(0, 50)
  
  link.download = `${sanitizedTitle}.ics`
  
  // Append to body, click, and remove
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  // Clean up the URL
  URL.revokeObjectURL(url)
}

/**
 * Generate a Google Calendar URL for adding an event
 * 
 * @param event - Event data including title, description, date, and location
 * @returns URL string for Google Calendar
 */
export function getGoogleCalendarUrl(event: {
  title: string
  description?: string | null
  date: string | Date
  location?: string | null
}): string {
  const eventDate = typeof event.date === 'string' ? new Date(event.date) : event.date
  
  // Format dates for Google Calendar (YYYYMMDDTHHMMSSZ)
  const formatGoogleDate = (date: Date): string => {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    const seconds = String(date.getUTCSeconds()).padStart(2, '0')
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
  }
  
  // Calculate end date (2 hours after start)
  const endDate = new Date(eventDate)
  endDate.setUTCHours(endDate.getUTCHours() + 2)
  
  const startDateStr = formatGoogleDate(eventDate)
  const endDateStr = formatGoogleDate(endDate)
  
  // Build Google Calendar URL
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startDateStr}/${endDateStr}`,
  })
  
  if (event.description) {
    params.append('details', event.description)
  }
  
  if (event.location) {
    params.append('location', event.location)
  }
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Check if the user is on an Apple device (macOS or iOS)
 */
export function isAppleDevice(): boolean {
  if (typeof window === 'undefined') return false
  
  const platform = window.navigator.platform.toLowerCase()
  const userAgent = window.navigator.userAgent.toLowerCase()
  
  return (
    platform.includes('mac') ||
    platform.includes('iphone') ||
    platform.includes('ipad') ||
    userAgent.includes('iphone') ||
    userAgent.includes('ipad') ||
    userAgent.includes('macintosh')
  )
}

