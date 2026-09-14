import assert from 'node:assert/strict'
import test from 'node:test'
import { ArtemisHttpClient, ArtemisProtocolError } from '../src/host/artemis-http.mjs'

function responseWithLength(contentLength, { onRead = () => {} } = {}) {
  const reader = {
    async read() {
      onRead()
      return { done: true, value: undefined }
    },
    releaseLock() {},
  }
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        const normalized = name.toLowerCase()
        if (normalized === 'content-type') return 'application/json'
        if (normalized === 'content-length') return contentLength
        return null
      },
    },
    body: { getReader: () => reader },
  }
}

test('Host JSON rejects non-decimal Content-Length forms before reading the body', async () => {
  for (const contentLength of ['0x10', '1e6', ' 16', '+16', '-1', '16.0', '9007199254740992']) {
    let reads = 0
    const client = new ArtemisHttpClient({
      fetchImpl: async () => responseWithLength(contentLength, { onRead: () => { reads += 1 } }),
    })
    await assert.rejects(
      client.health(),
      (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-content-length',
      contentLength,
    )
    assert.equal(reads, 0, contentLength)
  }
})

test('Host JSON rejects an oversized decimal Content-Length before reading the body', async () => {
  let reads = 0
  const client = new ArtemisHttpClient({
    maxJsonBytes: 8,
    fetchImpl: async () => responseWithLength('16', { onRead: () => { reads += 1 } }),
  })
  await assert.rejects(
    client.health(),
    (error) => error instanceof ArtemisProtocolError && error.code === 'response-too-large',
  )
  assert.equal(reads, 0)
})
