import assert from 'node:assert/strict'
import test from 'node:test'
import { createSnapshotObjectUrl, fetchSnapshot, snapshotEndpoint } from '../src/client/snapshot.mjs'

const locationLike = { protocol: 'http:', origin: 'http://127.0.0.1:3080' }
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x41])

function pngResponse(data = png, headers = {}) {
  return new Response(data, {
    status: 200,
    headers: { 'content-type': 'image/png', 'content-length': String(data.byteLength), ...headers },
  })
}

test('snapshot endpoint is same-origin and Web-only', () => {
  assert.equal(snapshotEndpoint(locationLike), 'http://127.0.0.1:3080/dsh-artemis/v1/snapshot')
  assert.equal(snapshotEndpoint({ protocol: 'file:', origin: 'null' }), null)
})

test('snapshot fetch uses bounded same-origin no-store semantics', async () => {
  let seen = null
  const snapshot = await fetchSnapshot({
    locationLike,
    fetchImpl: async (url, init) => { seen = { url, init }; return pngResponse() },
  })
  assert.equal(seen.url, 'http://127.0.0.1:3080/dsh-artemis/v1/snapshot')
  assert.equal(seen.init.method, 'GET')
  assert.equal(seen.init.credentials, 'same-origin')
  assert.equal(seen.init.cache, 'no-store')
  assert.equal(seen.init.redirect, 'error')
  assert.equal(seen.init.headers.accept, 'image/png')
  assert.equal(snapshot.mediaType, 'image/png')
  assert.deepEqual(snapshot.data, png)
})

test('snapshot rejects bad media type, signature and declared oversize', async () => {
  await assert.rejects(fetchSnapshot({ locationLike, fetchImpl: async () => new Response(png, { status: 200, headers: { 'content-type': 'image/jpeg' } }) }), /unexpected content type/)
  const invalid = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])
  await assert.rejects(fetchSnapshot({ locationLike, fetchImpl: async () => pngResponse(invalid) }), /valid PNG/)
  await assert.rejects(fetchSnapshot({ locationLike, maxBytes: 8, fetchImpl: async () => pngResponse(png) }), /size limit/)
})

test('object URL lifecycle is explicit and idempotent', () => {
  const revoked = []
  class BlobStub { constructor(parts, options) { this.parts = parts; this.type = options.type } }
  const URLImpl = {
    createObjectURL() { return 'blob:dsh-artemis-preview' },
    revokeObjectURL(url) { revoked.push(url) },
  }
  const handle = createSnapshotObjectUrl({ mediaType: 'image/png', data: png, bytes: png.byteLength }, { BlobImpl: BlobStub, URLImpl })
  assert.equal(handle.url, 'blob:dsh-artemis-preview')
  handle.revoke()
  handle.revoke()
  assert.deepEqual(revoked, ['blob:dsh-artemis-preview'])
})
