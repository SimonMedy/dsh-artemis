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
