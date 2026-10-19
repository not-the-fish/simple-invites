import { useEffect } from 'react'
import { APP_NAME } from '../config'

/**
 * Set the browser tab title while the component is mounted.
 * Restores APP_NAME on unmount so other routes are not left with a stale title.
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous || APP_NAME
    }
  }, [title])
}
