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
