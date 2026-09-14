import assert from 'node:assert/strict'
import test from 'node:test'
import { ArtemisHttpClient, ArtemisProtocolError } from '../src/host/artemis-http.mjs'

function multipartResponse(reader) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'multipart/x-mixed-replace; boundary=frame' }),
    body: { getReader: () => reader },
  }
}

test('Host live stream rejects non-byte chunks before multipart buffering', async () => {
  let cancelled = false
  let released = false
  const reader = {
    reads: 0,
    async read() {
      this.reads += 1
      return this.reads === 1 ? { done: false, value: 'not-bytes' } : { done: true }
    },
    async cancel() { cancelled = true },
    releaseLock() { released = true },
  }
  const client = new ArtemisHttpClient({ fetchImpl: async () => multipartResponse(reader) })
  const iterator = client.streamSnapshots()[Symbol.asyncIterator]()
  await assert.rejects(
    iterator.next(),
    (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-multipart',
  )
  assert.equal(cancelled, true)
  assert.equal(released, true)
})

test('Host live stream preserves protocol errors when releaseLock cleanup fails', async () => {
  let cancelled = false
  const reader = {
    async read() { return { done: false, value: 'not-bytes' } },
    async cancel() { cancelled = true },
    releaseLock() { throw new Error('release failed') },
  }
  const client = new ArtemisHttpClient({ fetchImpl: async () => multipartResponse(reader) })
  const iterator = client.streamSnapshots()[Symbol.asyncIterator]()
  await assert.rejects(
    iterator.next(),
    (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-multipart',
  )
  assert.equal(cancelled, true)
})

test('Host live stream preserves protocol errors when cancel throws synchronously', async () => {
  let cancelled = false
  let released = false
  const reader = {
    async read() { return { done: false, value: 'not-bytes' } },
    cancel() {
      cancelled = true
      throw new Error('cancel failed synchronously')
    },
    releaseLock() { released = true },
  }
  const client = new ArtemisHttpClient({ fetchImpl: async () => multipartResponse(reader) })
  const iterator = client.streamSnapshots()[Symbol.asyncIterator]()
  await assert.rejects(
    iterator.next(),
    (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-multipart',
  )
  assert.equal(cancelled, true)
  assert.equal(released, true)
})
