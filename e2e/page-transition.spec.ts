import type { Page } from '@playwright/test'
import { expect, test, waitForQueryHandlers } from './fixtures/electron-app'

function observeTransitionAnimations(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        inset: string[]
        page: number
        sidebar: number
      }>((resolve) => {
        const insetTransitions = new Set<string>()
        const surface = document.querySelector<HTMLElement>(
          '[data-slot="page-transition"]'
        )
        const inset = document.querySelector<HTMLElement>(
          '[data-slot="sidebar-inset"]'
        )
        let pageAnimations = 0
        let sidebarAnimations = 0
        const deadline = performance.now() + 600
        const sample = () => {
          pageAnimations = Math.max(
            pageAnimations,
            surface?.getAnimations().length ?? 0
          )
          sidebarAnimations = Math.max(
            sidebarAnimations,
            document
              .querySelector<HTMLElement>('[data-slot="sidebar-selection"]')
              ?.getAnimations().length ?? 0
          )
          for (const animation of document.getAnimations()) {
            const effect = animation.effect
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
              page: pageAnimations,
              sidebar: sidebarAnimations,
            })
        }
        sample()
      })
  )
}

test('page navigation direction follows sidebar order', async ({
  mainWindow,
}) => {
  await waitForQueryHandlers(mainWindow)

  const surface = mainWindow.locator('[data-slot="page-transition"]')
  await mainWindow.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(mainWindow).toHaveURL(/#\/?$/)

  const transitionSample = observeTransitionAnimations(mainWindow)
  await mainWindow.getByRole('link', { name: 'Trackers', exact: true }).click()
  await expect(surface).toHaveAttribute('data-page-index', '2')
  await expect(surface).toHaveAttribute('data-transition-direction', 'down')
  const transitions = await transitionSample
  expect(transitions.page).toBeGreaterThan(0)
  expect(transitions.sidebar).toBeGreaterThan(0)
  expect(transitions.inset).toContain('background-color')
  expect(transitions.inset).toContain('box-shadow')
  await expect(
    mainWindow.locator('[data-slot="sidebar-selection"]')
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
  const firstTransition = observeTransitionAnimations(mainWindow)
  await link('Dashboard').click()
  expect((await firstTransition).page).toBeGreaterThan(0)

  await mainWindow.waitForTimeout(350)
  const secondTransition = observeTransitionAnimations(mainWindow)
  await link('Downloads').click()
  expect((await secondTransition).page).toBeGreaterThan(0)
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
    await mainWindow
      .locator('[data-slot="page-transition"]')
      .evaluate((surface) => surface.getAnimations().length)
  ).toBe(0)

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
  const closeSequence = mainWindow.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        let sawClosing = false
        const deadline = performance.now() + 700
        const sample = () => {
          const dialog = document.querySelector<HTMLElement>(
            '[data-slot="dialog-content"]'
          )
          if (!dialog) {
            resolve(sawClosing)
            return
          }
          if (dialog.hasAttribute('data-closed')) sawClosing = true
          else if (sawClosing) {
            resolve(false)
            return
          }
          if (performance.now() >= deadline) resolve(true)
          else requestAnimationFrame(sample)
        }
        sample()
      })
  )
  await mainWindow.keyboard.press('Escape')
  const close = await closeAnimation
  expect(close.closing).toBe(true)
  expect(close.animations).toBeGreaterThan(0)
  expect(await closeSequence).toBe(true)
  await expect(
    mainWindow.getByRole('dialog', { name: 'General' })
  ).not.toBeVisible()
  await expect(mainWindow).toHaveURL(/#\/settings$/)
  await mainWindow.waitForTimeout(350)
  const transition = observeTransitionAnimations(mainWindow)
  await mainWindow.getByRole('link', { name: 'Downloads', exact: true }).click()
  expect((await transition).page).toBeGreaterThan(0)
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

  const transition = observeTransitionAnimations(mainWindow)

  await link('Notifications').click()
  await link('Settings').click()
  await expect(mainWindow).toHaveURL(/#\/settings$/)
  await expect(surface).toHaveAttribute('data-transition-direction', 'down')
  const transitions = await transition
  expect(transitions.page).toBeGreaterThan(0)
  expect(transitions.sidebar).toBeGreaterThan(0)

  await mainWindow.waitForTimeout(350)
  const returnTransition = observeTransitionAnimations(mainWindow)
  await link('Dashboard').click()
  await expect(surface).toHaveAttribute('data-transition-direction', 'up')
  expect((await returnTransition).page).toBeGreaterThan(0)
})
