import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { WebSocket } from 'ws'
import { createServer } from 'node:net'

test('rooms relay signals only between two members', { timeout: 10000 }, async () => {
  const probe = createServer()
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise((resolve) => probe.close(resolve))
  const server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] })
  const clients = []
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server did not start')), 5000)
      server.stdout.once('data', () => { clearTimeout(timeout); resolve() })
      server.once('exit', () => { clearTimeout(timeout); reject(new Error('Server exited early')) })
    })
    const connect = async (roomId) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}`)
      clients.push(socket)
      const messages = []
      const waiting = []
      socket.on('message', (data) => { const message = JSON.parse(data.toString()); const next = waiting.shift(); next ? next(message) : messages.push(message) })
      await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
      socket.send(JSON.stringify({ type: 'join', roomId }))
      return { socket, next: () => messages.length ? Promise.resolve(messages.shift()) : new Promise((resolve) => waiting.push(resolve)) }
    }
    const a = await connect('room-a')
    assert.equal((await a.next()).type, 'joined')
    const b = await connect('room-a')
    assert.equal((await b.next()).type, 'joined')
    assert.equal((await a.next()).type, 'peer-ready')
    assert.equal((await b.next()).type, 'peer-ready')
    const c = await connect('room-a')
    assert.equal((await c.next()).type, 'room-full')
    a.socket.send(JSON.stringify({ type: 'offer', sdp: { type: 'offer', sdp: 'test' } }))
    assert.equal((await b.next()).sdp.sdp, 'test')
    b.socket.close()
    assert.equal((await a.next()).type, 'peer-left')
  } finally {
    clients.forEach((client) => client.terminate())
    server.kill()
  }
})
