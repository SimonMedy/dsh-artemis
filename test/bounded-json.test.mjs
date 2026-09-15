import assert from 'node:assert/strict'
import test from 'node:test'
import { readBoundedJsonResponse } from '../src/client/bounded-json.mjs'

function jsonResponse(body, headers = {}) {
  return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })
}

test('reads a bounded JSON response', async () => {
  assert.deepEqual(await readBoundedJsonResponse(jsonResponse('{"ok":true}'), { maxBytes: 32 }), { ok: true })
})

test('rejects an invalid JSON content type before parsing', async () => {
  await assert.rejects(
    readBoundedJsonResponse(new Response('{"ok":true}', { headers: { 'content-type': 'text/plain' } })),
    /content type/,
  )
})

test('rejects an oversized declared content length', async () => {
  await assert.rejects(
    readBoundedJsonResponse(jsonResponse('{}', { 'content-length': '1000' }), { maxBytes: 16 }),
    /size limit/,
  )
})

test('rejects a non-streamable body without falling back to full-body allocation', async () => {
  let arrayBufferCalled = false
  const response = {
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null
      },
    },
    body: null,
    async arrayBuffer() {
      arrayBufferCalled = true
      throw new Error('arrayBuffer must never be called')
    },
  }
  await assert.rejects(readBoundedJsonResponse(response, { maxBytes: 32 }), /non-streamable response body/)
  assert.equal(arrayBufferCalled, false)
})

test('rejects an oversized streamed body even without content length', async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"value":"'))
      controller.enqueue(new TextEncoder().encode('x'.repeat(64)))
      controller.enqueue(new TextEncoder().encode('"}'))
      controller.close()
    },
  })
  const response = new Response(body, { headers: { 'content-type': 'application/json' } })
  await assert.rejects(readBoundedJsonResponse(response, { maxBytes: 32 }), /size limit/)
})

test('rejects malformed length, invalid UTF-8 and invalid JSON', async (t) => {
  await assert.rejects(
    readBoundedJsonResponse(jsonResponse('{}', { 'content-length': '2x' })),
    /content length/,
  )
  await t.test('invalid UTF-8', async () => {
    const response = new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'application/json' } })
    await assert.rejects(readBoundedJsonResponse(response), /UTF-8/)
  })
  await t.test('invalid JSON', async () => {
    await assert.rejects(readBoundedJsonResponse(jsonResponse('{')), /invalid JSON/)
  })
})


test('browser JSON pre-reader metadata rejection cancels the body without masking the primary error', async () => {
  for (const [headers, expected] of [
    [{ 'content-type': 'text/plain' }, /content type/],
    [{ 'content-type': 'application/json', 'content-length': '1000' }, /size limit/],
    [{ 'content-type': 'application/json', 'content-length': '2x' }, /content length/],
  ]) {
    let cancelled = false
    const response = {
      headers: new Headers(headers),
      body: {
        cancel() {
          cancelled = true
          throw new Error('cancel failed')
        },
      },
    }
    await assert.rejects(readBoundedJsonResponse(response, { maxBytes: 16 }), expected)
    assert.equal(cancelled, true)
  }
})

test('browser JSON non-streamable bodies are cancelled when possible', async () => {
  let cancelled = false
  const response = {
    headers: new Headers({ 'content-type': 'application/json' }),
    body: {
      cancel() {
        cancelled = true
        return Promise.reject(new Error('cancel failed'))
      },
    },
  }
  await assert.rejects(readBoundedJsonResponse(response), /non-streamable response body/)
  assert.equal(cancelled, true)
})
