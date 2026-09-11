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

const browserSignals = []
page.on('pageerror', (error) => browserSignals.push(`pageerror:${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') browserSignals.push(`console:${message.text()}`)
})

let phase = 'bootstrap'

async function bootDiagnostics() {
  return page.evaluate(() => {
    const boot = window.__DSH_BOOT__
    const entries = boot && Array.isArray(boot.entries)
      ? boot.entries.map((entry) => ({
          id: entry && typeof entry.id === 'string' ? entry.id : null,
          inject: Array.isArray(entry?.inject) ? entry.inject : [],
          external: Array.isArray(entry?.external) ? entry.external : [],
          url: typeof entry?.url === 'string' ? entry.url.replace(/([?&]token=)[^&]+/g, '$1<redacted>') : null,
        }))
      : []
    return {
      bootPresent: Boolean(boot),
      entryIds: entries.map((entry) => entry.id),
      artemisEntry: entries.find((entry) => entry.id === 'dsh-artemis') ?? null,
      loaderPresent: Boolean(window.__ModuleLoader__),
      guidePresent: Boolean(document.querySelector('[data-sidebar-right-guide]')),
      expandPresent: Boolean(document.querySelector('[data-sidebar-right-expand]')),
    }
  }).catch(() => ({ diagnosticsFailed: true }))
}

try {
  phase = 'authenticate'
  await page.goto(authenticatedUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForURL((url) => !url.searchParams.has('token'), { timeout: 15_000 })

  phase = 'first-run'
  const continueButton = page.getByRole('button', { name: /^(Continue|继续)$/i }).first()
  if (await continueButton.count() > 0 && await continueButton.isVisible()) {
    await continueButton.click()
  }

  phase = 'expand-sidebar'
  const expandSidebar = page.locator('[data-sidebar-right-expand]')
  if (await expandSidebar.count() > 0 && await expandSidebar.isVisible()) {
    await expandSidebar.click()
  }

  phase = 'open-android-guide-entry'
  const androidGuideEntry = page.locator('[data-sidebar-right-guide-entry="android"]')
  await androidGuideEntry.waitFor({ state: 'visible', timeout: 20_000 })
  await androidGuideEntry.click()

  phase = 'wait-panel'
  const panel = page.locator('[data-dsh-artemis-panel]')
  await panel.waitFor({ state: 'visible', timeout: 15_000 })

  phase = 'assert-ready-state'
  await panel.getByText('ARTEMIS Ready', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 })
  await panel.getByText('Pixel_9', { exact: true }).waitFor({ state: 'visible' })
  await panel.getByText('emulator-5554', { exact: true }).waitFor({ state: 'visible' })
  await panel.getByText('Connected', { exact: true }).waitFor({ state: 'visible' })

  phase = 'refresh'
  const refresh = panel.getByRole('button', { name: 'Refresh Android status' })
  assert.equal(await refresh.count(), 1)
  await refresh.click()
  await panel.getByText('ARTEMIS Ready', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 })

  phase = 'layout'
  const panelBox = await panel.boundingBox()
  assert.ok(panelBox && panelBox.width > 180 && panelBox.height > 200, 'Android panel must occupy a usable sidebar surface')
} catch (error) {
  await page.screenshot({ path: join(artifactDir, 'native-panel-failure.png'), fullPage: true }).catch(() => {})
  const diagnostics = await bootDiagnostics()
  const summary = error instanceof Error ? error.message.split('\n')[0] : String(error)
  const signals = browserSignals.slice(-3).join(' | ')
  console.error(`[dsh-artemis-e2e] phase=${phase} error=${summary} diagnostics=${JSON.stringify(diagnostics)}${signals ? ` browser=${signals}` : ''}`)
  throw error
} finally {
  await browser.close()
}
