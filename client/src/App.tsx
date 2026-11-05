import { useEffect, useRef, useState } from 'react'
import { SignalingClient, type SignalMessage } from './signaling'
import { ScreenPeer } from './webrtc'
import mascot from './pototo-mascot.png'

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
  const connectionAttempt = useRef<Promise<void>>()
  const peerPresent = useRef(false)
  const pendingIce = useRef<RTCIceCandidateInit[]>([])

  const roomUrl = roomId ? `${window.location.origin}${window.location.pathname}?room=${roomId}` : ''

  const cleanup = () => {
    screen.current?.getTracks().forEach((track) => track.stop())
    peer.current?.close()
    signaling.current?.close()
    screen.current = undefined
    peer.current = undefined
    signaling.current = undefined
    connectedRoom.current = undefined
    connectionAttempt.current = undefined
    peerPresent.current = false
    pendingIce.current = []
    setIsSharing(false)
    setHasRemoteStream(false)
    if (video.current) video.current.srcObject = null
  }

  useEffect(() => {
    if (existingRoomId) void ensureConnected(existingRoomId).catch(() => setStatus('Could not reach the signaling server.'))
    return () => cleanup()
  }, [])

  const ensureConnected = async (id: string) => {
    if (connectedRoom.current === id) return connectionAttempt.current
    cleanup()
    const client = new SignalingClient()
    const connection = new ScreenPeer((stream) => {
      setHasRemoteStream(true)
      if (video.current) video.current.srcObject = stream
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
    try {
      const attempt = client.connect(signalingUrl, id, (message) => {
        void handleSignal(message).catch(() => setStatus('The connection failed. Refresh the page and try again.'))
      }, () => {
        if (signaling.current === client) { cleanup(); setStatus('Disconnected. Refresh the page to reconnect.') }
      })
      connectionAttempt.current = attempt
      await attempt
    } catch (error) {
      if (signaling.current === client) cleanup()
      throw error
    }
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
      for (const candidate of pendingIce.current.splice(0)) await connection.addIceCandidate(candidate)
      signaling.current?.send({ type: 'answer', sdp })
    }
    if (message.type === 'answer') {
      await connection.acceptAnswer(message.sdp)
      for (const candidate of pendingIce.current.splice(0)) await connection.addIceCandidate(candidate)
    }
    if (message.type === 'ice-candidate') {
      if (connection.connection.remoteDescription) await connection.addIceCandidate(message.candidate)
      else pendingIce.current.push(message.candidate)
    }
    if (message.type === 'peer-left') { peerPresent.current = false; setStatus('The other person left. Refresh the room before inviting them again.') }
    if (message.type === 'room-full' || message.type === 'error') setStatus(message.type === 'error' ? message.message : 'This room already has two people.')
  }

  const createRoom = () => {
    const id = newRoomId()
    window.history.replaceState({}, '', `?room=${id}`)
    setRoomId(id)
    void ensureConnected(id).catch(() => setStatus('Could not reach the signaling server.'))
  }

  const startSharing = async () => {
    const id = roomId || newRoomId()
    if (!roomId) {
      window.history.replaceState({}, '', `?room=${id}`)
      setRoomId(id)
    }
    let capture: MediaStream | undefined
    try {
      const connecting = ensureConnected(id)
      void connecting.catch(() => {})
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      capture = stream
      await connecting
      peer.current?.addScreen(stream)
      screen.current = stream
      if (peerPresent.current) {
        const sdp = await peer.current!.createOffer()
        signaling.current?.send({ type: 'offer', sdp })
      }
      stream.getVideoTracks()[0].onended = () => { cleanup(); setStatus('Screen sharing stopped.') }
      setIsSharing(true)
      setStatus('Screen selected. Send the link and wait for your friend to join.')
    } catch (error) {
      capture?.getTracks().forEach((track) => track.stop())
      screen.current = undefined
      setStatus(error instanceof Error ? error.message : 'Could not start screen sharing.')
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(roomUrl)
    setStatus('Invite link copied.')
  }

  return <main>
    <header className="topbar"><a className="logo" href={window.location.pathname}><span>🥔</span> pototo<span>cast</span></a><span className="top-note">made for little hangouts <span>✦</span></span></header>
    <div className="layout"><section className="card">
      <p className="eyebrow"><span>✦</span> YOUR COZY CORNER OF THE INTERNET</p>
      <h1>Good games.<br /><em>Better company.</em></h1>
      <p className="tagline">Share your screen, bring a friend, and make yourself at home. No accounts, no fuss. <span>♡</span></p>
      {!roomId && <button className="primary" onClick={createRoom}>Create a room</button>}
      {roomId && <div className="room">
        <label>Your room <code>{roomId}</code></label>
        <button onClick={copyLink}>Copy invite link</button>
        {!isSharing && <button className="primary" onClick={() => void startSharing()}>Share your screen</button>}
        {isSharing && <button className="danger" onClick={() => { cleanup(); setStatus('Screen sharing stopped. Refresh the room to share again.') }}>Stop sharing</button>}
      </div>}
      <p className="status" aria-live="polite"><span className="status-dot" />{status}</p>
      <div className="steps"><span><b>01</b> Make a room</span><span><b>02</b> Invite a friend</span><span><b>03</b> Hit play!</span></div>
    </section>
    <section className="screen-card" aria-label="Stream viewer"><div className="screen-top"><span><i /> <i /> <i /></span><span>THE HANGOUT</span><span>✧</span></div><div className="viewer">
      <video ref={video} autoPlay playsInline controls hidden={!hasRemoteStream} />
      {!hasRemoteStream && <div className="placeholder"><img className="mascot" src={mascot} alt="A smiling, white-haired Lalafell in a blue cap" /><strong>The best seat in the house</strong><p>Your friend’s screen will appear here.<br />Grab a snack while you wait!</p><span className="waiting">✧ &nbsp; WAITING FOR THE MAGIC &nbsp; ✧</span></div>}
    </div><div className="screen-bottom"><span>♡ &nbsp; better together</span><span>pototo-powered ✦</span></div></section></div>
    <footer><span>Made with potatoes &amp; friendship 🥔</span><span>Keep Discord for voice · Share the fun here</span></footer>
  </main>
}
