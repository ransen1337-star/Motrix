import { DEFAULT_APP_SETTINGS } from '@shared/schemas/app-settings'
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let pageTransitionsEnabled = DEFAULT_APP_SETTINGS.pageTransitions

export function getPageTransitionsEnabled(): boolean {
  return pageTransitionsEnabled
}

export function setPageTransitionsEnabled(value: boolean): void {
  if (pageTransitionsEnabled === value) return
  pageTransitionsEnabled = value
  for (const listener of listeners) listener()
}

export function subscribePageTransitions(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePageTransitionsEnabled(): boolean {
  return useSyncExternalStore(
    subscribePageTransitions,
    getPageTransitionsEnabled
  )
}
