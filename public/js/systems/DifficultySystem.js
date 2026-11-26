export const WAVE_LENGTH = 30;
export const BOSS_EVERY = 5;

export function waveParams(wave) {
  const w = Math.max(0, wave - 1);
  const types = ['fighter'];
  if (wave >= 2) types.push('heavy');
  if (wave >= 4) types.push('elite');
  return {
    meteorInterval: Math.max(0.5, 1.7 - w * 0.12),
    clusterChance: Math.min(0.4, 0.08 + w * 0.04),
    meteorSpeed: 20 + Math.min(14, w * 1.4),
    enemyInterval: Math.max(1.8, 6.5 - w * 0.45),
    maxEnemies: Math.min(8, 2 + Math.floor(w * 0.7)),
    enemySpeed: 1 + Math.min(0.8, w * 0.07),
    fireRate: 1 + Math.min(1.1, w * 0.09),
    types,
  };
}

/** Wave clock. Waves advance every WAVE_LENGTH seconds; every BOSS_EVERY-th wave freezes the clock until the boss dies. */
export class DifficultySystem {
  constructor() {
    this.reset();
  }

  reset() {
    this.clock = 0;
    this.wave = 1;
    this.bossActive = false;
    this.params = waveParams(1);
  }

  update(dt) {
    if (this.bossActive) return null;
    this.clock += dt;
    if (this.clock < WAVE_LENGTH) return null;
    this.clock -= WAVE_LENGTH;
    this.wave += 1;
    this.params = waveParams(this.wave);
    if (this.wave % BOSS_EVERY === 0) {
      this.bossActive = true;
      return 'boss';
    }
    return 'wave';
  }

  bossDefeated() {
    this.bossActive = false;
  }
}
