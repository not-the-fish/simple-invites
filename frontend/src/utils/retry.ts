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

/**
 * Check if an error is retryable based on status code
 */
const isRetryable = (error: any, retryableStatuses: number[]): boolean => {
  const status = error?.response?.status || error?.status
  if (!status) return false
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
  let lastError: any

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
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
export function getErrorMessage(error: any): string {
  if (error?.response?.data?.detail) {
    return error.response.data.detail
  }

  if (error?.message) {
    return error.message
  }

  if (error?.response?.status) {
    const status = error.response.status
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

  if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network')) {
    return 'Network error. Please check your connection and try again.'
  }

  return 'An unexpected error occurred. Please try again.'
}


