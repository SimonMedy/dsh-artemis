import assert from 'node:assert/strict'
import test from 'node:test'
import { readBoundedJsonResponse } from '../src/client/bounded-json.mjs'

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
