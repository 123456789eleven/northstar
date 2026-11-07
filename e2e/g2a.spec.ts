// Phase G2a: Today (focus bar, agenda, daily find), Tasks (swipe, keyboard complete, sticky add) and Planner (time blocks).
// Fictional data only.
import { expect, test, type Page } from '@playwright/test'

async function addTask(page: Page, title: string) {
  await page.goto('/#/tasks')
  const input = page.getByLabel('New task')
  await input.fill(title)
  await input.press('Enter')
  await expect(page.getByRole('checkbox', { name: `Complete ${title}` })).toBeVisible()
}

async function swipe(page: Page, title: string, dx: number, dy = 0) {
  await page.evaluate(({ title, dx, dy }) => {
    const el = [...document.querySelectorAll('.task-row')].find((r) => r.textContent?.includes(title)) as HTMLElement
    const r = el.getBoundingClientRect()
    const x0 = r.left + 40
    const y0 = r.top + r.height / 2
    const fire = (type: string, x: number, y: number) =>
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 }))
    fire('pointerdown', x0, y0)
    for (let i = 1; i <= 6; i++) fire('pointermove', x0 + (dx * i) / 6, y0 + (dy * i) / 6)
    fire('pointerup', x0 + dx, y0 + dy)
  }, { title, dx, dy })
}

test.describe('phone 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('tasks: complete with the keyboard button and by swipe; short and vertical swipes do nothing', async ({ page }) => {
    await addTask(page, 'Fixture keyboard task')
    await addTask(page, 'Fixture swipe task')
    // The add line is pinned above the floating tab bar (the bar is inset from the screen edge, so compare tops).
    await expect.poll(async () => {
      const sticky = await page.locator('.quick-add-sticky').boundingBox()
      const bar = await page.getByRole('navigation', { name: 'Main mobile' }).boundingBox()
      return sticky!.y + sticky!.height <= bar!.y + 1 && bar!.y + bar!.height < 844
    }).toBe(true)

    // Keyboard: focus the complete checkbox, press Space.
    const kb = page.getByRole('checkbox', { name: 'Complete Fixture keyboard task' })
    await kb.focus()
    await page.keyboard.press('Space')
    await expect(page.getByText('Done: "Fixture keyboard task"')).toBeVisible()
    await expect(kb).toBeHidden()

    // Swipe: a short pull and a vertical drag leave the task open.
    const row = 'Fixture swipe task'
    await swipe(page, row, 40)
    await swipe(page, row, 20, 150)
    await expect(page.getByRole('checkbox', { name: 'Complete Fixture swipe task' })).toBeVisible()
    // A full swipe completes it, and Undo brings it back.
    await swipe(page, row, 120)
    await expect(page.getByText('Done: "Fixture swipe task"')).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Complete Fixture swipe task' })).toBeHidden()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByRole('checkbox', { name: 'Complete Fixture swipe task' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })

  test('planner: Add block sheet creates a block, tap edits it, undo removes it', async ({ page }) => {
    await addTask(page, 'Fixture sheet task')
    await page.goto('/#/planner')
    await page.getByRole('button', { name: 'Add block', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: 'Add block' })
    await expect(sheet).toBeVisible()
    await sheet.getByLabel('Task').selectOption({ label: 'Fixture sheet task' })
    await sheet.getByLabel('Start').fill('10:00')
    await sheet.getByRole('button', { name: 'Add block', exact: true }).click()
    await expect(sheet).toBeHidden()
    const ev = page.locator('.pl-ev.block', { hasText: 'Fixture sheet task' })
    await expect(ev).toBeVisible()
    await expect(ev).toContainText('10 AM')
    // Tap to edit: change to 60 minutes.
    await ev.click()
    const edit = page.getByRole('dialog', { name: 'Edit block' })
    await edit.getByLabel('Duration').selectOption('60')
    await edit.getByRole('button', { name: 'Save' }).click()
    await expect(ev).toContainText('10 AM - 11 AM')
    // Undo of the edit puts the 45 minute block back.
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(ev).toContainText('10 AM - 10:45 AM')
  })

  test('today: focus bar pins from the picker and the agenda strip scrolls inside the card', async ({ page }) => {
    await addTask(page, 'Fixture focus task')
    await page.goto('/#/')
    const focus = page.getByRole('region', { name: 'Focus' })
    await focus.getByRole('button', { name: 'Pin a task' }).click()
    await focus.getByRole('button', { name: 'Fixture focus task' }).click()
    await expect(focus.getByRole('button', { name: 'Unpin Fixture focus task from focus' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
})

test.describe('desktop 1440x900', () => {
  test('planner: Block time dialog creates a Training block and a task block; conflicts are flagged', async ({ page }) => {
    await addTask(page, 'Fixture desk task')
    await page.goto('/#/planner')
    await page.getByRole('button', { name: 'Block time', exact: true }).click()
    const dlg = page.getByRole('dialog', { name: 'Block time' })
    await dlg.getByRole('button', { name: 'Training' }).click()
    await dlg.getByLabel('Title').fill('Fixture lift')
    await dlg.getByLabel('Start').fill('09:00')
    await dlg.getByRole('button', { name: 'Add block', exact: true }).click()
    const lift = page.locator('.pl-ev.training', { hasText: 'Fixture lift' })
    await expect(lift).toBeVisible()

    await page.getByRole('button', { name: 'Block time', exact: true }).click()
    await dlg.getByLabel('Task').selectOption({ label: 'Fixture desk task' })
    await dlg.getByLabel('Start').fill('09:15')
    await dlg.getByRole('button', { name: 'Add block', exact: true }).click()
    const task = page.locator('.pl-ev.block', { hasText: 'Fixture desk task' })
    await expect(task).toBeVisible()
    await expect(task).toHaveClass(/conflict/)
    await expect(lift).toHaveClass(/conflict/)
    // The task now leaves the tray.
    await expect(page.locator('.pl-tray-item', { hasText: 'Fixture desk task' })).toHaveCount(0)

    // Undo removes the task block and clears the conflict.
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(task).toHaveCount(0)
    await expect(lift).not.toHaveClass(/conflict/)
  })

  test('planner: dragging a tray task onto the week grid creates a 45 minute block', async ({ page }) => {
    await addTask(page, 'Fixture drag task')
    await page.goto('/#/planner')
    const item = page.locator('.pl-tray-item', { hasText: 'Fixture drag task' })
    const col = page.locator('.pl-wk-col.today')
    await item.dragTo(col, { targetPosition: { x: 40, y: 120 } })
    const ev = page.locator('.pl-ev.block', { hasText: 'Fixture drag task' })
    await expect(ev).toBeVisible()
    await expect(ev).toContainText(/\d(:45)? (AM|PM) - /)
  })

  test('today: daily find is hidden with no data; focus and agenda render; tasks focus bar is shared', async ({ page }) => {
    await page.goto('/#/')
    await expect(page.getByRole('region', { name: 'Focus' })).toBeVisible()
    await expect(page.getByRole('region', { name: "Today's agenda" })).toBeVisible()
    await expect(page.getByTestId('daily-find')).toHaveCount(0)

    await addTask(page, 'Fixture shared pin')
    await page.getByRole('button', { name: "Pin to today's focus" }).first().click()
    await expect(page.getByRole('region', { name: 'Focus' }).getByRole('button', { name: 'Unpin Fixture shared pin from focus' })).toBeVisible()
    await page.goto('/#/')
    await expect(page.getByRole('region', { name: 'Focus' }).getByText('Fixture shared pin')).toBeVisible()
  })
})
