import assert from 'node:assert/strict'
import test from 'node:test'
import { LIVE_MAX_RETRIES, liveEndpoint, liveRetryDelay } from '../src/client/live.mjs'

const locationLike = { protocol: 'http:', origin: 'http://127.0.0.1:3080' }

test('live endpoint is same-origin and Web-only', () => {
  assert.equal(liveEndpoint(locationLike), 'http://127.0.0.1:3080/dsh-artemis/v1/live')
  assert.equal(liveEndpoint({ protocol: 'file:', origin: 'null' }), null)
})

test('live reconnect delay is bounded and retry budget is finite', () => {
  assert.equal(LIVE_MAX_RETRIES, 4)
  assert.deepEqual([1, 2, 3, 4, 5].map((attempt) => liveRetryDelay(attempt)), [750, 1500, 3000, 3000, 3000])
  assert.equal(liveRetryDelay(4, { baseMs: 100, maxMs: 250 }), 250)
  assert.throws(() => liveRetryDelay(0), /positive integer/)
})
