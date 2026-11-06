import type { Page } from '@playwright/test'
import { expect, test, waitForQueryHandlers } from './fixtures/electron-app'

function observeAppPageTransition(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const seen = new Set<string>()
        const deadline = performance.now() + 600
        const sample = () => {
          for (const animation of document.getAnimations()) {
            const effect = animation.effect
            const pseudo =
              effect instanceof KeyframeEffect ? effect.pseudoElement : null
            if (pseudo?.includes('app-page')) seen.add(pseudo)
          }
          if (performance.now() < deadline) requestAnimationFrame(sample)
          else resolve([...seen])
        }
        sample()
      })
  )
}

test('page navigation direction follows sidebar order', async ({
  mainWindow,
}) => {
  await waitForQueryHandlers(mainWindow)
  const supported = await mainWindow.evaluate(
    () => typeof document.startViewTransition === 'function'
  )
  test.skip(!supported, 'View Transitions API is unavailable')

  const surface = mainWindow.locator('[data-slot="page-transition"]')
  await mainWindow.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(mainWindow).toHaveURL(/#\/?$/)

  const transitionSample = mainWindow.evaluate(
    () =>
      new Promise<{ inset: string[]; sidebar: string[] }>((resolve) => {
        const insetTransitions = new Set<string>()
        const sidebarTransitions = new Set<string>()
        const inset = document.querySelector('[data-slot="sidebar-inset"]')
        const deadline = performance.now() + 800
        const sample = () => {
          for (const animation of document.getAnimations()) {
            const effect = animation.effect
            const pseudo =
              effect instanceof KeyframeEffect ? effect.pseudoElement : null
            if (pseudo?.includes('sidebar-active'))
              sidebarTransitions.add(pseudo)
            if (
              effect instanceof KeyframeEffect &&
              effect.target === inset &&
              animation instanceof CSSTransition
            ) {
              insetTransitions.add(animation.transitionProperty)
            }
          }
          if (performance.now() < deadline) requestAnimationFrame(sample)
          else
            resolve({
              inset: [...insetTransitions],
              sidebar: [...sidebarTransitions],
            })
        }
        sample()
      })
  )
  await mainWindow.getByRole('link', { name: 'Trackers', exact: true }).click()
  await expect(surface).toHaveAttribute('data-page-index', '2')
  await expect(surface).toHaveAttribute('data-transition-direction', 'down')
  const transitions = await transitionSample
  expect(transitions.sidebar).toContain(
    '::view-transition-group(sidebar-active)'
  )
  expect(transitions.inset).toContain('background-color')
  expect(transitions.inset).toContain('box-shadow')
  await expect(
    mainWindow.locator(
      '[data-slot="sidebar-menu-button"][data-active="true"] [data-slot="sidebar-menu-button-active"]'
    )
  ).toHaveCount(1)

  await mainWindow.getByRole('link', { name: 'Downloads', exact: true }).click()
  await expect(surface).toHaveAttribute('data-page-index', '1')
  await expect(surface).toHaveAttribute('data-transition-direction', 'up')

  await mainWindow.getByRole('link', { name: 'Plugins', exact: true }).click()
  await expect(surface).toHaveAttribute('data-page-index', '3')
  await expect(surface).toHaveAttribute('data-transition-direction', 'down')

  await mainWindow.evaluate(() => {
    location.hash = '/plugins/motrix.filename-template'
  })
  await expect(mainWindow).toHaveURL(/#\/plugins\/motrix\.filename-template$/)
  await expect(surface).toHaveAttribute('data-page-index', '4')
  await expect(surface).toHaveAttribute('data-transition-direction', 'down')

  await mainWindow.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(surface).toHaveAttribute('data-page-index', '0')
  await expect(surface).toHaveAttribute('data-transition-direction', 'up')
})

test('rapid sidebar navigation keeps page transitions active', async ({
  mainWindow,
}) => {
  await waitForQueryHandlers(mainWindow)
  const link = (name: string) =>
    mainWindow.getByRole('link', { name, exact: true })

  await link('Dashboard').click()
  await link('Trackers').click()
  await link('Downloads').click()
  await link('Plugins').click()
  await link('Settings').click()
  await link('Trackers').click()
  await expect(mainWindow).toHaveURL(/#\/trackers$/)

  await mainWindow.waitForTimeout(350)
  const firstTransition = observeAppPageTransition(mainWindow)
  await link('Dashboard').click()
  expect(await firstTransition).toEqual(
    expect.arrayContaining([
      '::view-transition-old(app-page)',
      '::view-transition-new(app-page)',
    ])
  )

  await mainWindow.waitForTimeout(350)
  const secondTransition = observeAppPageTransition(mainWindow)
  await link('Downloads').click()
  expect(await secondTransition).toEqual(
    expect.arrayContaining([
      '::view-transition-old(app-page)',
      '::view-transition-new(app-page)',
    ])
  )
})

test('settings dialog does not inherit a page transition snapshot', async ({
  mainWindow,
}) => {
  await waitForQueryHandlers(mainWindow)
  await mainWindow.getByRole('link', { name: 'Settings', exact: true }).click()
  await mainWindow.getByText('General', { exact: true }).click()
  await expect(
    mainWindow.getByRole('dialog', { name: 'General' })
  ).toBeVisible()

  expect(
    await mainWindow.evaluate(() =>
      document.getAnimations().some((animation) => {
        const effect = animation.effect
        return (
          effect instanceof KeyframeEffect &&
          effect.pseudoElement?.includes('app-page')
        )
      })
    )
  ).toBe(false)

  const closeAnimation = mainWindow.evaluate(
    () =>
      new Promise<{ animations: number; closing: boolean }>((resolve) => {
        const deadline = performance.now() + 500
        const sample = () => {
          const dialog = document.querySelector<HTMLElement>(
            '[data-slot="dialog-content"]'
          )
          const closing = dialog?.hasAttribute('data-closed') === true
          if (closing || performance.now() >= deadline) {
            resolve({
              animations: dialog?.getAnimations().length ?? 0,
              closing,
            })
            return
          }
          requestAnimationFrame(sample)
        }
        sample()
      })
  )
  await mainWindow.keyboard.press('Escape')
  const close = await closeAnimation
  expect(close.closing).toBe(true)
  expect(close.animations).toBeGreaterThan(0)
  await expect(
    mainWindow.getByRole('dialog', { name: 'General' })
  ).not.toBeVisible()
  await expect(mainWindow).toHaveURL(/#\/settings$/)
  await mainWindow.waitForTimeout(350)
  const transition = observeAppPageTransition(mainWindow)
  await mainWindow.getByRole('link', { name: 'Downloads', exact: true }).click()
  expect(await transition).toEqual(
    expect.arrayContaining([
      '::view-transition-old(app-page)',
      '::view-transition-new(app-page)',
    ])
  )
})

test('notifications and settings keep page and selection transitions', async ({
  mainWindow,
}) => {
  await waitForQueryHandlers(mainWindow)
  const link = (name: string) =>
    mainWindow.getByRole('link', { name, exact: true })
  const surface = mainWindow.locator('[data-slot="page-transition"]')

  await link('Dashboard').click()
  await mainWindow.waitForTimeout(350)

  const pageTransition = observeAppPageTransition(mainWindow)
  const selectionTransition = mainWindow.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const seen = new Set<string>()
        const deadline = performance.now() + 600
        const sample = () => {
          for (const animation of document.getAnimations()) {
            const effect = animation.effect
            const pseudo =
              effect instanceof KeyframeEffect ? effect.pseudoElement : null
            if (pseudo?.includes('sidebar-active')) seen.add(pseudo)
          }
          if (performance.now() < deadline) requestAnimationFrame(sample)
          else resolve([...seen])
        }
        sample()
      })
  )

  await link('Notifications').click()
  await link('Settings').click()
  await expect(mainWindow).toHaveURL(/#\/settings$/)
  await expect(surface).toHaveAttribute('data-transition-direction', 'down')
  expect(await pageTransition).toEqual(
    expect.arrayContaining([
      '::view-transition-old(app-page)',
      '::view-transition-new(app-page)',
    ])
  )
  expect(await selectionTransition).toEqual(
    expect.arrayContaining([
      '::view-transition-group(sidebar-active)',
      '::view-transition-old(sidebar-active)',
      '::view-transition-new(sidebar-active)',
    ])
  )

  await mainWindow.waitForTimeout(350)
  const returnTransition = observeAppPageTransition(mainWindow)
  await link('Dashboard').click()
  await expect(surface).toHaveAttribute('data-transition-direction', 'up')
  expect(await returnTransition).toEqual(
    expect.arrayContaining([
      '::view-transition-old(app-page)',
      '::view-transition-new(app-page)',
    ])
  )
})
