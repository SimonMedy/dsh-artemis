import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveArtemisBaseUrl } from '../src/host/artemis-http.mjs'

test('ARTEMIS base URL accepts only literal loopback hosts', () => {
  assert.equal(resolveArtemisBaseUrl('http://127.0.0.1:8000').href, 'http://127.0.0.1:8000/')
  assert.equal(resolveArtemisBaseUrl('http://[::1]:8000').href, 'http://[::1]:8000/')
  for (const value of [
    'http://localhost:8000',
    'http://127.0.0.2:8000',
    'http://example.invalid:8000',
  ]) {
    assert.throws(
      () => resolveArtemisBaseUrl(value),
      (error) => error?.code === 'non-loopback-base-url',
    )
  }
})
