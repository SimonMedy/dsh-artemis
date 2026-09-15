import assert from 'node:assert/strict'
import test from 'node:test'
import { BoundedByteBuffer } from '../src/host/bounded-byte-buffer.mjs'

test('bounded byte buffer grows geometrically under one-byte fragmentation', () => {
  const buffer = new BoundedByteBuffer(65_536, { initialCapacity: 8 })
  let capacity = buffer.capacity
  let growths = 0

  for (let index = 0; index < 65_536; index += 1) {
    buffer.append(Uint8Array.of(index & 0xff))
    if (buffer.capacity !== capacity) {
      growths += 1
      capacity = buffer.capacity
    }
  }

  assert.equal(buffer.length, 65_536)
  assert.equal(buffer.capacity, 65_536)
  assert.ok(growths <= 13, `expected at most 13 capacity growths, got ${growths}`)
  const view = buffer.view()
  assert.equal(view[0], 0)
  assert.equal(view[255], 255)
  assert.equal(view[256], 0)
  assert.equal(view[65_535], 255)
})

test('bounded byte buffer compacts consumed space before growing', () => {
  const buffer = new BoundedByteBuffer(32, { initialCapacity: 16 })
  buffer.append(Uint8Array.from({ length: 12 }, (_, index) => index))
  buffer.consume(8)
  buffer.append(Uint8Array.from({ length: 8 }, (_, index) => index + 12))

  assert.equal(buffer.capacity, 16)
  assert.equal(buffer.length, 12)
  assert.deepEqual([...buffer.view()], [...Array.from({ length: 12 }, (_, index) => index + 8)])
})

test('bounded byte buffer rejects overflow and invalid ranges', () => {
  assert.throws(() => new BoundedByteBuffer(0), TypeError)
  assert.throws(() => new BoundedByteBuffer(8, { initialCapacity: 0 }), TypeError)

  const buffer = new BoundedByteBuffer(4, { initialCapacity: 2 })
  buffer.append(Uint8Array.of(1, 2, 3, 4))
  assert.throws(() => buffer.append(Uint8Array.of(5)), RangeError)
  assert.throws(() => buffer.consume(5), RangeError)
  assert.deepEqual([...buffer.view()], [1, 2, 3, 4])
})
