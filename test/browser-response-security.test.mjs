import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { apply } from '../src/index.mjs'
import { withBrowserResponseSecurity } from '../src/host/browser-response-security.mjs'

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

test('secure webServer wrapper preserves route registration and baseline response headers', async () => {
  let registered
  const webServer = {
    register(route) {
      registered = route
      return () => {}
    },
  }
  const secure = withBrowserResponseSecurity(webServer)
  secure.register({
    kind: 'exact',
    path: '/fixture',
    handler(_req, res) {
      res.statusCode = 403
      res.end()
    },
  })

  assert.equal(registered.kind, 'exact')
  assert.equal(registered.path, '/fixture')
  await serve(registered.handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/fixture`)
    assert.equal(response.status, 403)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  })
})

test('plugin trust-fence rejections inherit no-store and nosniff on every browser route', async () => {
  const registrations = []
  let dispose
  const ctx = {
    webServer: {
      register(route) {
        registrations.push(route)
        return () => {}
      },
    },
    connection: {
      requestRejection() { return 403 },
    },
    effect(callback) {
      dispose = callback()
    },
  }

  apply(ctx)
  assert.equal(registrations.length, 5)

  const routes = new Map(registrations.map((route) => [route.path, route.handler]))
  await serve((req, res) => {
    const handler = routes.get(new URL(req.url, 'http://127.0.0.1').pathname)
    if (!handler) {
      res.statusCode = 404
      res.end()
      return
    }
    void handler(req, res)
  }, async (baseUrl) => {
    for (const route of registrations) {
      const response = await fetch(`${baseUrl}${route.path}`)
      assert.equal(response.status, 403, `${route.path} did not reject untrusted access`)
      assert.equal(response.headers.get('cache-control'), 'no-store', `${route.path} may be cached`)
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${route.path} permits MIME sniffing`)
    }
  })

  dispose?.()
})

test('secure webServer wrapper rejects malformed registration inputs', () => {
  assert.throws(() => withBrowserResponseSecurity(null), /webServer service/)
  const secure = withBrowserResponseSecurity({ register() {} })
  assert.throws(() => secure.register({ kind: 'exact', path: '/missing-handler' }), /route with a handler/)
})
