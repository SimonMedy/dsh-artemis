export class BoundedByteBuffer {
  #storage
  #start = 0
  #length = 0
  #maxBytes

  constructor(maxBytes, { initialCapacity = 1024 } = {}) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
      throw new TypeError('maxBytes must be a positive safe integer')
    }
    if (!Number.isSafeInteger(initialCapacity) || initialCapacity <= 0) {
      throw new TypeError('initialCapacity must be a positive safe integer')
    }
    this.#maxBytes = maxBytes
    this.#storage = new Uint8Array(Math.min(maxBytes, initialCapacity))
  }

  get length() {
    return this.#length
  }

  get capacity() {
    return this.#storage.byteLength
  }

  view() {
    return this.#storage.subarray(this.#start, this.#start + this.#length)
  }

  append(chunk) {
    if (!(chunk instanceof Uint8Array)) throw new TypeError('chunk must be a Uint8Array')
    const required = this.#length + chunk.byteLength
    if (!Number.isSafeInteger(required) || required > this.#maxBytes) {
      throw new RangeError('bounded byte buffer exceeded its configured size limit')
    }
    if (chunk.byteLength === 0) return
    this.#ensureCapacity(required)
    this.#storage.set(chunk, this.#start + this.#length)
    this.#length = required
  }

  consume(count) {
    if (!Number.isSafeInteger(count) || count < 0 || count > this.#length) {
      throw new RangeError('consume count must be within the buffered byte range')
    }
    this.#start += count
    this.#length -= count
    if (this.#length === 0) this.#start = 0
  }

  #ensureCapacity(required) {
    const tailCapacity = this.#storage.byteLength - this.#start
    if (required <= tailCapacity) return
    if (required <= this.#storage.byteLength) {
      this.#storage.copyWithin(0, this.#start, this.#start + this.#length)
      this.#start = 0
      return
    }
    const nextCapacity = Math.min(
      this.#maxBytes,
      Math.max(required, this.#storage.byteLength * 2),
    )
    const next = new Uint8Array(nextCapacity)
    next.set(this.view())
    this.#storage = next
    this.#start = 0
  }
}
