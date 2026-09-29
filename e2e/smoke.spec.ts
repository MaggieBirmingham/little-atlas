import { test, expect, type Page } from '@playwright/test'

/** Fresh guest, brainstorm done, map showing. */
async function startMap(page: Page, curiosity = 'I keep thinking about picking up chess again') {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /what are you curious about/i })).toBeVisible()
  await page.getByLabel(/something you're curious about/i).fill(curiosity)
  await page.getByRole('button', { name: /^add$/i }).click()
  await expect(page.getByText(curiosity)).toBeVisible()
  await page.getByRole('button', { name: /done for now/i }).click()
  await expect(page.getByRole('button', { name: /^Movement$/ })).toBeVisible({ timeout: 10_000 })
}

test.describe('Little Atlas core loop (guest mode)', () => {
  test('capture -> category details -> suggested branch -> related interest -> add -> move -> link -> experiment -> reflect', async ({ page }) => {
    await startMap(page)
    const panel = page.getByRole('complementary', { name: 'Details' })

    // --- Category: click shows details AND suggested branches -------------
    await page.getByRole('button', { name: /^Movement$/ }).click()
    await expect(panel.getByRole('heading', { name: 'Movement', level: 2 })).toBeVisible()
    await expect(panel.getByText(/getting your body moving/i)).toBeVisible()
    await expect(panel.getByRole('heading', { name: /suggested branches/i })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Everyday walking', exact: true })).toBeVisible()
    // ...and the same suggestions appear on the map as dashed "suggested" nodes.
    await expect(page.getByRole('button', { name: 'Low-key cardio (suggested)' })).toBeVisible()

    // --- Hobby detail, still just a suggestion ---------------------------
    await panel.getByRole('button', { name: 'Everyday walking', exact: true }).click()
    await expect(panel.getByRole('heading', { name: 'Everyday walking', level: 2 })).toBeVisible()
    await expect(panel.getByText(/Suggested — not on your map yet/)).toBeVisible()
    await expect(panel.getByRole('heading', { name: /beginner steps/i })).toBeVisible()
    await expect(panel.getByText(/reviewed 2026-09-23/)).toBeVisible()

    // --- Related interest that is NOT on the map: explore it, then add it --
    await expect(panel.getByText('not on your map yet').first()).toBeVisible()
    await panel.getByRole('button', { name: 'Local trails & hiking', exact: true }).click()
    await expect(panel.getByRole('heading', { name: 'Local trails & hiking', level: 2 })).toBeVisible()
    await expect(panel.getByText(/Suggested — not on your map yet/)).toBeVisible()
    await panel.getByRole('button', { name: /\+ Add to my map/ }).click()
    await expect(panel.getByRole('heading', { name: /your notes/i })).toBeVisible() // now a real node
    await expect(panel.getByText(/Currently under/)).toContainText('Getting outside')

    // --- Back returns to where we came from; add the first one too --------
    await panel.getByRole('button', { name: '← Back' }).click()
    await expect(panel.getByRole('heading', { name: 'Everyday walking', level: 2 })).toBeVisible()
    await panel.getByRole('button', { name: /\+ Add to my map/ }).click()
    await expect(panel.getByRole('heading', { name: /your notes/i })).toBeVisible()
    await expect(panel.getByText(/Currently under/)).toContainText('Low-key cardio')

    // --- Reparent ---------------------------------------------------------
    await panel.locator('#move-select').selectOption({ label: 'Getting outside' })
    await panel.getByRole('button', { name: 'Move', exact: true }).click()
    await expect(panel.getByRole('status')).toContainText('Moved under “Getting outside”')
    await expect(panel.getByText(/Currently under/)).toContainText('Getting outside')

    // --- Cross-link: create, see it on the map, remove --------------------
    await expect(page.getByTestId('cross-link')).toHaveCount(0)
    await panel.locator('#link-select').selectOption({ label: 'Local trails & hiking' })
    await panel.getByRole('button', { name: 'Link', exact: true }).click()
    await expect(page.getByTestId('cross-link')).toHaveCount(1)
    await expect(panel.getByRole('button', { name: 'Remove link to Local trails & hiking' })).toBeVisible()
    await panel.getByRole('button', { name: 'Remove link to Local trails & hiking' }).click()
    await expect(page.getByTestId('cross-link')).toHaveCount(0)

    // --- List view reflects the move and has the same discovery tools -----
    await page.getByRole('button', { name: 'List', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Everyday walking$/ })).toBeVisible()
    await page.getByRole('button', { name: 'Details for Nature' }).click()
    await expect(page.getByRole('complementary', { name: 'Details' }).getByRole('heading', { name: 'Nature', level: 2 })).toBeVisible()

    // --- Suggested experiment from the brainstorm: save it for later ------
    await page.getByRole('button', { name: 'Map', exact: true }).click()
    await expect(page.getByRole('heading', { name: /a few things from your brainstorm/i })).toBeVisible()
    const chessRow = page.locator('li', { hasText: 'Chess fundamentals' })
    await chessRow.getByRole('button', { name: /save for later/i }).click()

    // --- Reflect ----------------------------------------------------------
    await page.getByRole('button', { name: 'Reflect', exact: true }).click()
    await expect(page.getByRole('heading', { name: /saved for later/i })).toBeVisible()
    await page.getByLabel(/general reflection/i).fill('Added walking and trails; saved chess for later.')
    await page.getByRole('button', { name: /save reflection/i }).click()
    await expect(page.getByText(/Added walking and trails/)).toBeVisible()
  })

  test('"not for me" hides a suggestion, and Reflect can bring it back', async ({ page }) => {
    await startMap(page)
    const panel = page.getByRole('complementary', { name: 'Details' })
    await page.getByRole('button', { name: /^Movement$/ }).click()
    await panel.getByRole('button', { name: 'Everyday walking: not for me' }).click()
    await expect(panel.getByRole('button', { name: 'Everyday walking', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Reflect', exact: true }).click()
    await page.getByRole('button', { name: 'Bring back Everyday walking' }).click()
    await page.getByRole('button', { name: 'Map', exact: true }).click()
    // The category panel is still open and updates itself with the restored suggestion.
    await expect(panel.getByRole('button', { name: 'Everyday walking', exact: true })).toBeVisible()
  })

  test('a category can be opened with the keyboard alone, and Escape closes the panel', async ({ page }) => {
    await startMap(page)
    const panel = page.getByRole('complementary', { name: 'Details' })
    await page.getByRole('button', { name: /^Movement$/ }).focus()
    await page.keyboard.press('Enter')
    await expect(panel.getByRole('heading', { name: 'Movement', level: 2 })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
  })

  test('when browser storage refuses writes, the person is told the change is only in this tab', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new Error('QuotaExceededError')
      }
    })
    await page.goto('/')
    await page.getByLabel(/something you're curious about/i).fill('pottery')
    await page.getByRole('button', { name: /^add$/i }).click()
    await expect(page.getByText('pottery')).toBeVisible() // still usable
    await expect(page.getByRole('alert')).toContainText(/only in this tab/)
  })

  test('phone width: the details panel is a full-screen sheet that can be closed', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await startMap(page)
    await page.getByRole('button', { name: 'List', exact: true }).click()
    await page.getByRole('button', { name: 'Details for Movement' }).click()
    const panel = page.getByRole('complementary', { name: 'Details' })
    await expect(panel.getByRole('heading', { name: 'Movement', level: 2 })).toBeVisible()
    const box = await panel.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(370)
    await panel.getByRole('button', { name: 'Close ✕' }).click()
    await expect(panel).toHaveCount(0)
  })
})
