const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

export class ScreenPeer {
  readonly connection: RTCPeerConnection

  constructor(onTrack: (stream: MediaStream) => void) {
    this.connection = new RTCPeerConnection({ iceServers })
    this.connection.ontrack = (event) => onTrack(event.streams[0])
  }

  addScreen(stream: MediaStream) {
    stream.getTracks().forEach((track) => this.connection.addTrack(track, stream))
  }

  async createOffer() {
    const offer = await this.connection.createOffer()
    await this.connection.setLocalDescription(offer)
    return offer
  }

  async acceptOffer(offer: RTCSessionDescriptionInit) {
    await this.connection.setRemoteDescription(offer)
    const answer = await this.connection.createAnswer()
    await this.connection.setLocalDescription(answer)
    return answer
  }

  async acceptAnswer(answer: RTCSessionDescriptionInit) {
    await this.connection.setRemoteDescription(answer)
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    await this.connection.addIceCandidate(candidate)
  }

  close() { this.connection.close() }
}
