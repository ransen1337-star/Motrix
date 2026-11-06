import { expect, test, waitForQueryHandlers } from './fixtures/electron-app'

test('page navigation uses a vertical view transition', async ({
  mainWindow,
}) => {
  await waitForQueryHandlers(mainWindow)
  const supported = await mainWindow.evaluate(
    () => typeof document.startViewTransition === 'function'
  )
  test.skip(!supported, 'View Transitions API is unavailable')

  await mainWindow.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(mainWindow).toHaveURL(/#\/?$/)

  await mainWindow.evaluate(() => {
    const original = document.startViewTransition.bind(document)
    const capture = window as Window & {
      __pageTransitionAnimations?: string[]
    }
    document.startViewTransition = (callback) => {
      const transition = original(callback)
      void transition.ready.then(() => {
        capture.__pageTransitionAnimations = document
          .getAnimations()
          .map((animation) => (animation as CSSAnimation).animationName)
      })
      return transition
    }
  })

  await mainWindow.getByRole('link', { name: 'Trackers', exact: true }).click()

  await expect
    .poll(() =>
      mainWindow.evaluate(
        () =>
          (
            window as Window & {
              __pageTransitionAnimations?: string[]
            }
          ).__pageTransitionAnimations
      )
    )
    .toEqual(
      expect.arrayContaining([
        'page-transition-enter-down',
        'page-transition-exit-down',
      ])
    )
  expect(
    await mainWindow.evaluate(
      () =>
        (
          window as Window & {
            __pageTransitionAnimations?: string[]
          }
        ).__pageTransitionAnimations
    )
  ).not.toContain('-ua-view-transition-fade-out')

  await mainWindow.evaluate(() => {
    ;(
      window as Window & {
        __pageTransitionAnimations?: string[]
      }
    ).__pageTransitionAnimations = []
  })
  await mainWindow.getByRole('link', { name: 'Downloads', exact: true }).click()

  await expect
    .poll(() =>
      mainWindow.evaluate(
        () =>
          (
            window as Window & {
              __pageTransitionAnimations?: string[]
            }
          ).__pageTransitionAnimations
      )
    )
    .toEqual(
      expect.arrayContaining([
        'page-transition-enter-up',
        'page-transition-exit-up',
      ])
    )
})
