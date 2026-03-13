import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { retry, getErrorMessage } from '../utils/retry'
import { API_BASE_URL, STORAGE_KEYS } from '../config'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN)
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling and retries
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Don't retry if already retried or if it's not a retryable error
    if (originalRequest._retry || !isRetryableError(error)) {
      // Enhance error with user-friendly message
      const enhancedError = {
        ...error,
        userMessage: getErrorMessage(error),
      }
      return Promise.reject(enhancedError)
    }

    // Mark request as retried
    originalRequest._retry = true

    // Retry with exponential backoff
    try {
      return await retry(
        () => api(originalRequest),
        {
          maxRetries: 2, // Already retrying once, so 2 more attempts
          initialDelay: 1000,
          retryableStatuses: [408, 429, 500, 502, 503, 504],
        }
      )
    } catch (retryError: unknown) {
      const enhancedError: ApiError = {
        ...(retryError && typeof retryError === 'object' ? (retryError as AxiosError) : {} as AxiosError),
        userMessage: getErrorMessage(retryError),
      }
      return Promise.reject(enhancedError)
    }
  }
)

/** Extract status and detail from an unknown error (e.g. axios response). */
export function getErrorResponse(err: unknown): { status?: number; detail?: string; message?: string } {
  if (!err || typeof err !== 'object') return {}
  const o = err as Record<string, unknown>
  const response = o.response as Record<string, unknown> | undefined
  const status = response && typeof response.status === 'number' ? response.status : undefined
  const data = response?.data
  const detail =
    data && typeof data === 'object' && data !== null && 'detail' in data
      ? (data as { detail: unknown }).detail
      : undefined
  const message = typeof o.message === 'string' ? o.message : undefined
  return {
    status,
    detail: typeof detail === 'string' ? detail : undefined,
    message,
  }
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: AxiosError): boolean {
  const status = error.response?.status
  if (!status) {
    // Network errors are retryable
    return error.code === 'ECONNABORTED' || error.message.includes('Network')
  }
  // Retry on timeout, rate limit, and server errors
  return [408, 429, 500, 502, 503, 504].includes(status)
}

// Export enhanced error type
export interface ApiError extends AxiosError {
  userMessage?: string
}

export default api
