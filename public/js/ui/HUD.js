import { bindActions, formatTime, overlay } from './dom.js';

export class HUD {
  constructor(root, { onPause }) {
    const { el, $ } = overlay(root, 'hud', `
      <div class="hud-tl">
        <div class="label">Score</div>
        <div class="big" data-score>0</div>
        <div class="small">Best <span data-best>0</span></div>
      </div>
      <div class="hud-tc">
        <div class="wave">Wave <span data-wave>1</span></div>
        <div class="boss" data-boss hidden><span>Boss</span><div class="bar"><i data-bossbar></i></div></div>
      </div>
      <div class="hud-tr">
        <div class="lives" data-lives aria-label="Lives"></div>
        <button type="button" class="hud-pause" data-act="pause">Pause</button>
      </div>
      <div class="hud-bl">
        <div class="label">Nova</div>
        <div class="charges" data-charges></div>
        <div class="buffs" data-buffs></div>
      </div>
      <div class="hud-br">
        <div>Enemies <b data-enemies>0</b></div>
        <div>Time <b data-time>0:00</b></div>
        <div class="link-state" data-link>Controller connected</div>
      </div>
      <div class="banner" data-banner hidden></div>
      <div class="toast" data-toast hidden></div>
      <div class="vignette" data-vignette></div>
    `);
    this.el = el;
    this.$ = $;
    this.last = {};
    bindActions(el, { pause: onPause });
  }

  toggle(on) {
    this.el.hidden = !on;
  }

  /** Writes a field only when its text changes, so the DOM is not touched every frame. */
  set(name, value, html = false) {
    if (this.last[name] === value) return;
    this.last[name] = value;
    this.$(name)[html ? 'innerHTML' : 'textContent'] = value;
  }

  update(s) {
    this.set('score', s.score.toLocaleString());
    this.set('best', s.best.toLocaleString());
    this.set('wave', String(s.wave));
    this.set('enemies', String(s.enemies));
    this.set('time', formatTime(s.time));
    this.set('lives', '<i class="life"></i>'.repeat(Math.max(0, s.lives)) + (s.shield > 0 ? '<i class="shield-icon"></i>' : ''), true);
    this.set('charges', '<i class="charge"></i>'.repeat(s.charges) || '<em>empty</em>', true);
    const buffs = [];
    if (s.rapid > 0) buffs.push(`Rapid ${Math.ceil(s.rapid)}`);
    if (s.double > 0) buffs.push(`Double ${Math.ceil(s.double)}`);
    if (s.shield > 0) buffs.push(`Shield ${Math.ceil(s.shield)}`);
    this.set('buffs', buffs.join(' · '));
    this.$('boss').hidden = s.boss === null;
    if (s.boss !== null) this.$('bossbar').style.width = `${Math.max(0, s.boss) * 100}%`;
  }

  setConnected(connected, debug) {
    const text = connected ? 'Controller connected' : debug ? 'Keyboard debug' : 'Controller lost';
    this.set('link', text);
    this.$('link').classList.toggle('down', !connected);
  }

  banner(text) {
    const el = this.$('banner');
    el.textContent = text;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  toast(text) {
    const el = this.$('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.hidden = true; }, 1400);
  }

  hurt() {
    const el = this.$('vignette');
    el.classList.remove('hit');
    void el.offsetWidth;
    el.classList.add('hit');
  }
}
