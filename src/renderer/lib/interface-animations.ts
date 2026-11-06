import { DEFAULT_APP_SETTINGS } from '@shared/schemas/app-settings'
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let interfaceAnimationsEnabled = DEFAULT_APP_SETTINGS.interfaceAnimations

export function getInterfaceAnimationsEnabled(): boolean {
  return interfaceAnimationsEnabled
}

export function setInterfaceAnimationsEnabled(value: boolean): void {
  if (interfaceAnimationsEnabled === value) return
  interfaceAnimationsEnabled = value
  for (const listener of listeners) listener()
}

export function subscribeInterfaceAnimations(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInterfaceAnimationsEnabled(): boolean {
  return useSyncExternalStore(
    subscribeInterfaceAnimations,
    getInterfaceAnimationsEnabled
  )
}
