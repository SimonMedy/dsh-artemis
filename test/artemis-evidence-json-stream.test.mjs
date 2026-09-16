import assert from 'node:assert/strict'
import test from 'node:test'
import { ArtemisHttpClient, ArtemisProtocolError } from '../src/host/artemis-http.mjs'
import { getTaskStatus } from '../src/host/artemis-evidence.mjs'

function headers(contentLength = null) {
  return {
    get(name) {
      const normalized = name.toLowerCase()
      if (normalized === 'content-type') return 'application/json'
      if (normalized === 'content-length') return contentLength
      return null
    },
  }
}

function responseWithReader(reader, contentLength = null) {
  return {
    ok: true,
    status: 200,
    headers: headers(contentLength),
    body: { getReader: () => reader },
  }
}

function evidenceClient(reader, { maxJsonBytes = 1_048_576 } = {}) {
  return new ArtemisHttpClient({
    baseUrl: 'http://127.0.0.1:8000',
    maxJsonBytes,
    fetchImpl: async () => responseWithReader(reader),
  })
}

test('evidence fallback ignores timer delays that Node would overflow', async () => {
  let observedSignal
  let reads = 0
  const payload = new TextEncoder().encode(JSON.stringify({ status: 'idle' }))
  const client = {
    baseUrl: new URL('http://127.0.0.1:8000'),
    maxJsonBytes: 1_048_576,
    timeoutMs: 2_147_483_648,
    fetchImpl: async (_url, options) => {
      observedSignal = options.signal
      await new Promise((resolve) => setTimeout(resolve, 10))
      assert.equal(observedSignal.aborted, false)
      return responseWithReader({
        async read() {
          reads += 1
          return reads === 1 ? { done: false, value: payload } : { done: true }
        },
        releaseLock() {},
      }, String(payload.byteLength))
    },
  }

  const status = await getTaskStatus(client)
  assert.equal(status.status, 'idle')
  assert.equal(observedSignal.aborted, false)
})

test('evidence fallback ignores unsafe custom JSON byte limits', async () => {
  let cancelled = false
  let readerAcquired = false
  const client = {
    baseUrl: new URL('http://127.0.0.1:8000'),
    maxJsonBytes: Number.MAX_SAFE_INTEGER + 1,
    timeoutMs: 2_000,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: headers(String(1_048_577)),
      body: {
        getReader() {
          readerAcquired = true
          throw new Error('reader should not be acquired')
        },
        cancel() { cancelled = true },
      },
    }),
  }

  await assert.rejects(
    getTaskStatus(client),
    (error) => error instanceof ArtemisProtocolError && error.code === 'response-too-large',
  )
  assert.equal(cancelled, true)
  assert.equal(readerAcquired, false)
})

