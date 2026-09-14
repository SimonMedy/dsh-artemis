import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { readBoundedJsonResponse } from '../src/client/bounded-json.mjs'
import { ArtemisHttpClient, ArtemisProtocolError } from '../src/host/artemis-http.mjs'
import { getTaskStatus } from '../src/host/artemis-evidence.mjs'
import { isJsonContentType, jsonMimeType } from '../src/shared/json-content-type.mjs'

test('JSON MIME policy accepts only application/json and application structured +json types', () => {
  for (const value of [
    'application/json',
    'Application/JSON; charset=utf-8',
    'application/problem+json',
    'application/vnd.example.v1+json; profile="safe"',
    'application/merge-patch+json',
  ]) assert.equal(isJsonContentType(value), true, value)

  for (const value of [
    null,
    '',
    'text/json',
    'text/application/json',
    'application/jsonp',
    'application/json-evil',
    'application/problem+jsonx',
    'image/example+json',
  ]) assert.equal(isJsonContentType(value), false, String(value))

  assert.equal(jsonMimeType(' APPLICATION/PROBLEM+JSON ; charset=utf-8'), 'application/problem+json')
})

test('browser bounded JSON rejects JSON-like MIME prefixes but accepts structured +json', async () => {
  await assert.rejects(
    readBoundedJsonResponse(new Response('{"ok":true}', { headers: { 'content-type': 'application/jsonp' } })),
    /content type/,
  )
  assert.deepEqual(
    await readBoundedJsonResponse(new Response('{"ok":true}', { headers: { 'content-type': 'application/problem+json; charset=utf-8' } })),
    { ok: true },
  )
})

function responseWithType(contentType) {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        if (name.toLowerCase() === 'content-type') return contentType
        return null
      },
    },
    body: null,
  }
}

test('Host and evidence readers reject JSON-like MIME prefixes before reading bodies', async () => {
  const hostClient = new ArtemisHttpClient({ fetchImpl: async () => responseWithType('application/jsonp') })
  await assert.rejects(
    hostClient.health(),
    (error) => error instanceof ArtemisProtocolError && error.code === 'unexpected-content-type',
  )

  const evidenceClient = new ArtemisHttpClient({ fetchImpl: async () => responseWithType('text/application/json') })
  await assert.rejects(
    getTaskStatus(evidenceClient),
    (error) => error instanceof ArtemisProtocolError && error.code === 'unexpected-content-type',
  )
})

test('all JSON readers use the shared MIME policy instead of prefix or substring matching', async () => {
  const paths = [
    new URL('../src/client/bounded-json.mjs', import.meta.url),
    new URL('../src/host/artemis-http.mjs', import.meta.url),
    new URL('../src/host/artemis-evidence.mjs', import.meta.url),
  ]
  for (const path of paths) {
    const source = await readFile(path, 'utf8')
    assert.match(source, /isJsonContentType\(/)
    assert.doesNotMatch(source, /(?:startsWith|includes)\(['"]application\/json['"]\)/)
  }
})
