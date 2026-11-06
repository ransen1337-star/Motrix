import {
  setPageTransitionsEnabled,
  usePageTransitionsEnabled,
} from '@renderer/lib/page-transitions'
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

export function PageTransitionsSync({ syncSettings = true }) {
  const pageTransitionsEnabled = usePageTransitionsEnabled()

  useLayoutEffect(() => {
    document.documentElement.dataset.pageTransitions = String(
      pageTransitionsEnabled
    )
  }, [pageTransitionsEnabled])

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
      setPageTransitionsEnabled(
        settings?.app?.pageTransitions ?? DEFAULT_APP_SETTINGS.pageTransitions
      )
    }
    const refresh = () => void reconcile().catch(() => {})
    const onPageTransitionsChanged = (payload: unknown) => {
      const { pageTransitions } = (payload ?? {}) as {
        pageTransitions?: unknown
      }
      if (typeof pageTransitions !== 'boolean') return
      generation += 1
      setPageTransitionsEnabled(pageTransitions)
    }

    transport.on(Events.PageTransitionsChanged, onPageTransitionsChanged)
    const stopConnectionSync = transport.onConnectionChange?.((event) => {
      if (event.state === 'connected') refresh()
    })
    const stopSettingsSync = onSettingsRefresh(reconcile)
    refresh()
    return () => {
      active = false
      generation += 1
      transport.off(Events.PageTransitionsChanged, onPageTransitionsChanged)
      stopConnectionSync?.()
      stopSettingsSync()
    }
  }, [syncSettings])

  return null
}