test('evidence JSON reader rejects non-byte stream chunks before size accounting', async () => {
  let released = false
  const reader = {
    reads: 0,
    async read() {
      this.reads += 1
      return this.reads === 1 ? { done: false, value: 'not-bytes' } : { done: true }
    },
    releaseLock() { released = true },
  }
  await assert.rejects(
    getTaskStatus(evidenceClient(reader)),
    (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-json',
  )
  assert.equal(released, true)
})

test('evidence JSON reader preserves response-too-large when cancellation fails', async () => {
  let cancelled = false
  let released = false
  const reader = {
    async read() { return { done: false, value: Uint8Array.from([1, 2, 3, 4, 5]) } },
    async cancel() {
      cancelled = true
      throw new Error('cancel failed')
    },
    releaseLock() { released = true },
  }
  await assert.rejects(
    getTaskStatus(evidenceClient(reader, { maxJsonBytes: 4 })),
    (error) => error instanceof ArtemisProtocolError && error.code === 'response-too-large',
  )
  assert.equal(cancelled, true)
  assert.equal(released, true)
})

test('evidence JSON reader rejects invalid UTF-8 before JSON parsing', async () => {
  const invalidUtf8Json = Uint8Array.from([0x7b, 0x22, 0x73, 0x74, 0x61, 0x74, 0x75, 0x73, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d])
  const reader = {
    reads: 0,
    async read() {
      this.reads += 1
      return this.reads === 1
        ? { done: false, value: invalidUtf8Json }
        : { done: true, value: undefined }
    },
    releaseLock() {},
  }
  await assert.rejects(
    getTaskStatus(evidenceClient(reader)),
    (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-json',
  )
})

test('evidence JSON reader preserves response-too-large when cancel throws synchronously', async () => {
  let cancelled = false
  let released = false
  const reader = {
    async read() { return { done: false, value: Uint8Array.from([1, 2, 3, 4, 5]) } },
    cancel() {
      cancelled = true
      throw new Error('cancel failed synchronously')
    },
    releaseLock() { released = true },
  }
  await assert.rejects(
    getTaskStatus(evidenceClient(reader, { maxJsonBytes: 4 })),
    (error) => error instanceof ArtemisProtocolError && error.code === 'response-too-large',
  )
  assert.equal(cancelled, true)
  assert.equal(released, true)
})


function responseWithBody({ ok = true, status = 200, contentType = 'application/json', contentLength = null, cancel }) {
  return {
    ok,
    status,
    headers: {
      get(name) {
        const normalized = name.toLowerCase()
        if (normalized === 'content-type') return contentType
        if (normalized === 'content-length') return contentLength
        return null
      },
    },
    body: { cancel },
  }
}

function evidenceClientWithResponse(response, { maxJsonBytes = 1_048_576 } = {}) {
  return new ArtemisHttpClient({
    baseUrl: 'http://127.0.0.1:8000',
    maxJsonBytes,
    fetchImpl: async () => response,
  })
}

test('evidence HTTP errors cancel response bodies without masking the protocol error', async () => {
  let cancelled = false
  const response = responseWithBody({
    ok: false,
    status: 503,
    cancel() {
      cancelled = true
      throw new Error('cancel failed')
    },
  })

  await assert.rejects(
    getTaskStatus(evidenceClientWithResponse(response)),
    (error) => error instanceof ArtemisProtocolError && error.code === 'http-error',
  )
  assert.equal(cancelled, true)
})

test('evidence metadata rejection cancels the response body before reader acquisition', async () => {
  let wrongTypeCancelled = false
  const wrongType = responseWithBody({
    contentType: 'text/plain',
    cancel() { wrongTypeCancelled = true },
  })
  await assert.rejects(
    getTaskStatus(evidenceClientWithResponse(wrongType)),
    (error) => error instanceof ArtemisProtocolError && error.code === 'unexpected-content-type',
  )
  assert.equal(wrongTypeCancelled, true)

  let oversizedCancelled = false
  const oversized = responseWithBody({
    contentLength: '5',
    cancel() {
      oversizedCancelled = true
      return Promise.reject(new Error('cancel failed'))
    },
  })
  await assert.rejects(
    getTaskStatus(evidenceClientWithResponse(oversized, { maxJsonBytes: 4 })),
    (error) => error instanceof ArtemisProtocolError && error.code === 'response-too-large',
  )
  assert.equal(oversizedCancelled, true)
})


test('evidence JSON reader acquisition failure cancels the unread body and preserves the original error', async () => {
  const readerFailure = new Error('reader acquisition failed')
  let cancelled = false
  const response = {
    ok: true,
    status: 200,
    headers: headers(),
    body: {
      getReader() { throw readerFailure },
      cancel() {
        cancelled = true
        throw new Error('cancel failed')
      },
    },
  }

  await assert.rejects(
    getTaskStatus(evidenceClientWithResponse(response)),
    (error) => error === readerFailure,
  )
  assert.equal(cancelled, true)
})


test('evidence JSON read failure cancels the reader and preserves the original error', async () => {
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
    getTaskStatus(evidenceClient(reader)),
    (error) => error === readFailure,
  )
  assert.equal(cancelled, true)
  assert.equal(released, true)
})
