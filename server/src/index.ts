import { WebSocketServer, WebSocket } from 'ws'

type Client = WebSocket & { roomId?: string }
const port = Number(process.env.PORT ?? 8787)
const rooms = new Map<string, Set<Client>>()
const wss = new WebSocketServer({ port, maxPayload: 65536 })

function send(client: Client, message: unknown) {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message))
}

function leave(client: Client) {
  const roomId = client.roomId
  if (!roomId) return
  const room = rooms.get(roomId)
  room?.delete(client)
  room?.forEach((peer) => send(peer, { type: 'peer-left' }))
  if (room?.size === 0) rooms.delete(roomId)
  client.roomId = undefined
}

wss.on('connection', (client: Client) => {
  client.on('message', (raw) => {
    let message: { type?: string; roomId?: string }
    try { message = JSON.parse(raw.toString()) } catch { send(client, { type: 'error', message: 'Invalid message.' }); return }
    if (!message || typeof message !== 'object') { send(client, { type: 'error', message: 'Invalid message.' }); return }
    if (message.type === 'join') {
      const roomId = typeof message.roomId === 'string' ? message.roomId.trim() : ''
      if (!roomId || roomId.length > 64) { send(client, { type: 'error', message: 'Invalid room ID.' }); return }
      leave(client)
      const room = rooms.get(roomId) ?? new Set<Client>()
      if (room.size >= 2) { send(client, { type: 'room-full' }); return }
      rooms.set(roomId, room); room.add(client); client.roomId = roomId
      send(client, { type: 'joined' })
      if (room.size === 2) room.forEach((peer) => send(peer, { type: 'peer-ready' }))
      return
    }
    if (!['offer', 'answer', 'ice-candidate'].includes(message.type ?? '')) return
    const room = client.roomId && rooms.get(client.roomId)
    if (!room) { send(client, { type: 'error', message: 'Join a room first.' }); return }
    room.forEach((peer) => { if (peer !== client) send(peer, message) })
  })
  client.on('close', () => leave(client))
})

console.log(`PototoCast signaling server listening on ws://localhost:${port}`)
