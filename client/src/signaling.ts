export type SignalMessage =
  | { type: 'join'; roomId: string }
  | { type: 'peer-ready' }
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit }
  | { type: 'peer-left' }
  | { type: 'room-full' }
  | { type: 'error'; message: string }

export class SignalingClient {
  private socket?: WebSocket

  connect(url: string, roomId: string, onMessage: (message: SignalMessage) => void) {
    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url)
      this.socket = socket
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'join', roomId }))
        resolve()
      }
      socket.onmessage = (event) => onMessage(JSON.parse(event.data) as SignalMessage)
      socket.onerror = () => reject(new Error('Could not reach the signaling server.'))
      socket.onclose = () => { this.socket = undefined }
    })
  }

  send(message: SignalMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }

  close() { this.socket?.close() }
}
