# SPACE DODGER

Browser space shooter. The PC renders the game. An iPhone is the controller: tilt steers left and right, and the touchscreen fires.

The phone and the computer talk through a Node.js WebSocket server. iPhone motion sensors only work on **trusted HTTPS**, so this server generates a local certificate. `http://` and `localhost` on the phone will not steer the ship.

## Run

```powershell
npm install
npm run dev
```

Open the PC page printed in the terminal, usually `https://localhost:8443`. Accept the certificate warning.

## iPhone

1. Phone and PC must be on the same Wi-Fi.
2. On the iPhone, open the setup URL printed by the server (it looks like `https://192.168.x.x:8443/setup`).
3. Download the certificate and install the profile.
4. Settings → General → About → Certificate Trust Settings → enable full trust for **SPACE DODGER Local**.
5. Scan the QR code on the game screen.
6. Tap **Start Controller**, allow motion access, hold the phone level, tap **Set Neutral**.
7. Tilt left and right to steer. Press **Fire** on the phone (or click Play) to start.
   - **Fire** (hold): continuous lasers.
   - **Special**: Nova torpedo. It clears enemy fire everywhere and wrecks everything near the blast. You start with 2 charges (max 3). Orange crystals add one.
   - **Pause**: pause or resume.

## Gameplay

- 3 lives. A hit makes you invulnerable for a moment.
- Every 30 s the wave goes up: faster meteors, more enemies, tougher types (fighter → heavy → elite).
- Every 5th wave a boss arrives. The wave clock stops until you destroy it.
- Crystals: cyan shield, yellow rapid fire, green double laser, pink repair, orange Nova charge.
- Meteor rows always leave a lane open, and boss fans leave gaps you can fly through.
- If the phone disconnects, the game pauses and shows the QR code until the phone reconnects.
- **Reconnect controller** on the game-over screen makes a new QR code and retires the old phone.
- Best score is saved in the browser. Volume, mute, music and graphics quality are under Settings.

If the tilt feels backwards, tap **Invert** and calibrate again.

Safari will not lock landscape. The page asks you to rotate if you are in portrait.

## If the QR code cannot be opened

The code uses the PC's LAN address, never `localhost`. Override it if the guessed address is wrong:

```powershell
$env:HOST_IP="192.168.1.20"
npm run dev
```

For a trusted public HTTPS tunnel, point `PUBLIC_URL` at the tunnel origin and aim the tunnel at `https://127.0.0.1:8443` (or at HTTP only if you terminate TLS at the tunnel and also change the server). The page the phone opens must be the same origin the WebSocket uses.

To use your own certificate instead of the generated one:

```powershell
$env:CERT_FILE="C:\path\cert.pem"
$env:CERT_KEY="C:\path\key.pem"
npm run dev
```

## Debug keys

Add `?debug=1` to the PC URL to play with the keyboard while no phone is connected: A/D or the arrow keys steer, Space fires, E launches the Nova. Esc or P pauses at any time. Keyboard input is ignored after a controller connects.

## Checks

```powershell
npm test
```

## Production build

```powershell
npm run build
npm start
```

## Deploy online (Render)

One free **Render** web service hosts the game page, the controller page and the WebSocket relay. Render gives real HTTPS, so the iPhone needs no certificate, no Tailscale and no shared Wi-Fi.

1. Render dashboard → **New → Blueprint** → connect GitHub → pick this repo. Render reads `render.yaml`.
2. Click **Apply**. The first build takes 2–4 minutes.
3. Open the service URL, e.g. `https://space-dodger.onrender.com`. Check `/health` shows `{"ok":true}`.
4. PC: open the URL → Connect controller. iPhone (any network, Wi-Fi off is fine): scan the QR code.

Nothing else to configure: the server reads `RENDER_EXTERNAL_URL` for QR links and only accepts WebSockets from that address.

Free services sleep after 15 minutes idle; the first load then takes ~50 s. A redeploy drops sessions, so rescan the QR code.

### Optional: Netlify frontend + Render backend
Only needed if you want the pages on Netlify. Set `VITE_BACKEND_URL` (Render URL) in Netlify and `FRONTEND_URL` (Netlify URL) in Render. `netlify.toml` has the build settings.
