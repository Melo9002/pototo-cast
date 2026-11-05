import { useEffect, useRef, useState } from 'react'
import { SignalingClient, type SignalMessage } from './signaling'
import { ScreenPeer } from './webrtc'

const signalingUrl = import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:8787'
const existingRoomId = new URLSearchParams(window.location.search).get('room')

function newRoomId() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 10)
}

export default function App() {
  const [roomId, setRoomId] = useState(existingRoomId ?? '')
  const [status, setStatus] = useState('Create a room or open a shared link.')
  const [isSharing, setIsSharing] = useState(false)
  const [hasRemoteStream, setHasRemoteStream] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const signaling = useRef<SignalingClient>()
  const peer = useRef<ScreenPeer>()
  const screen = useRef<MediaStream>()
  const connectedRoom = useRef<string>()
  const peerPresent = useRef(false)

  const roomUrl = roomId ? `${window.location.origin}${window.location.pathname}?room=${roomId}` : ''

  const cleanup = () => {
    screen.current?.getTracks().forEach((track) => track.stop())
    peer.current?.close()
    signaling.current?.close()
    screen.current = undefined
    peer.current = undefined
    signaling.current = undefined
    connectedRoom.current = undefined
    peerPresent.current = false
    setIsSharing(false)
  }

  useEffect(() => () => cleanup(), [])

  const ensureConnected = async (id: string) => {
    if (connectedRoom.current === id) return
    cleanup()
    const client = new SignalingClient()
    const connection = new ScreenPeer((stream) => {
      if (video.current) video.current.srcObject = stream
      setHasRemoteStream(true)
      setStatus('Watching the shared screen.')
    })
    signaling.current = client
    peer.current = connection
    connectedRoom.current = id
    connection.connection.onicecandidate = ({ candidate }) => {
      if (candidate) client.send({ type: 'ice-candidate', candidate: candidate.toJSON() })
    }
    connection.connection.onconnectionstatechange = () => {
      const state = connection.connection.connectionState
      if (state === 'connected') setStatus(isSharing ? 'Your screen is live.' : 'Watching the shared screen.')
      if (state === 'failed') setStatus('Connection failed. A TURN server may be needed on this network.')
    }
    await client.connect(signalingUrl, id, (message) => void handleSignal(message))
    setStatus('Room ready. Waiting for the other person…')
  }

  const handleSignal = async (message: SignalMessage) => {
    const connection = peer.current
    if (!connection) return
    if (message.type === 'peer-ready') {
      peerPresent.current = true
      if (screen.current) {
        const sdp = await connection.createOffer()
        signaling.current?.send({ type: 'offer', sdp })
      }
    }
    if (message.type === 'offer') {
      const sdp = await connection.acceptOffer(message.sdp)
      signaling.current?.send({ type: 'answer', sdp })
    }
    if (message.type === 'answer') await connection.acceptAnswer(message.sdp)
    if (message.type === 'ice-candidate') await connection.addIceCandidate(message.candidate)
    if (message.type === 'peer-left') setStatus('The other person left the room.')
    if (message.type === 'room-full' || message.type === 'error') setStatus(message.type === 'error' ? message.message : 'This room already has two people.')
  }

  const createRoom = () => {
    const id = newRoomId()
    window.history.replaceState({}, '', `?room=${id}`)
    setRoomId(id)
    void ensureConnected(id)
  }

  const startSharing = async () => {
    const id = roomId || newRoomId()
    if (!roomId) {
      window.history.replaceState({}, '', `?room=${id}`)
      setRoomId(id)
    }
    try {
      await ensureConnected(id)
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      screen.current = stream
      peer.current?.addScreen(stream)
      if (peerPresent.current) {
        const sdp = await peer.current!.createOffer()
        signaling.current?.send({ type: 'offer', sdp })
      }
      stream.getVideoTracks()[0].onended = () => { cleanup(); setStatus('Screen sharing stopped.') }
      setIsSharing(true)
      setStatus('Screen selected. Send the link and wait for your friend to join.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not start screen sharing.')
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(roomUrl)
    setStatus('Invite link copied.')
  }

  return <main>
    <section className="card">
      <div className="brand"><span>🥔</span><h1>PototoCast</h1></div>
      <p className="tagline">A tiny screen-sharing room for you and a friend.</p>
      {!roomId && <button className="primary" onClick={createRoom}>Create a room</button>}
      {roomId && <div className="room">
        <label>Room <code>{roomId}</code></label>
        <button onClick={copyLink}>Copy invite link</button>
        {!isSharing && <button className="primary" onClick={() => void startSharing()}>Share your screen</button>}
        {isSharing && <button className="danger" onClick={cleanup}>Stop sharing</button>}
      </div>}
      <p className="status" aria-live="polite">{status}</p>
    </section>
    <section className="viewer">
      {hasRemoteStream ? <video ref={video} autoPlay playsInline controls /> : <div className="placeholder">Your friend’s screen will appear here.</div>}
    </section>
    <footer>Video stays between browsers when possible. Use Discord for voice.</footer>
  </main>
}
