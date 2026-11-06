import { expect, test, waitForQueryHandlers } from './fixtures/electron-app'

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
