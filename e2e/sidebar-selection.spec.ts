import { expect, test } from './fixtures/electron-app'

const destinations = [
  'Dashboard',
  'Downloads',
  'Trackers',
  'Plugins',
  'Notifications',
  'Settings',
]

test('inactive sidebar hover shade fades in and out', async ({
  mainWindow,
}) => {
  const link = mainWindow.getByRole('link', {
    name: 'Downloads',
    exact: true,
  })
  const button = link.locator('[data-sidebar="menu-button"]')
  const backgroundAlpha = () =>
    button.evaluate((element) =>
      Number(getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.[3])
    )

  await mainWindow.mouse.move(500, 45)
  await expect.poll(backgroundAlpha).toBe(0)
  await link.hover()
  await expect.poll(backgroundAlpha).toBeGreaterThan(0)
  await mainWindow.mouse.move(500, 45)
  await expect.poll(backgroundAlpha).toBe(0)
})

for (const platform of ['win32', 'linux', 'darwin']) {
  test(`sidebar selection remains distinct across the gradient (${platform} CSS)`, async ({
    mainWindow,
  }, testInfo) => {
    test.setTimeout(120_000)
    await expect(mainWindow.locator('html')).toHaveAttribute(
      'data-sidebar-color',
      'cyan'
    )

    // Exercise platform CSS in the real renderer, without pretending to test
    // native Windows/Linux window materials on a macOS test host.
    for (const theme of ['light', 'dark']) {
      for (const color of ['gray', 'blue', 'cyan']) {
        await mainWindow.evaluate(
          ({ platform, theme, color }) => {
            const root = document.documentElement
            root.classList.remove(
              'platform-win32',
              'platform-linux',
              'platform-darwin'
            )
            root.classList.add(`platform-${platform}`)
            root.classList.toggle('dark', theme === 'dark')
            root.dataset.sidebarColor = color
          },
          { platform, theme, color }
        )

        let selectedBackground: string | undefined
        for (const destination of destinations) {
          const link = mainWindow.getByRole('link', {
            name: destination,
            exact: true,
          })
          const button = link.locator('[data-sidebar="menu-button"]')
          await link.click()
          await mainWindow.mouse.move(500, 45)
          await expect(button).toHaveAttribute('data-active', 'true')
          const activeLayer = button.locator(
            '[data-slot="sidebar-menu-button-active"]'
          )
          const background = await activeLayer.evaluate(
            (element) => getComputedStyle(element).backgroundColor
          )
          const channels = background.match(/[\d.]+/g)?.map(Number)
          expect(channels).toHaveLength(4)
          const [red, green, blue, alpha] = channels!
          expect([red, green, blue]).toEqual(
            theme === 'light' ? [0, 0, 0] : [255, 255, 255]
          )
          expect(alpha).toBeGreaterThan(0)
          expect(alpha).toBeLessThan(1)
          selectedBackground ??= background
          expect(background).toBe(selectedBackground)

          // Hovering a selected item must not replace the selected fill.
          await link.hover()
          await expect(activeLayer).toHaveCSS('background-color', background)
          await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
          const other = mainWindow.getByRole('link', {
            name: destination === 'Dashboard' ? 'Settings' : 'Dashboard',
            exact: true,
          })
          await other.hover()
          const otherButton = other.locator('[data-sidebar="menu-button"]')
          await expect
            .poll(() =>
              otherButton.evaluate((element) =>
                Number(
                  getComputedStyle(element).backgroundColor.match(
                    /[\d.]+/g
                  )?.[3]
                )
              )
            )
            .toBeGreaterThan(0)
          const hoverBackground = await otherButton.evaluate(
            (element) => getComputedStyle(element).backgroundColor
          )
          const hoverAlpha = Number(hoverBackground.match(/[\d.]+/g)?.[3])
          expect(hoverAlpha).toBeGreaterThan(0)
          expect(hoverAlpha).toBeLessThan(alpha)
        }

        await mainWindow.mouse.move(500, 45)
        await mainWindow.screenshot({
          path: testInfo.outputPath(
            `sidebar-${platform}-${theme}-${color}.png`
          ),
        })
      }
    }
  })
}
