import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const authUrlFile = process.env.DSH_AUTH_URL_FILE
const artifactDir = process.env.DSH_ARTEMIS_E2E_ARTIFACT_DIR
const sessionCwd = process.env.DSH_E2E_SESSION_CWD
if (!authUrlFile) throw new Error('DSH_AUTH_URL_FILE is required')
if (!artifactDir) throw new Error('DSH_ARTEMIS_E2E_ARTIFACT_DIR is required')
if (!sessionCwd) throw new Error('DSH_E2E_SESSION_CWD is required')

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
let createdWorkspaceId = null
let createdSessionId = null

async function bootDiagnostics() {
  return page.evaluate(({ workspaceId, sessionId }) => {
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
      createdWorkspaceId: workspaceId,
      createdSessionId: sessionId,
      bootPresent: Boolean(boot),
      entryIds: entries.map((entry) => entry.id),
      artemisEntry: entries.find((entry) => entry.id === 'dsh-artemis') ?? null,
      loaderPresent: Boolean(window.__ModuleLoader__),
      guidePresent: Boolean(document.querySelector('[data-sidebar-right-guide]')),
      expandPresent: Boolean(document.querySelector('[data-sidebar-right-expand]')),
      workspaceRowCount: document.querySelectorAll('[role="treeitem"][aria-expanded]').length,
      sessionRowCount: document.querySelectorAll('[role="treeitem"][aria-selected]').length,
    }
  }, { workspaceId: createdWorkspaceId, sessionId: createdSessionId })
    .catch(() => ({ diagnosticsFailed: true, createdWorkspaceId, createdSessionId }))
}

async function callHarnessRpc(endpoint, method, args) {
  return page.evaluate(async ({ endpointPath, methodName, rpcArgs }) => {
    const rpcId = crypto.randomUUID()
    const response = await fetch(`/api/${endpointPath}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId,
        method: methodName,
        payload: { args: rpcArgs },
      }),
    })
    if (!response.ok) throw new Error(`${methodName} transport failed: HTTP ${response.status}`)
    const envelope = await response.json()
    if (envelope?.type !== 'server-response' || envelope?.rpcId !== rpcId) {
      throw new Error(`${methodName} returned an invalid RPC envelope`)
    }
    if (envelope?.result?.ok !== true) {
      const code = envelope?.result?.error?.code ?? 'unknown'
      const message = envelope?.result?.error?.message ?? `${methodName} failed`
      throw new Error(`${methodName} failed: ${code}: ${message}`)
    }
    return envelope.result.value
  }, { endpointPath: endpoint, methodName: method, rpcArgs: args })
}

async function createWorkspaceAndBlankSession(cwd) {
  const workspaceValue = await callHarnessRpc('workspace/create', 'workspace/create', {
    request: { path: cwd },
  })
  const workspaceId = workspaceValue?.workspace?.workspaceId
  if (typeof workspaceId !== 'string' || !workspaceId) {
    throw new Error('workspace.create did not return workspace.workspaceId')
  }

  const sessionValue = await callHarnessRpc('session/create', 'session/create', {
    request: { workspaceId },
  })
  const sessionId = sessionValue?.sessionId
  if (typeof sessionId !== 'string' || !sessionId) {
    throw new Error('session.create did not return sessionId')
  }

  return { workspaceId, sessionId }
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

  phase = 'create-workspace-session'
  const created = await createWorkspaceAndBlankSession(sessionCwd)
  createdWorkspaceId = created.workspaceId
  createdSessionId = created.sessionId
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })

  phase = 'open-created-session'
  const sessionRows = page.locator('[role="treeitem"][aria-selected]')
  await sessionRows.first().waitFor({ state: 'visible', timeout: 20_000 })
  assert.equal(await sessionRows.count(), 1, 'isolated E2E profile must contain exactly one session row')
  await sessionRows.first().click()

  phase = 'wait-session-shell'
  const expandSidebar = page.locator('[data-sidebar-right-expand]')
  await expandSidebar.waitFor({ state: 'visible', timeout: 20_000 })

  phase = 'expand-sidebar'
  await expandSidebar.click()

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
