import { bindActions, overlay } from './dom.js';

export class PauseMenu {
  constructor(root, { onResume, onRestart, onMenu }) {
    const { el, $ } = overlay(root, 'screen pause', `
      <div class="card small-card">
        <h2>Paused</h2>
        <p class="small" data-note></p>
        <div class="actions">
          <button type="button" class="primary" data-act="resume">Resume</button>
          <button type="button" data-act="restart">Restart</button>
          <button type="button" data-act="menu">Main menu</button>
        </div>
      </div>
    `);
    this.el = el;
    this.$ = $;
    bindActions(el, { resume: onResume, restart: onRestart, menu: onMenu });
  }

  toggle(on, note = 'Press Pause on the phone to resume.') {
    this.el.hidden = !on;
    this.$('note').textContent = note;
  }
}
