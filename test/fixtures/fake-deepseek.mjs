import { createServer } from 'node:http'

const HOST = '127.0.0.1'
const PORT = 8001
const SSE_EVENTS = [
  '{"choices":[{"delta":{"role":"assistant","content":null,"reasoning_content":""}}]}',
  '{"choices":[{"delta":{"content":"hello"}}]}',
  '{"choices":[{"delta":{"content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1}}',
  '[DONE]',
]

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function drainRequest(req) {
  return new Promise((resolve, reject) => {
    req.on('error', reject)
    req.on('data', () => {})
    req.on('end', resolve)
  })
}

async function sendCompletion(req, res) {
  await drainRequest(req)
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-store',
    connection: 'close',
  })
  for (const event of SSE_EVENTS) res.write(`data: ${event}\n\n`)
  res.end()
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { status: 'ready' })
    return
  }
  if (req.method === 'POST') {
    void sendCompletion(req, res).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { error: 'fake-provider-failure' })
      else res.destroy()
    })
    return
  }
  res.writeHead(405, { allow: 'GET, POST', 'cache-control': 'no-store' })
  res.end()
})

server.listen(PORT, HOST)

function shutdown() {
  server.close((error) => {
    if (error) {
      console.error(error)
      process.exitCode = 1
    }
  })
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
