import { GameSocket } from './network.js';
import { horizontalTiltDegrees, normalizeTilt, verticalTiltDegrees } from './sensors/tilt.js';

const SEND_HZ = 40;
const SPECIAL_COOLDOWN = 1.5; // the game also limits Nova charges

const portraitQuery = window.matchMedia('(orientation: portrait)');

function screenAngle() {
  // In portrait, CSS turns the pad 90° clockwise, so the player holds the phone as landscape-90 (top to the left).
  if (portraitQuery.matches) return 90;
  if (screen.orientation && Number.isFinite(screen.orientation.angle)) return screen.orientation.angle;
  if (Number.isFinite(Number(window.orientation))) return Number(window.orientation);
  return 0;
}

function buzz(ms) {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

export class ControllerApp {
  constructor(root) {
    this.root = root;
    this.params = new URLSearchParams(location.search);
    this.sessionId = this.params.get('session') || '';
    this.token = this.params.get('token') || '';
    this.sensitivity = Number(localStorage.getItem('space-dodger-sensitivity') || 1);
    this.invert = localStorage.getItem('space-dodger-invert') === '1';
    this.calibrated = false;
    this.invertY = localStorage.getItem('space-dodger-invert-y') === '1';
    this.neutral = 0;
    this.neutralY = 0;
    this.rawTilt = 0;
    this.rawPitch = 0;
    this.output = 0;
    this.outputY = 0;
    this.fire = false;
    this.paired = false;
    this.sensor = 'unknown';
    this.sawOrientation = false;
    this.lastSample = performance.now();
    this.specialReadyAt = 0;
    this.renderShell();
    this.bind();
    // A new neutral is needed if the layout flips between CSS-rotated and real landscape.
    portraitQuery.addEventListener?.('change', () => {
      if (this.calibrated) this.root.querySelector('.recal').click();
    });
  }

  renderShell() {
    this.root.innerHTML = `
      <section class="gate" data-screen="missing" hidden>
        <h1>SPACE DODGER</h1>
        <p>Scan the QR code on the game screen. This page needs a session link.</p>
      </section>
      <section class="gate" data-screen="start">
        <p class="eyebrow">Controller</p>
        <h1>SPACE DODGER</h1>
        <p>Hold the phone sideways with the camera on your left, then allow motion access.</p>
        <button type="button" class="start">Start Controller</button>
        <p class="sensor-note"></p>
      </section>
      <section class="gate" data-screen="calibrate" hidden>
        <p class="eyebrow">Calibration</p>
        <h1>Hold it level</h1>
        <p>Rest the phone in the neutral position you want to be center, then set it. Tilt left/right to steer, tip forward/back to fly up/down.</p>
        <button type="button" class="calibrate">Set Neutral</button>
      </section>
      <section class="pad" data-screen="play" hidden>
        <div class="motion">
          <div class="status-row">
            <span data-link>Offline</span>
            <span data-sensor>Sensor</span>
            <span data-cal>Calibrated</span>
          </div>
          <div class="meter" aria-hidden="true"><div class="meter-fill"></div><div class="meter-center"></div></div>
          <p class="readout">0.00</p>
          <div class="tools">
            <button type="button" class="recal">Recalibrate</button>
            <button type="button" class="invert">Invert</button>
            <button type="button" class="invert-y">Flip up/down</button>
            <label>Sensitivity <input class="sensitivity" type="range" min="0.5" max="2" step="0.1" /></label>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="pause">Pause</button>
          <button type="button" class="special">Special</button>
          <button type="button" class="fire">Fire</button>
        </div>
      </section>
    `;
    this.screens = {
      missing: this.root.querySelector('[data-screen="missing"]'),
      start: this.root.querySelector('[data-screen="start"]'),
      calibrate: this.root.querySelector('[data-screen="calibrate"]'),
      play: this.root.querySelector('[data-screen="play"]'),
    };
    this.note = this.root.querySelector('.sensor-note');
    this.meter = this.root.querySelector('.meter-fill');
    this.readout = this.root.querySelector('.readout');
    this.link = this.root.querySelector('[data-link]');
    this.sensorLabel = this.root.querySelector('[data-sensor]');
    this.calLabel = this.root.querySelector('[data-cal]');
    this.sensitivityInput = this.root.querySelector('.sensitivity');
    this.sensitivityInput.value = String(this.sensitivity);
    this.specialButton = this.root.querySelector('.special');
    if (!this.sessionId || !this.token) this.show('missing');
  }

  show(name) {
    for (const [key, el] of Object.entries(this.screens)) el.hidden = key !== name;
  }

  bind() {
    this.root.querySelector('.start').addEventListener('click', () => this.start());
    this.root.querySelector('.calibrate').addEventListener('click', () => this.calibrate());
    this.root.querySelector('.recal').addEventListener('click', () => {
      this.calibrated = false;
      this.show('calibrate');
    });
    this.root.querySelector('.invert-y').addEventListener('click', () => {
      this.invertY = !this.invertY;
      localStorage.setItem('space-dodger-invert-y', this.invertY ? '1' : '0');
      this.calibrated = false;
      this.show('calibrate');
    });
    this.root.querySelector('.invert').addEventListener('click', () => {
      this.invert = !this.invert;
      localStorage.setItem('space-dodger-invert', this.invert ? '1' : '0');
      this.calibrated = false;
      this.show('calibrate');
    });
    this.sensitivityInput.addEventListener('input', () => {
      this.sensitivity = Number(this.sensitivityInput.value);
      localStorage.setItem('space-dodger-sensitivity', String(this.sensitivity));
    });
    this.bindFire(this.root.querySelector('.fire'));
    this.specialButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.special();
    });
    this.root.querySelector('.pause').addEventListener('click', () => {
      buzz(8);
      this.socket?.send({ type: 'PAUSE' });
    });
    window.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  bindFire(button) {
    const release = () => this.setFire(false);
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      this.setFire(true);
      buzz(12);
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  async start() {
    const permission = await this.requestSensors();
    this.sensor = permission;
    this.note.textContent = permission === 'granted'
      ? 'Motion access granted.'
      : permission === 'denied'
        ? 'Motion permission was denied. Enable Motion & Orientation Access for Safari, then try again.'
        : 'This browser does not expose device orientation.';
    if (permission !== 'granted') return;
    try {
      // Fullscreen + lock work on Android and iPad; iPhone Safari refuses both, and the CSS rotation covers it.
      const el = document.documentElement;
      await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      await screen.orientation?.lock?.('landscape');
    } catch {
      /* iOS Safari does not allow programmatic orientation lock. */
    }
    window.addEventListener('deviceorientation', this.onOrientation);
    this.connect();
    this.show(this.calibrated ? 'play' : 'calibrate');
  }

  async requestSensors() {
    const Orientation = window.DeviceOrientationEvent;
    if (!Orientation) return 'unsupported';
    if (typeof Orientation.requestPermission === 'function') {
      try {
        const result = await Orientation.requestPermission();
        if (result !== 'granted') return 'denied';
      } catch {
        return 'denied';
      }
    }
    if (typeof DeviceMotionEvent?.requestPermission === 'function') {
      try {
        await DeviceMotionEvent.requestPermission();
      } catch {
        /* Orientation permission is the one steering uses. */
      }
    }
    return 'granted';
  }

  connect() {
    this.socket = new GameSocket({
      onOpen: () => {
        this.socket.send({ type: 'PAIR', sessionId: this.sessionId, token: this.token });
      },
      onMessage: (message) => {
        if (message.type === 'PAIRED') {
          this.paired = true;
          this.link.textContent = 'Linked';
          this.startSending();
        }
        if (message.type === 'ERROR') {
          this.paired = false;
          this.stopSending();
          const labels = { CONTROLLER_TAKEN: 'Already paired', SESSION_ENDED: 'Session ended: scan the new QR code' };
          this.link.textContent = labels[message.code] || 'Pairing failed';
          if (message.code === 'SESSION_ENDED') this.socket.close();
        }
      },
      onClose: () => {
        this.paired = false;
        this.stopSending();
        if (!this.socket.stopped) this.link.textContent = 'Reconnecting';
      },
    });
    this.socket.connect();
  }

  onOrientation = (event) => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastSample) / 1000 || 0.016);
    this.lastSample = now;
    this.sawOrientation = true;
    const tilt = horizontalTiltDegrees(event, screenAngle());
    this.rawTilt = this.invert ? -tilt : tilt;
    const pitch = verticalTiltDegrees(event, screenAngle());
    this.rawPitch = this.invertY ? -pitch : pitch;
    const sample = this.calibrated ? normalizeTilt(this.rawTilt, this.neutral, this.sensitivity) : 0;
    const sampleY = this.calibrated ? normalizeTilt(this.rawPitch, this.neutralY, this.sensitivity) : 0;
    const blend = 1 - Math.exp(-14 * dt);
    this.output += (sample - this.output) * blend;
    this.outputY += (sampleY - this.outputY) * blend;
    this.paintMeter();
  };

  calibrate() {
    if (!this.sawOrientation) return;
    this.neutral = this.rawTilt;
    this.neutralY = this.rawPitch;
    this.calibrated = true;
    this.output = 0;
    this.outputY = 0;
    this.show('play');
    this.paintMeter();
  }

  paintMeter() {
    if (!this.meter) return;
    const shown = this.calibrated ? this.output : 0;
    this.meter.style.transform = `translateX(${shown * 42}%)`;
    const shownY = this.calibrated ? this.outputY : 0;
    this.readout.textContent = `↔ ${shown.toFixed(2)}   ↕ ${shownY.toFixed(2)}`;
    this.sensorLabel.textContent = this.sawOrientation ? 'Sensor live' : 'No sensor data';
    this.calLabel.textContent = this.calibrated ? 'Calibrated' : 'Not calibrated';
    const remain = this.specialReadyAt - performance.now();
    this.specialButton.disabled = remain > 0;
    this.specialButton.textContent = remain > 0 ? `Special ${Math.ceil(remain / 1000)}` : 'Special';
  }

  startSending() {
    this.stopSending();
    this.sendTimer = setInterval(() => {
      if (!this.paired || !this.calibrated) return;
      const round = (v) => Math.round(v * 1000) / 1000;
      this.socket.send({ type: 'MOVE', x: round(this.output), y: round(this.outputY) });
      this.paintMeter();
    }, 1000 / SEND_HZ);
  }

  stopSending() {
    clearInterval(this.sendTimer);
  }

  setFire(pressed) {
    if (this.fire === pressed) return;
    this.fire = pressed;
    if (this.paired) this.socket.send({ type: 'FIRE', pressed });
  }

  special() {
    const now = performance.now();
    if (now < this.specialReadyAt || !this.paired) return;
    this.specialReadyAt = now + SPECIAL_COOLDOWN * 1000;
    this.socket.send({ type: 'SPECIAL' });
    buzz(20);
    this.paintMeter();
  }

}

new ControllerApp(document.querySelector('#app'));
