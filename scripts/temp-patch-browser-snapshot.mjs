import { readFileSync, writeFileSync } from 'node:fs'

const sourcePath = 'src/client/snapshot.mjs'
let source = readFileSync(sourcePath, 'utf8')
const oldLoop = `  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) throw new Error('Android snapshot returned an invalid response body')
      size += value.byteLength
      if (size > maxBytes) {
        try { await reader.cancel() } catch {}
        throw new Error('Android snapshot exceeded the browser size limit')
      }
      chunks.push(value)
    }
  } finally {
    try { reader.releaseLock?.() } catch {}
  }`
const newLoop = `  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) throw new Error('Android snapshot returned an invalid response body')
      size += value.byteLength
      if (size > maxBytes) {
        throw new Error('Android snapshot exceeded the browser size limit')
      }
      chunks.push(value)
    }
  } catch (error) {
    try { await reader.cancel?.() } catch {}
    throw error
  } finally {
    try { reader.releaseLock?.() } catch {}
  }`
if (source.split(oldLoop).length !== 2) throw new Error('expected one snapshot read loop')
writeFileSync(sourcePath, source.replace(oldLoop, newLoop))

const testPath = 'test/client-snapshot-stream.test.mjs'
let test = readFileSync(testPath, 'utf8')
const marker = "test('snapshot rejects non-Uint8Array stream chunks before size accounting'"
if (test.split(marker).length !== 2) throw new Error('expected one snapshot test marker')
const addition = `test('snapshot read failure cancels the reader and preserves the original error', async () => {
  const readFailure = new Error('read failed')
  let cancelled = false
  let released = false
  const reader = {
    async read() { throw readFailure },
    cancel() {
      cancelled = true
      return Promise.reject(new Error('cancel failed'))
    },
    releaseLock() { released = true },
  }
  await assert.rejects(
    fetchSnapshot({ locationLike, fetchImpl: async () => responseWithReader(reader) }),
    (error) => error === readFailure,
  )
  assert.equal(cancelled, true)
  assert.equal(released, true)
})

test('snapshot invalid chunk cancels the reader without masking the protocol error', async () => {
  let cancelled = false
  let released = false
  const reader = {
    async read() { return { done: false, value: 'not-bytes' } },
    cancel() {
      cancelled = true
      throw new Error('cancel failed synchronously')
    },
    releaseLock() { released = true },
  }
  await assert.rejects(
    fetchSnapshot({ locationLike, fetchImpl: async () => responseWithReader(reader) }),
    /invalid response body/,
  )
  assert.equal(cancelled, true)
  assert.equal(released, true)
})

`
writeFileSync(testPath, test.replace(marker, addition + marker))
