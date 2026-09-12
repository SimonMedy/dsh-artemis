import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { OVERVIEW_ROUTE, createOverviewHandler } from '../src/host/harness-routes.mjs'

function readyClient() {
  return {
    async health() { return { reachable: true, status: 'ready' } },
    async listDevices() { return [] },
    async getStreamState() { return { connected: false, serial: null } },
  }
}

async function serve(handler, run) {
  const server = createServer(handler)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
}

test('overview exposes only bounded setup enums and drops local details', async () => {
  const privatePath = '/private/artemis-root-secret-must-not-leak'
  const setupStatus = Promise.resolve({
    artemisRoot: 'validated',
    python: 'validated-explicit',
    mcpRuntime: 'connected',
    rootPath: privatePath,
    command: '/private/python-secret-must-not-leak',
    detail: 'validation-secret-must-not-leak',
  })

  await serve(createOverviewHandler(readyClient(), { setupStatus }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${OVERVIEW_ROUTE}`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const text = await response.text()
    const body = JSON.parse(text)
    assert.deepEqual(body.setup, {
      artemisRoot: 'validated',
      python: 'validated-explicit',
      mcpRuntime: 'unobservable',
    })
    for (const secret of [privatePath, 'python-secret-must-not-leak', 'validation-secret-must-not-leak']) {
      assert.equal(text.includes(secret), false, `overview leaked ${secret}`)
    }
  })
})

test('overview collapses failed setup inspection without exposing the rejection', async () => {
  const setupStatus = Promise.reject(new Error('filesystem-secret-must-not-leak'))
  await serve(createOverviewHandler(readyClient(), { setupStatus }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${OVERVIEW_ROUTE}`)
    const text = await response.text()
    assert.equal(response.status, 200)
    assert.deepEqual(JSON.parse(text).setup, {
      artemisRoot: 'invalid',
      python: 'unknown',
      mcpRuntime: 'unobservable',
    })
    assert.equal(text.includes('filesystem-secret-must-not-leak'), false)
  })
})
