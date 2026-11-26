import { CONFIG } from '../config.js';

export class HealthSystem {
  constructor() {
    this.reset();
  }

  reset() {
    this.lives = CONFIG.lives;
    this.invulnerable = 0;
    this.shield = 0;
  }

  update(dt) {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.shield = Math.max(0, this.shield - dt);
  }

  /** Returns 'ignored' | 'shield' | 'hurt' | 'dead'. */
  hit() {
    if (this.lives <= 0 || this.invulnerable > 0) return 'ignored';
    if (this.shield > 0) {
      this.shield = 0;
      this.invulnerable = 0.6;
      return 'shield';
    }
    this.lives -= 1;
    this.invulnerable = CONFIG.invulnerableTime;
    return this.lives <= 0 ? 'dead' : 'hurt';
  }

  heal() {
    this.lives = Math.min(CONFIG.maxLives, this.lives + 1);
  }

  addShield() {
    this.shield = CONFIG.shieldTime;
  }
}
