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


test('Host live stream accepts a valid frame fragmented into one-byte reads', async () => {
  const frame = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x41, 0x42, 0x43, 0x44])
  const header = new TextEncoder().encode('--frame\r\nContent-Type: image/png\r\nContent-Length: 12\r\n\r\n')
  const trailer = Uint8Array.of(13, 10)
  const payload = new Uint8Array(header.byteLength + frame.byteLength + trailer.byteLength)
  payload.set(header)
  payload.set(frame, header.byteLength)
  payload.set(trailer, header.byteLength + frame.byteLength)
  let offset = 0
  const reader = {
    async read() {
      if (offset >= payload.byteLength) return { done: true }
      const value = payload.subarray(offset, offset + 1)
      offset += 1
      return { done: false, value }
    },
    async cancel() {},
    releaseLock() {},
  }

  const snapshot = await new ArtemisHttpClient({
    fetchImpl: async () => multipartResponse(reader),
  }).getSnapshot()
  assert.deepEqual([...snapshot.data], [...frame])
})
