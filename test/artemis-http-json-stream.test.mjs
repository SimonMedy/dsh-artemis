import assert from 'node:assert/strict'
import test from 'node:test'
import { ArtemisHttpClient, ArtemisProtocolError } from '../src/host/artemis-http.mjs'

function headers(contentLength = null) {
  return {
    get(name) {
      const normalized = name.toLowerCase()
      if (normalized === 'content-type') return 'application/json'
      if (normalized === 'content-length') return contentLength
      return null
    },
  }
}

function responseWithReader(reader, contentLength = null) {
  return {
    ok: true,
    status: 200,
    headers: headers(contentLength),
    body: { getReader: () => reader },
  }
}

test('Host JSON reader rejects non-byte stream chunks before size accounting', async () => {
  let released = false
  const reader = {
    reads: 0,
    async read() {
      this.reads += 1
      return this.reads === 1 ? { done: false, value: 'not-bytes' } : { done: true }
    },
    releaseLock() { released = true },
  }
  const client = new ArtemisHttpClient({ fetchImpl: async () => responseWithReader(reader) })
  await assert.rejects(
    client.health(),
    (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-json',
  )
  assert.equal(released, true)
})

test('Host JSON reader preserves response-too-large when cancellation fails', async () => {
  let cancelled = false
  let released = false
  const reader = {
    async read() { return { done: false, value: Uint8Array.from([1, 2, 3, 4, 5]) } },
    async cancel() {
      cancelled = true
      throw new Error('cancel failed')
    },
    releaseLock() { released = true },
  }
  const client = new ArtemisHttpClient({
    maxJsonBytes: 4,
    fetchImpl: async () => responseWithReader(reader),
  })
  await assert.rejects(
    client.health(),
    (error) => error instanceof ArtemisProtocolError && error.code === 'response-too-large',
  )
  assert.equal(cancelled, true)
  assert.equal(released, true)
})

test('Host JSON reader rejects invalid UTF-8 even when replacement decoding would yield valid JSON', async () => {
  const invalidUtf8Json = Uint8Array.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d])
  const reader = {
    reads: 0,
    async read() {
      this.reads += 1
      return this.reads === 1
        ? { done: false, value: invalidUtf8Json }
        : { done: true, value: undefined }
    },
    releaseLock() {},
  }
  const client = new ArtemisHttpClient({ fetchImpl: async () => responseWithReader(reader) })
  await assert.rejects(
    client.health(),
    (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-json',
  )
})
