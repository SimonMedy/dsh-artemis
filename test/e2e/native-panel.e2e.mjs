import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const authUrlFile = process.env.DSH_AUTH_URL_FILE
const artifactDir = process.env.DSH_ARTEMIS_E2E_ARTIFACT_DIR
if (!authUrlFile) throw new Error('DSH_AUTH_URL_FILE is required')
if (!artifactDir) throw new Error('DSH_ARTEMIS_E2E_ARTIFACT_DIR is required')

const authenticatedUrl = (await readFile(authUrlFile, 'utf8')).trim()
if (!authenticatedUrl.startsWith('http://127.0.0.1:')) throw new Error('Harness authenticated URL is not loopback HTTP')

await mkdir(artifactDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

try {
  await page.goto(authenticatedUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForURL((url) => !url.searchParams.has('token'), { timeout: 15_000 })

  const continueButton = page.getByRole('button', { name: /^(Continue|继续)$/i }).first()
  if (await continueButton.count() > 0 && await continueButton.isVisible()) {
    await continueButton.click()
  }

  const androidGuideEntry = page.locator('[data-sidebar-right-guide-entry="android"]')
  await androidGuideEntry.waitFor({ state: 'visible', timeout: 20_000 })
  await androidGuideEntry.click()

  const panel = page.locator('[data-dsh-artemis-panel]')
  await panel.waitFor({ state: 'visible', timeout: 15_000 })

  await panel.getByText('ARTEMIS Ready', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 })
  await panel.getByText('Pixel_9', { exact: true }).waitFor({ state: 'visible' })
  await panel.getByText('emulator-5554', { exact: true }).waitFor({ state: 'visible' })
  await panel.getByText('Connected', { exact: true }).waitFor({ state: 'visible' })

  const refresh = panel.getByRole('button', { name: 'Refresh Android status' })
  assert.equal(await refresh.count(), 1)
  await refresh.click()
  await panel.getByText('ARTEMIS Ready', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 })

  const panelBox = await panel.boundingBox()
  assert.ok(panelBox && panelBox.width > 180 && panelBox.height > 200, 'Android panel must occupy a usable sidebar surface')
} catch (error) {
  await page.screenshot({ path: join(artifactDir, 'native-panel-failure.png'), fullPage: true }).catch(() => {})
  throw error
} finally {
  await browser.close()
}
