# PototoCast

A deliberately small, browser-to-browser screen-sharing prototype for two people. It has no accounts, database, voice chat, or media server: use Discord for voice and PototoCast for the picture.

## Architecture

```
GitHub Pages (React UI) ── WebSocket ── signaling server
        │                                      │
        └────────── WebRTC screen media ───────┘
                   (direct between browsers)
```

The signaling server only relays WebRTC setup messages (offer, answer, and ICE candidates). It does not receive or store screen video. A room permits two currently connected browsers and disappears when empty.

## Run locally

Prerequisite: Node.js 22+ including npm.

```bash
npm install
npm run dev
```

This starts the Vite client (normally `http://localhost:5173`) and the signaling server at `ws://localhost:8787`. Open the client, create a room, copy its link, then open it in a second browser/device. The host selects **Share your screen** after the second participant joins.

For testing on another device on your LAN, configure the client with your computer's LAN address rather than `localhost`:

```bash
VITE_SIGNALING_URL=ws://YOUR-LAN-IP:8787 npm run dev --workspace client
```

## Deploy the frontend to GitHub Pages

1. Create a GitHub repository named `PototoCast`, commit this project, and push its `main` branch.
2. Host `server/` separately on any Node-capable host with a public WebSocket endpoint (for example, a small VM or platform service). Set `PORT` as required by that host.
3. In the GitHub repository, add an Actions variable named `VITE_SIGNALING_URL`, set to the public **`wss://`** signaling endpoint.
4. Enable GitHub Pages using **GitHub Actions** as the source. The included workflow builds and deploys `client/dist` on each push to `main`.

The Vite base path in `client/vite.config.ts` expects a project Pages URL (`https://OWNER.github.io/PototoCast/`). Change `PototoCast` there if your repository has another name, or use `/` for a custom domain.

## STUN, TURN, and browser/network limits

- Screen capture requires a user gesture and browser permission. The browser decides which screen, window, or tab can be shared. Some browsers/platforms do not include system audio; games may also need to be shared as a full screen or compatible window.
- WebRTC needs HTTPS in production; GitHub Pages supplies it. The signaling connection must also be secure (`wss://`) to avoid mixed-content blocking.
- The client includes a public Google STUN server, which helps peers discover their public network addresses. STUN alone cannot traverse every NAT, corporate firewall, carrier-grade NAT, or restrictive Wi-Fi network.
- For reliable real-world use, configure a TURN server (such as self-hosted coturn) and add its URL, username, and credential to the `iceServers` list in `client/src/webrtc.ts`. TURN relays media only when direct peer-to-peer paths fail, so it needs sufficient bandwidth and should use expiring credentials in production.
- This milestone supports one broadcaster and one viewer. Joining a third browser returns “room full.”

## Next sensible increments

- Add runtime TURN configuration (not hard-coded browser secrets).
- Add reconnect/error UI and a basic host/viewer indicator.
- Add bitrate/framerate controls and a small room-expiry policy.
