# 🥔 pototo-cast

> A lightweight, browser-based peer-to-peer screen-sharing app for sharing gameplay with friends — no accounts, no Discord video stream required.

Made because Discord screen sharing was blocked in Brazil. 😤

**PototoCast** is the tiny companion to your voice chat: keep talking on Discord, then use a private link to show your game, screen, tab, or application directly in your friend’s browser.

## What it does

1. Create a temporary room.
2. Copy the room link and send it to a friend.
3. Choose what to share using your browser’s normal screen picker.
4. Your friend opens the link and watches — that’s it. ✨

There are no accounts, profiles, databases, or video archives.

## How it works

```text
GitHub Pages (the website) ── WebSocket ── signaling server
          │                                      │
          └──── WebRTC screen video, browser ↔ browser ────┘
```

The signaling server only helps both browsers find and connect to each other. When a direct connection works, the screen video travels between browsers instead of through PototoCast’s server.

## Run it locally

You need [Node.js](https://nodejs.org/) 22+ with npm.

```powershell
git clone https://github.com/Melo9002/pototo-cast.git
cd pototo-cast
npm install
npm run dev
```

Open the Vite address printed in the terminal—usually `http://localhost:5173`.

For a friend on the same Wi-Fi network, point the client at your computer rather than `localhost`:

```powershell
$env:VITE_SIGNALING_URL="ws://YOUR-LAN-IP:8787"
npm run dev --workspace client
```

## Putting it online

The frontend can live on GitHub Pages; the signaling server needs its own Node-compatible host.

1. Deploy the `server/` folder to a host that supports Node and WebSockets.
2. Give it a public secure address, for example `wss://signal.example.com`.
3. In GitHub, add an Actions variable named `VITE_SIGNALING_URL` with that `wss://` address.
4. In repository settings, enable **Pages → GitHub Actions**. Pushing to `main` builds and deploys the frontend automatically.

The included workflow assumes the GitHub repository is named `pototo-cast`.

> **Easy mode for friends:** once the GitHub Pages deployment has finished, send them your Pages address (normally `https://melo9002.github.io/pototo-cast/`). They never need Node, npm, or a download—only a modern browser. You still need to configure the signaling address first, otherwise the website cannot connect people into a room.

## A tiny but important networking note

- Production needs HTTPS for browser screen capture—GitHub Pages provides it.
- The signal server must use **`wss://`** in production, not `ws://`.
- PototoCast includes a STUN server to help most home connections meet each other.
- Some office, mobile, university, or restrictive networks cannot make a direct WebRTC connection. For reliable sharing everywhere, add a TURN server (for example, self-hosted coturn) to `client/src/webrtc.ts`. TURN relays video only when necessary, so it needs bandwidth.
- A room currently supports one sharer and one viewer. Cozy by design. 🛋️

## Browser notes

Your browser controls the sharing permission and which screen/window/tab may be selected. Audio availability varies by browser and operating system; PototoCast is focused on the video side, so Discord remains perfect for voice.

## Stack

- React + Vite + TypeScript
- WebRTC for browser-to-browser video
- WebSocket (`ws`) for signaling
- GitHub Pages for the static frontend

---

Made with potatoes, friendship, and a minor grudge against blocked screen sharing. 🥔
