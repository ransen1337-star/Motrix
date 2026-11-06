import {
  setInterfaceAnimationsEnabled,
  useInterfaceAnimationsEnabled,
} from '@renderer/lib/interface-animations'
import {
  onSettingsRefresh,
  type SettingsReader,
} from '@renderer/lib/settings-refresh'
import { transport } from '@renderer/lib/transport'
import { Events } from '@shared/protocol/events'
import { Queries } from '@shared/protocol/queries'
import { DEFAULT_APP_SETTINGS } from '@shared/schemas/app-settings'
import type { AppSettings } from '@shared/types/settings'
import { useEffect, useLayoutEffect } from 'react'

export function InterfaceAnimationsSync({ syncSettings = true }) {
  const interfaceAnimationsEnabled = useInterfaceAnimationsEnabled()

  useLayoutEffect(() => {
    document.documentElement.dataset.interfaceAnimations = String(
      interfaceAnimationsEnabled
    )
  }, [interfaceAnimationsEnabled])

  useEffect(() => {
    if (!syncSettings) return
    let active = true
    let generation = 0

    const reconcile = async (
      read: SettingsReader = (channel) => transport.invoke(channel)
    ) => {
      const requestGeneration = ++generation
      const data = await read(Queries.GetSettings)
      if (!active || requestGeneration !== generation) return
      const settings = data as AppSettings | undefined
      setInterfaceAnimationsEnabled(
        settings?.app?.interfaceAnimations ??
          DEFAULT_APP_SETTINGS.interfaceAnimations
      )
    }
    const refresh = () => void reconcile().catch(() => {})
    const onInterfaceAnimationsChanged = (payload: unknown) => {
      const { interfaceAnimations } = (payload ?? {}) as {
        interfaceAnimations?: unknown
      }
      if (typeof interfaceAnimations !== 'boolean') return
      generation += 1
      setInterfaceAnimationsEnabled(interfaceAnimations)
    }

    transport.on(
      Events.InterfaceAnimationsChanged,
      onInterfaceAnimationsChanged
    )
    const stopConnectionSync = transport.onConnectionChange?.((event) => {
      if (event.state === 'connected') refresh()
    })
    const stopSettingsSync = onSettingsRefresh(reconcile)
    refresh()
    return () => {
      active = false
      generation += 1
      transport.off(
        Events.InterfaceAnimationsChanged,
        onInterfaceAnimationsChanged
      )
      stopConnectionSync?.()
      stopSettingsSync()
    }
  }, [syncSettings])

  return null
}
