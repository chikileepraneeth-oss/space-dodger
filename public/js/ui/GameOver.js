import { bindActions, formatTime, overlay } from './dom.js';

export class GameOver {
  constructor(root, { onRetry, onMenu, onReconnect }) {
    const { el, $ } = overlay(root, 'screen over', `
      <div class="card">
        <p class="eyebrow">Ship destroyed</p>
        <h2>Game over</h2>
        <p class="new-best" data-newbest hidden>New best score!</p>
        <dl class="stats">
          <div><dt>Score</dt><dd data-score></dd></div>
          <div><dt>Best</dt><dd data-best></dd></div>
          <div><dt>Survived</dt><dd data-time></dd></div>
          <div><dt>Enemies destroyed</dt><dd data-kills></dd></div>
          <div><dt>Wave reached</dt><dd data-wave></dd></div>
        </dl>
        <div class="actions">
          <button type="button" class="primary" data-act="retry">Retry</button>
          <button type="button" data-act="menu">Main menu</button>
          <button type="button" data-act="reconnect">Reconnect controller</button>
        </div>
        <p class="small">Or press Fire on the phone to retry.</p>
      </div>
    `);
    this.el = el;
    this.$ = $;
    bindActions(el, { retry: onRetry, menu: onMenu, reconnect: onReconnect });
  }

  toggle(on) {
    this.el.hidden = !on;
  }

  fill(s, isBest) {
    this.$('score').textContent = s.score.toLocaleString();
    this.$('best').textContent = s.best.toLocaleString();
    this.$('time').textContent = formatTime(s.time);
    this.$('kills').textContent = String(s.kills);
    this.$('wave').textContent = String(s.wave);
    this.$('newbest').hidden = !isBest;
  }
}
