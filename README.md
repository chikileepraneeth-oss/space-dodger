# SPACE DODGER

**▶ Play: https://space-dodger-b8lc.onrender.com/**

A 3D low-poly space shooter where your **iPhone is the controller**. The game runs in your computer's browser. Scan a QR code with your phone, then tilt it left and right to fly your ship through meteor storms, enemy fleets and boss fights.

## Gameplay

- **Steer by tilting:** tilt the phone left or right like a steering wheel. Hold it level to stay centered.
- **Fight:** hold **Fire** for a stream of lasers. Tap **Special** to launch a Nova torpedo that wipes out everything near the blast.
- **Survive:** you have 3 lives. Meteors, enemy ships and their shots all cost a life. After a hit you're safe for a moment.
- **Endless waves:** every 30 seconds the wave goes up, with faster meteors, more enemies and tougher ships.
- **Bosses:** every 5th wave a huge boss ship arrives. The waves pause until you destroy it.
- **Enemies:**
  - **Fighter:** fast, dives straight at you.
  - **Heavy:** armored, fires three-way spreads.
  - **Elite:** chases your position and fires in bursts.
- **Power-ups:** shoot ships and big meteors to drop crystals.
  - 🔵 Shield
  - 🟡 Rapid fire
  - 🟢 Double laser
  - 🩷 Repair (extra life)
  - 🟠 Nova charge
- **Score:** earn points for kills, meteors, power-ups and survival time. Your best score is saved.

## How to play

1. Open the game link on a computer and click **Connect controller**.
2. Scan the QR code with your iPhone camera.
3. Tap **Start Controller**, then **Allow** motion access.
4. Hold the phone sideways and level, then tap **Set Neutral**.
5. Press **Fire** to launch.

## Tech

- **Three.js** for the 3D graphics. Every ship, meteor and effect is built in code, with no downloaded models.
- **HTML, CSS and plain JavaScript** (ES modules) for the game and the phone controller page.
- **Device Orientation API** to read the iPhone's tilt, with calibration, a dead zone and smoothing.
- **Node.js, Express and WebSockets (`ws`)** to link the phone to the game in real time, using secure per-session pairing tokens.
- **QR codes** (`qrcode`) for one-scan pairing.
- **Web Audio API** for the sound effects and music, all generated in code.
- **Vite** for building, and **Render** for hosting.
