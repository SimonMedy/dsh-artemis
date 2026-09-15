import assert from 'node:assert/strict'
import test from 'node:test'

import { ArtemisHttpClient, ArtemisProtocolError } from '../src/host/artemis-http.mjs'

test('host JSON reader preserves the primary protocol error when releaseLock cleanup fails', async () => {
  const client = new ArtemisHttpClient({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return name.toLowerCase() === 'content-type' ? 'application/json' : null
        },
      },
      body: {
        getReader() {
          return {
            async read() {
              return { done: false, value: 'not-bytes' }
            },
            releaseLock() {
              throw new Error('release failed')
            },
          }
        },
      },
    }),
  })

  await assert.rejects(
    client.health(),
    (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-json',
  )
})

test('snapshot cleanup failure does not replace a successfully received frame', async () => {
  const frame = Object.freeze({ mediaType: 'image/png', data: new Uint8Array([1]), bytes: 1 })

  class CleanupFailingClient extends ArtemisHttpClient {
    streamSnapshots() {
      return {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              return { done: false, value: frame }
            },
            return() {
              throw new Error('cleanup failed')
            },
          }
        },
      }
    }
  }

  const client = new CleanupFailingClient({ fetchImpl: async () => { throw new Error('unused') } })
  assert.equal(await client.getSnapshot(), frame)
})


test('live stream HTTP errors abort the internal request signal', async () => {
  let requestSignal
  const client = new ArtemisHttpClient({
    fetchImpl: async (_url, options) => {
      requestSignal = options.signal
      return {
        ok: false,
        status: 503,
        headers: { get() { return null } },
        body: null,
      }
    },
  })

  const iterator = client.streamSnapshots()[Symbol.asyncIterator]()
  await assert.rejects(
    iterator.next(),
    (error) => error instanceof ArtemisProtocolError && error.code === 'http-error',
  )
  assert.ok(requestSignal)
  assert.equal(requestSignal.aborted, true)
})


function liveResponse({ contentType = 'multipart/x-mixed-replace; boundary=frame', body }) {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? contentType : null
      },
    },
    body,
  }
}

test('live stream pre-reader metadata rejection cancels the unread body without masking protocol errors', async (t) => {
  for (const [name, contentType, code, cancelImpl] of [
    ['unexpected content type', 'text/plain', 'unexpected-content-type', () => { throw new Error('cancel failed') }],
    ['missing boundary', 'multipart/x-mixed-replace', 'invalid-multipart', () => Promise.reject(new Error('cancel failed'))],
  ]) {
    await t.test(name, async () => {
      let cancelled = false
      const client = new ArtemisHttpClient({
        fetchImpl: async () => liveResponse({
          contentType,
          body: {
            cancel() {
              cancelled = true
              return cancelImpl()
            },
          },
        }),
      })
      const iterator = client.streamSnapshots()[Symbol.asyncIterator]()
      await assert.rejects(
        iterator.next(),
        (error) => error instanceof ArtemisProtocolError && error.code === code,
      )
      assert.equal(cancelled, true)
    })
  }
})

test('live stream reader acquisition failure cancels the unread body and preserves the original error', async () => {
  const readerFailure = new Error('reader acquisition failed')
  let cancelled = false
  const client = new ArtemisHttpClient({
    fetchImpl: async () => liveResponse({
      body: {
        getReader() { throw readerFailure },
        cancel() {
          cancelled = true
          return Promise.reject(new Error('cancel failed'))
        },
      },
    }),
  })
  const iterator = client.streamSnapshots()[Symbol.asyncIterator]()
  await assert.rejects(iterator.next(), (error) => error === readerFailure)
  assert.equal(cancelled, true)
})
