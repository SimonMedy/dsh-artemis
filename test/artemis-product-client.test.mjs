import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createProductArtemisHttpClient,
  resolveProductArtemisBaseUrl,
} from '../src/host/artemis-product-client.mjs'

function rejectsNonLiteralLoopback(value) {
  assert.throws(
    () => resolveProductArtemisBaseUrl(value),
    (error) => error?.code === 'non-literal-loopback-base-url',
  )
}

test('product ARTEMIS transport defaults to the literal IPv4 loopback address', () => {
  assert.equal(resolveProductArtemisBaseUrl().href, 'http://127.0.0.1:8000/')
  assert.equal(createProductArtemisHttpClient().baseUrl.href, 'http://127.0.0.1:8000/')
})

test('product ARTEMIS transport accepts only literal IPv4 or IPv6 loopback hosts', () => {
  assert.equal(resolveProductArtemisBaseUrl('http://127.0.0.1:9000').hostname, '127.0.0.1')
  assert.equal(resolveProductArtemisBaseUrl('http://[::1]:9000').hostname, '[::1]')
  rejectsNonLiteralLoopback('http://localhost:8000')
})

test('literal-loopback policy composes with the existing base URL validation', () => {
  assert.throws(() => resolveProductArtemisBaseUrl('http://example.com:8000'), (error) => error?.code === 'non-loopback-base-url')
  assert.throws(() => resolveProductArtemisBaseUrl('ftp://127.0.0.1:8000'), (error) => error?.code === 'invalid-base-url')
  assert.throws(() => resolveProductArtemisBaseUrl('http://127.0.0.1:8000/path'), (error) => error?.code === 'invalid-base-url')
})

test('product client factory rejects malformed options rather than coercing them', () => {
  assert.throws(() => createProductArtemisHttpClient(null), /options must be an object/)
  assert.throws(() => createProductArtemisHttpClient([]), /options must be an object/)
})
