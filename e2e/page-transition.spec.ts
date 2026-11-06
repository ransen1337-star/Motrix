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

  await mainWindow.getByRole('link', { name: 'Trackers', exact: true }).click()
  await expect(surface).toHaveAttribute('data-page-index', '2')
  await expect(surface).toHaveAttribute('data-transition-direction', 'down')

  await mainWindow.getByRole('link', { name: 'Downloads', exact: true }).click()
  await expect(surface).toHaveAttribute('data-page-index', '1')
  await expect(surface).toHaveAttribute('data-transition-direction', 'up')

  await mainWindow.getByRole('link', { name: 'Plugins', exact: true }).click()
  await expect(surface).toHaveAttribute('data-page-index', '3')
  await expect(surface).toHaveAttribute('data-transition-direction', 'down')

  await mainWindow.evaluate(() => {
    location.hash = '/plugins/test.demo'
  })
  await expect(mainWindow).toHaveURL(/#\/plugins\/test\.demo$/)
  await expect(surface).toHaveAttribute('data-page-index', '4')
  await expect(surface).toHaveAttribute('data-transition-direction', 'down')

  await mainWindow.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(surface).toHaveAttribute('data-page-index', '0')
  await expect(surface).toHaveAttribute('data-transition-direction', 'up')
})
