import assert from 'node:assert/strict'
import test from 'node:test'
import { readBoundedJsonResponse } from '../src/client/bounded-json.mjs'

test('browser JSON read failure cancels the reader and preserves the original error', async () => {
  const readFailure = new Error('read failed')
  let cancelled = false
  let released = false
  const reader = {
    async read() { throw readFailure },
    cancel() {
      cancelled = true
      return Promise.reject(new Error('cancel failed'))
    },
    releaseLock() { released = true },
  }
  const response = {
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null
      },
    },
    body: {
      getReader() { return reader },
    },
  }

  await assert.rejects(readBoundedJsonResponse(response), (error) => error === readFailure)
  assert.equal(cancelled, true)
  assert.equal(released, true)
})

test('browser JSON invalid chunk cancels the reader without masking the protocol error', async () => {
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
  const response = {
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null
      },
    },
    body: {
      getReader() { return reader },
    },
  }

  await assert.rejects(readBoundedJsonResponse(response), /invalid response body/)
  assert.equal(cancelled, true)
  assert.equal(released, true)
})

test('browser JSON reader preserves the primary protocol error when releaseLock cleanup fails', async () => {
  let released = false
  const reader = {
    async read() {
      return { done: false, value: 'not-bytes' }
    },
    releaseLock() {
      released = true
      throw new Error('release failed')
    },
  }
  const response = {
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null
      },
    },
    body: {
      getReader() {
        return reader
      },
    },
  }

  await assert.rejects(
    readBoundedJsonResponse(response),
    /invalid response body/,
  )
  assert.equal(released, true)
})

test('browser JSON reader preserves the size-limit error when cancel throws synchronously', async () => {
  let cancelled = false
  let released = false
  const reader = {
    async read() {
      return { done: false, value: Uint8Array.from([1, 2, 3, 4, 5]) }
    },
    cancel() {
      cancelled = true
      throw new Error('cancel failed synchronously')
    },
    releaseLock() {
      released = true
    },
  }
  const response = {
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null
      },
    },
    body: {
      getReader() {
        return reader
      },
    },
  }

  await assert.rejects(
    readBoundedJsonResponse(response, { maxBytes: 4 }),
    /response size limit/,
  )
  assert.equal(cancelled, true)
  assert.equal(released, true)
})
