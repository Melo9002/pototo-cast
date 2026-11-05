export type SignalMessage =
  | { type: 'join'; roomId: string }
  | { type: 'joined' }
  | { type: 'peer-ready' }
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit }
  | { type: 'peer-left' }
  | { type: 'room-full' }
  | { type: 'error'; message: string }

export class SignalingClient {
  private socket?: WebSocket

  connect(url: string, roomId: string, onMessage: (message: SignalMessage) => void, onDisconnect: () => void) {
    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url)
      this.socket = socket
      let joined = false
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'join', roomId }))
      }
      socket.onmessage = (event) => {
        let message: SignalMessage
        try { message = JSON.parse(event.data) as SignalMessage } catch { return }
        if (message.type === 'joined') { joined = true; resolve(); return }
        if (!joined && (message.type === 'room-full' || message.type === 'error')) {
          reject(new Error(message.type === 'room-full' ? 'This room already has two people.' : message.message))
          socket.close()
          return
        }
        onMessage(message)
      }
      socket.onerror = () => reject(new Error('Could not reach the signaling server.'))
      socket.onclose = () => {
        if (this.socket !== socket) return
        this.socket = undefined
        if (joined) onDisconnect()
        else reject(new Error('Could not join the room.'))
      }
    })
  }

  send(message: SignalMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }

  close() { const socket = this.socket; this.socket = undefined; socket?.close() }
}
