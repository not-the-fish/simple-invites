/**
 * Retry utility for API calls with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryableStatuses?: number[]
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504], // Timeout, rate limit, server errors
}

/**
 * Sleep for a given number of milliseconds
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const o = error as Record<string, unknown>
    if (typeof (o.response as Record<string, unknown>)?.status === 'number') {
      return (o.response as { status: number }).status
    }
    if (typeof o.status === 'number') return o.status
  }
  return undefined
}

/**
 * Check if an error is retryable based on status code
 */
const isRetryable = (error: unknown, retryableStatuses: number[]): boolean => {
  const status = getStatus(error)
  if (status === undefined) return false
  return retryableStatuses.includes(status)
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      lastError = error

      // Don't retry on the last attempt
      if (attempt === opts.maxRetries) {
        throw error
      }

      // Don't retry if error is not retryable
      if (!isRetryable(error, opts.retryableStatuses)) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      )

      // Wait before retrying
      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * Get a user-friendly error message from an API error
 */
export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const o = error as Record<string, unknown>
    const response = o.response as Record<string, unknown> | undefined
    if (response?.data && typeof response.data === 'object' && response.data !== null && 'detail' in response.data) {
      const detail = (response.data as { detail: unknown }).detail
      if (typeof detail === 'string') return detail
    }
    if (typeof o.message === 'string') return o.message
    if (response && typeof response.status === 'number') {
      const status = response.status
      switch (status) {
        case 400:
          return 'Invalid request. Please check your input.'
        case 401:
          return 'Authentication required. Please log in.'
        case 403:
          return 'Access denied. You do not have permission to perform this action.'
        case 404:
          return 'Resource not found.'
        case 408:
          return 'Request timeout. Please try again.'
        case 429:
          return 'Too many requests. Please wait a moment and try again.'
        case 500:
          return 'Server error. Please try again later.'
        case 502:
        case 503:
        case 504:
          return 'Service temporarily unavailable. Please try again later.'
        default:
          return `Request failed with status ${status}. Please try again.`
      }
    }
  }

  if (error && typeof error === 'object') {
    const o = error as Record<string, unknown>
    if (o.code === 'NETWORK_ERROR' || (typeof o.message === 'string' && o.message.includes('Network'))) {
      return 'Network error. Please check your connection and try again.'
    }
  }

  return 'An unexpected error occurred. Please try again.'
}


