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

async function diagnostics() {
  return page.evaluate(({ workspaceId, sessionId }) => {
    const entries = Array.isArray(window.__DSH_BOOT__?.entries) ? window.__DSH_BOOT__.entries : []
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].map((element) => ({
      label: element.getAttribute('aria-label'),
      text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 240),
    }))
    return {
      createdWorkspaceId: workspaceId,
      createdSessionId: sessionId,
      bootPresent: Boolean(window.__DSH_BOOT__),
      entryIds: entries.map((entry) => entry?.id ?? null),
      artemisEntry: entries.find((entry) => entry?.id === 'dsh-artemis') ?? null,
      loaderPresent: Boolean(window.__ModuleLoader__),
      guidePresent: Boolean(document.querySelector('[data-sidebar-right-guide]')),
      expandPresent: Boolean(document.querySelector('[data-sidebar-right-expand]')),
      workspaceRows: document.querySelectorAll('[role="treeitem"][aria-expanded]').length,
      sessionRows: document.querySelectorAll('[role="treeitem"][aria-selected]').length,
      dialogs,
    }
  }, { workspaceId: createdWorkspaceId, sessionId: createdSessionId })
    .catch(() => ({ diagnosticsFailed: true, createdWorkspaceId, createdSessionId }))
}

async function callHarnessRpc(endpoint, method, args) {
  return page.evaluate(async ({ endpoint, method, args }) => {
    const rpcId = crypto.randomUUID()
    const response = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { args } }),
    })
    if (!response.ok) throw new Error(`${method} transport failed: HTTP ${response.status}`)
    const envelope = await response.json()
    if (envelope?.type !== 'server-response' || envelope?.rpcId !== rpcId) {
      throw new Error(`${method} returned an invalid RPC envelope`)
    }
    if (envelope?.result?.ok !== true) {
      const code = envelope?.result?.error?.code ?? 'unknown'
      const message = envelope?.result?.error?.message ?? `${method} failed`
      throw new Error(`${method} failed: ${code}: ${message}`)
    }
    return envelope.result.value
  }, { endpoint, method, args })
}

async function configureDeterministicProvider() {
  const described = await callHarnessRpc('settings/describe', 'settings/describe', {})
  const namespace = Array.isArray(described?.namespaces)
    ? described.namespaces.find((candidate) => candidate?.ns === 'llm-deepseek')
    : null
  assert.ok(namespace, 'Harness must expose the llm-deepseek settings namespace')
  assert.ok(Number.isSafeInteger(namespace.revision), 'llm-deepseek settings must expose a revision')

  const updated = await callHarnessRpc('settings/update', 'settings/update', {
    ns: 'llm-deepseek',
    patch: { baseURL: 'http://127.0.0.1:8001' },
    expectedRevision: namespace.revision,
  })
  assert.equal(updated?.ns, 'llm-deepseek', 'Harness must update the DeepSeek provider namespace')

  await callHarnessRpc('credentials/set', 'credentials/set', {
    ref: 'DEEPSEEK_API_KEY',
    value: 'dsh-artemis-e2e-dummy',
  })
}

async function createWorkspaceAndSession(cwd) {
  const workspaceValue = await callHarnessRpc('workspace/create', 'workspace/create', { request: { path: cwd } })
  const workspaceId = workspaceValue?.workspace?.workspaceId
  if (typeof workspaceId !== 'string' || !workspaceId) throw new Error('workspace.create did not return workspace.workspaceId')

  const sessionValue = await callHarnessRpc('session/create', 'session/create', { request: { workspaceId } })
  const sessionId = sessionValue?.sessionId
  if (typeof sessionId !== 'string' || !sessionId) throw new Error('session.create did not return sessionId')
  return { workspaceId, sessionId }
}

async function engageSession(sessionId) {
  const value = await callHarnessRpc('session/prompt', 'session/prompt', {
    request: {
      requestId: crypto.randomUUID(),
      sessionId,
      mode: 'queue',
      content: [{ type: 'text', text: 'Open the deterministic browser test session.' }],
      clientTimeZone: 'UTC',
    },
  })
  assert.equal(value?.accepted, true, 'Harness must accept the deterministic local-provider prompt')

  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const list = await callHarnessRpc('session/list', 'session/list', { _request: {} })
    const item = Array.isArray(list?.items) ? list.items.find((entry) => entry?.sessionId === sessionId) : null
    if (item?.blank === false) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Harness session did not become non-blank after the deterministic prompt')
}

async function completeHarnessOnboarding({ waitForNotice = false } = {}) {
  const notice = page.getByRole('dialog', { name: 'Internal Testing Notice' }).first()
  if (waitForNotice) {
    await notice.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {})
  }
  if (await notice.count() > 0 && await notice.isVisible()) {
    const continueButton = notice.getByRole('button', { name: /^(Continue|继续)$/i })
    await continueButton.click()
    await notice.waitFor({ state: 'hidden', timeout: 10_000 })
  }

  const credentialDialog = page.getByRole('dialog', { name: 'Add an API key to get started' }).first()
  await credentialDialog.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {})
  if (await credentialDialog.count() > 0 && await credentialDialog.isVisible()) {
    const configureLater = credentialDialog.getByRole('button', { name: /^(Configure later|稍后配置)$/i })
    await configureLater.click()
    await credentialDialog.waitFor({ state: 'hidden', timeout: 10_000 })
  }
}

try {
  phase = 'authenticate'
  await page.goto(authenticatedUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForURL((url) => !url.searchParams.has('token'), { timeout: 15_000 })

  phase = 'onboarding-before-workspace'
  await completeHarnessOnboarding({ waitForNotice: true })

  phase = 'configure-local-provider'
  await configureDeterministicProvider()

  phase = 'create-workspace-session'
  const created = await createWorkspaceAndSession(sessionCwd)
  createdWorkspaceId = created.workspaceId
  createdSessionId = created.sessionId

  phase = 'engage-session'
  await engageSession(createdSessionId)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })

  phase = 'onboarding-after-reload'
  await completeHarnessOnboarding()

  phase = 'expand-workspace'
  const workspaceRows = page.locator('[role="treeitem"][aria-expanded]')
  await workspaceRows.first().waitFor({ state: 'visible', timeout: 20_000 })
  assert.equal(await workspaceRows.count(), 1, 'isolated E2E profile must contain exactly one workspace row')
  if (await workspaceRows.first().getAttribute('aria-expanded') !== 'true') await workspaceRows.first().click()

  phase = 'open-created-session'
  const sessionRows = page.locator('[role="treeitem"][aria-selected]')
  await sessionRows.first().waitFor({ state: 'visible', timeout: 20_000 })
  assert.equal(await sessionRows.count(), 1, 'isolated E2E profile must contain exactly one session row')
  await sessionRows.first().click()

  phase = 'wait-session-shell'
  const expandSidebar = page.locator('[data-sidebar-right-expand]')
  await expandSidebar.waitFor({ state: 'visible', timeout: 20_000 })
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
  const state = await diagnostics()
  const summary = error instanceof Error ? error.message.split('\n')[0] : String(error)
  const signals = browserSignals.slice(-3).join(' | ')
  console.error(`[dsh-artemis-e2e] phase=${phase} error=${summary} diagnostics=${JSON.stringify(state)}${signals ? ` browser=${signals}` : ''}`)
  throw error
} finally {
  await browser.close()
}
