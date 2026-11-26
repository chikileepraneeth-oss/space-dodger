export class InputSystem {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.keyY = 0;
    this.fire = false;
    this.paused = false;
    this.connected = false;
    this.debug = new URLSearchParams(location.search).has('debug');
    this.keyX = 0;
    this.specialQueued = false;
    if (!this.debug) return;
    window.addEventListener('keydown', (event) => {
      if (this.connected) return;
      if (event.key === 'ArrowLeft' || event.key === 'a') this.keyX = -1;
      if (event.key === 'ArrowRight' || event.key === 'd') this.keyX = 1;
      if (event.key === 'ArrowUp' || event.key === 'w') this.keyY = 1;
      if (event.key === 'ArrowDown' || event.key === 's') this.keyY = -1;
      if (event.key === ' ') this.fire = true;
      if (event.key === 'e' && !event.repeat) this.specialQueued = true;
    });
    window.addEventListener('keyup', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'ArrowRight' || event.key === 'd') {
        this.keyX = 0;
      }
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'ArrowDown' || event.key === 's') this.keyY = 0;
      if (event.key === ' ') this.fire = false;
    });
  }

  setMove(x, y = 0) {
    const clamp = (v) => (Number.isFinite(Number(v)) ? Math.max(-1, Math.min(1, Number(v))) : 0);
    this.x = clamp(x);
    this.y = clamp(y);
  }

  effectiveY() {
    if (this.connected) return this.y;
    return this.debug ? this.keyY : 0;
  }

  takeSpecial() {
    const queued = this.specialQueued;
    this.specialQueued = false;
    return queued;
  }

  effectiveX() {
    if (this.connected) return this.x;
    return this.debug ? this.keyX : 0;
  }
}
