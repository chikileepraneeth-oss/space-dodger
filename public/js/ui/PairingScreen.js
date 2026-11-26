import { bindActions, overlay } from './dom.js';

export class PairingScreen {
  constructor(root, { onStart, onBack }) {
    const { el, $ } = overlay(root, 'screen pairing', `
      <div class="pairing-card">
        <p class="eyebrow">Wireless controller</p>
        <h1>SPACE DODGER</h1>
        <div data-waiting>
          <p class="lead">Scan with the iPhone camera. The phone is the steering wheel.</p>
          <div class="qr-wrap">
            <div class="qr-pulse"></div>
            <img class="qr" data-qr alt="Controller pairing QR code" />
          </div>
          <p class="url" data-url></p>
          <ol>
            <li>On the iPhone, open the setup link and trust the certificate.</li>
            <li>Scan this code, tap Start Controller, then hold the phone level and calibrate.</li>
            <li>Tilt left and right. The ship does not fly forward or back from the phone.</li>
          </ol>
          <p class="warn" data-warn hidden></p>
        </div>
        <div class="connected-badge" data-connected hidden>
          <span class="dot"></span> Controller connected
        </div>
        <p class="status" data-status>Creating session…</p>
        <div class="actions row">
          <button type="button" class="primary" data-act="start" data-start hidden>Start game</button>
          <button type="button" data-act="back" data-back>Back</button>
        </div>
      </div>
    `);
    this.el = el;
    this.$ = $;
    bindActions(el, { start: onStart, back: onBack });
  }

  showSession(message) {
    this.$('qr').src = message.qr;
    this.$('url').textContent = message.controllerUrl;
    this.$('warn').hidden = message.reachable;
    this.$('warn').textContent = message.reachable
      ? ''
      : `This QR code is not reachable from an iPhone. Set HOST_IP or PUBLIC_URL, then restart. Setup: ${message.setupUrl}`;
  }

  /** mode: 'waiting' | 'connected' | 'lost' (controller dropped mid-game). */
  setMode(mode) {
    const connected = mode === 'connected';
    this.$('waiting').hidden = connected;
    this.$('connected').hidden = !connected;
    this.$('start').hidden = !connected;
    this.$('back').hidden = mode === 'lost';
    this.setStatus(connected
      ? 'Hold Fire on the phone, or click Start game.'
      : mode === 'lost'
        ? 'Controller disconnected. Game paused. Reopen the controller page or scan again to reconnect.'
        : 'Waiting for the iPhone…');
  }

  setStatus(text) {
    this.$('status').textContent = text;
  }

  toggle(on) {
    this.el.hidden = !on;
  }
}
