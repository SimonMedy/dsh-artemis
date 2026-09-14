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
