import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import { createLiveHandler } from '../src/host/harness-routes.mjs'

function pngFixture() {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x41])
}

function responseFixture() {
  const res = new EventEmitter()
  res.destroyed = false
  res.headersSent = false
  res.statusCode = null
  res.ended = false
  res.writeHead = (status) => {
    res.statusCode = status
    res.headersSent = true
  }
  res.write = () => true
  res.end = () => { res.ended = true }
  res.destroy = () => { res.destroyed = true }
  return res
}

test('live route ignores synchronous iterator cleanup failure after a completed stream', async () => {
  const frame = Object.freeze({ mediaType: 'image/png', data: pngFixture(), bytes: 9 })
  let nextCalls = 0
  const client = {
    streamSnapshots() {
      return {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              nextCalls += 1
              return nextCalls === 1 ? { done: false, value: frame } : { done: true }
            },
            return() {
              throw new Error('cleanup failed')
            },
          }
        },
      }
    },
  }
  const req = new EventEmitter()
  req.method = 'GET'
  const res = responseFixture()

  await createLiveHandler(client)(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.ended, true)
  assert.equal(res.destroyed, false)
})
