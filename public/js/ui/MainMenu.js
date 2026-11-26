import { bindActions, overlay } from './dom.js';

export class MainMenu {
  constructor(root, { audio, quality, onPlay, onConnect, onQuality }) {
    const { el, $ } = overlay(root, 'screen menu', `
      <div class="card">
        <p class="eyebrow">Tilt-steered space shooter</p>
        <h1 class="title">SPACE DODGER</h1>
        <p class="menu-link" data-link>Controller not connected</p>
        <div class="actions">
          <button type="button" class="primary" data-act="play">Play</button>
          <button type="button" data-act="connect">Connect controller</button>
          <button type="button" data-act="howto">How to play</button>
          <button type="button" data-act="settings">Settings</button>
        </div>
        <div class="panel" data-panel="howto" hidden>
          <ul>
            <li>Tilt the iPhone left or right to steer. Hold it level to stay centered.</li>
            <li>Hold <b>Fire</b> for continuous lasers. <b>Special</b> launches a Nova torpedo that clears the area.</li>
            <li>Dodge meteors and enemy fire. You have 3 lives; a hit gives a short moment of safety.</li>
            <li>Grab crystals: cyan shield, yellow rapid fire, green double laser, pink repair, orange Nova charge.</li>
            <li>Every 30 seconds the wave rises. Every 5th wave a boss arrives.</li>
            <li>Press <b>Fire</b> on the phone to start or retry, and <b>Pause</b> to pause.</li>
          </ul>
        </div>
        <div class="panel" data-panel="settings" hidden>
          <label>Volume <input type="range" min="0" max="1" step="0.05" data-volume /></label>
          <label><input type="checkbox" data-muted /> Mute all</label>
          <label><input type="checkbox" data-music /> Music</label>
          <label>Graphics
            <select data-quality>
              <option value="high">High</option>
              <option value="low">Low (faster)</option>
            </select>
          </label>
        </div>
        <p class="small">Best score <span data-best>0</span></p>
      </div>
    `);
    this.el = el;
    this.$ = $;
    const toggle = (name) => {
      for (const panel of el.querySelectorAll('[data-panel]')) {
        panel.hidden = panel.dataset.panel !== name || !panel.hidden;
      }
    };
    bindActions(el, { play: onPlay, connect: onConnect, howto: () => toggle('howto'), settings: () => toggle('settings') });

    const s = audio.settings;
    $('volume').value = String(s.volume);
    $('muted').checked = s.muted;
    $('music').checked = s.music;
    $('quality').value = quality;
    $('volume').addEventListener('input', (e) => audio.setVolume(Number(e.target.value)));
    $('muted').addEventListener('change', (e) => audio.setMuted(e.target.checked));
    $('music').addEventListener('change', (e) => audio.setMusic(e.target.checked));
    $('quality').addEventListener('change', (e) => onQuality(e.target.value));
  }

  toggle(on) {
    this.el.hidden = !on;
  }

  update({ connected, debug, best }) {
    this.$('link').textContent = connected
      ? 'Controller connected. Press Fire on the phone or click Play.'
      : debug ? 'Debug mode: keyboard A/D, Space, E. Click Play.' : 'Controller not connected';
    this.$('link').classList.toggle('ok', connected);
    this.$('best').textContent = best.toLocaleString();
  }
}
