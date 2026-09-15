import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchSnapshot } from '../src/client/snapshot.mjs'

const locationLike = { protocol: 'http:', origin: 'http://127.0.0.1:3080' }
const pngPrefix = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function responseWithReader(reader, headers = {}) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'image/png', ...headers }),
    body: { getReader: () => reader },
  }
}

test('snapshot rejects non-Uint8Array stream chunks before size accounting', async () => {
  let released = false
  const reader = {
    reads: 0,
    async read() {
      this.reads += 1
      return this.reads === 1 ? { done: false, value: 'not-bytes' } : { done: true }
    },
    releaseLock() { released = true },
  }
  await assert.rejects(
    fetchSnapshot({ locationLike, fetchImpl: async () => responseWithReader(reader) }),
    /invalid response body/,
  )
  assert.equal(released, true)
})

test('snapshot preserves the size-limit error when stream cancellation fails', async () => {
  let released = false
  let cancelled = false
  const reader = {
    reads: 0,
    async read() {
      this.reads += 1
      return this.reads === 1 ? { done: false, value: pngPrefix } : { done: true }
    },
    async cancel() {
      cancelled = true
      throw new Error('cancel failed')
    },
    releaseLock() { released = true },
  }
  await assert.rejects(
    fetchSnapshot({ locationLike, maxBytes: 4, fetchImpl: async () => responseWithReader(reader) }),
    /browser size limit/,
  )
  assert.equal(cancelled, true)
  assert.equal(released, true)
})

test('snapshot preserves the size-limit error when cancellation throws synchronously', async () => {
  let released = false
  let cancelled = false
  const reader = {
    async read() {
      return { done: false, value: pngPrefix }
    },
    cancel() {
      cancelled = true
      throw new Error('cancel failed synchronously')
    },
    releaseLock() { released = true },
  }
  await assert.rejects(
    fetchSnapshot({ locationLike, maxBytes: 4, fetchImpl: async () => responseWithReader(reader) }),
    /browser size limit/,
  )
  assert.equal(cancelled, true)
  assert.equal(released, true)
})

test('snapshot preserves the primary body error when releaseLock cleanup fails', async () => {
  let released = false
  const reader = {
    async read() {
      return { done: false, value: 'not-bytes' }
    },
    releaseLock() {
      released = true
      throw new Error('release failed synchronously')
    },
  }
  await assert.rejects(
    fetchSnapshot({ locationLike, fetchImpl: async () => responseWithReader(reader) }),
    /invalid response body/,
  )
  assert.equal(released, true)
})


function rejectedSnapshotResponse({ ok = true, status = 200, contentType = 'image/png', contentLength = null, cancel }) {
  return {
    ok,
    status,
    headers: new Headers({
      'content-type': contentType,
      ...(contentLength === null ? {} : { 'content-length': contentLength }),
    }),
    body: { cancel },
  }
}

test('snapshot pre-reader rejection cancels unread bodies and preserves primary errors', async () => {
  const cases = [
    { response: rejectedSnapshotResponse({ ok: false, status: 503, cancel() { throw new Error('cancel failed') } }), expected: /HTTP 503/ },
    { response: rejectedSnapshotResponse({ contentType: 'text/plain', cancel() { return Promise.reject(new Error('cancel failed')) } }), expected: /unexpected content type/ },
    { response: rejectedSnapshotResponse({ contentLength: '999', cancel() { throw new Error('cancel failed') } }), expected: /browser size limit/, maxBytes: 16 },
    { response: rejectedSnapshotResponse({ contentLength: '2x', cancel() { return Promise.reject(new Error('cancel failed')) } }), expected: /invalid Content-Length/ },
  ]
  for (const { response, expected, maxBytes } of cases) {
    let cancelled = false
    const originalCancel = response.body.cancel
    response.body.cancel = () => {
      cancelled = true
      return originalCancel()
    }
    await assert.rejects(fetchSnapshot({
      locationLike,
      ...(maxBytes ? { maxBytes } : {}),
      fetchImpl: async () => response,
    }), expected)
    assert.equal(cancelled, true)
  }
})
