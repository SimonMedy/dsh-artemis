import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDecimalContentLength } from '../src/shared/content-length.mjs'
import { readBoundedJsonResponse } from '../src/client/bounded-json.mjs'
import { ArtemisHttpClient, ArtemisProtocolError } from '../src/host/artemis-http.mjs'
import { getTaskStatus } from '../src/host/artemis-evidence.mjs'

test('shared Content-Length parser accepts only safe decimal integers', () => {
  assert.equal(parseDecimalContentLength(null), null)
  assert.equal(parseDecimalContentLength('0'), 0)
  assert.equal(parseDecimalContentLength('16'), 16)
  for (const value of ['', ' 16', '+16', '-1', '16.0', '1e6', '0x10', '9007199254740992']) {
    assert.throws(() => parseDecimalContentLength(value), TypeError, value)
  }
})

test('browser reader treats unsafe declared length as invalid length, not size overflow', async () => {
  const response = new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '9007199254740992' } })
  await assert.rejects(readBoundedJsonResponse(response), /invalid content length/)
})

function responseWithLength(value) {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        if (name.toLowerCase() === 'content-type') return 'application/json'
        if (name.toLowerCase() === 'content-length') return value
        return null
      },
    },
    body: null,
  }
}

test('Host reader preserves invalid-content-length for unsafe declared length', async () => {
  const client = new ArtemisHttpClient({ fetchImpl: async () => responseWithLength('9007199254740992') })
  await assert.rejects(client.health(), (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-content-length')
})

test('evidence reader rejects unsafe declared length as invalid evidence before body read', async () => {
  const client = new ArtemisHttpClient({ fetchImpl: async () => responseWithLength('9007199254740992') })
  await assert.rejects(getTaskStatus(client), (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-evidence')
})
