import { CONFIG } from '../config.js';

// Center-to-center clearance a cluster leaves open: medium meteor radius + ship radius + margin.
export const CLUSTER_GAP_HALF = 3.2;

/** x positions for a meteor row that never covers the lane around gapCenter. */
export function clusterXs(count, limit, gapCenter, gapHalf = CLUSTER_GAP_HALF, rand = Math.random) {
  const xs = [];
  for (let tries = 0; xs.length < count && tries < 60; tries += 1) {
    const x = (rand() * 2 - 1) * limit;
    if (Math.abs(x - gapCenter) < gapHalf) continue;
    if (xs.some((o) => Math.abs(o - x) < 1.8)) continue;
    xs.push(x);
  }
  return xs;
}

const ENEMY_WEIGHTS = { fighter: 3, heavy: 2, elite: 1.5 };

function weightedPick(types) {
  const total = types.reduce((sum, t) => sum + ENEMY_WEIGHTS[t], 0);
  let roll = Math.random() * total;
  for (const t of types) {
    roll -= ENEMY_WEIGHTS[t];
    if (roll <= 0) return t;
  }
  return types[0];
}

export class SpawnSystem {
  constructor() {
    this.reset();
  }

  reset() {
    this.meteorTimer = 1.2;
    this.enemyTimer = 3.5;
    this.powerTimer = 14;
    this.clusterLock = 0;
    this.sinceSingle = 10;
    this.bosses = 0;
  }

  update(dt, world) {
    const { params, bossActive } = world.difficulty;
    const limit = CONFIG.playfieldX;
    this.meteorTimer -= dt;
    this.clusterLock -= dt;
    this.sinceSingle += dt;

    if (this.meteorTimer <= 0) {
      this.meteorTimer = params.meteorInterval * (0.7 + Math.random() * 0.6) * (bossActive ? 1.8 : 1);
      // A row only spawns when no recent single could drift into its gap, and singles wait for the row to pass.
      if (!bossActive && this.clusterLock <= 0 && this.sinceSingle > 1.2 && Math.random() < params.clusterChance) {
        this.clusterLock = 2.6;
        const gap = (Math.random() * 2 - 1) * (limit - 3);
        for (const x of clusterXs(3 + Math.floor(Math.random() * 3), limit, gap)) {
          world.meteors.spawn(Math.random() < 0.5 ? 'small' : 'medium', x, CONFIG.spawnZ - Math.random() * 3, params.meteorSpeed);
        }
      } else if (this.clusterLock <= 0) {
        this.sinceSingle = 0;
        const roll = Math.random();
        const size = roll < 0.2 ? 'large' : roll < 0.55 ? 'medium' : 'small';
        const nearPlayer = Math.random() < 0.4;
        const px = world.player.object.position.x;
        const x = nearPlayer ? px + (Math.random() - 0.5) * 4 : (Math.random() * 2 - 1) * limit;
        world.meteors.spawn(
          size,
          Math.max(-limit, Math.min(limit, x)),
          CONFIG.spawnZ,
          params.meteorSpeed * (0.8 + Math.random() * 0.4),
          (Math.random() - 0.5) * 1.5,
        );
      }
    }

    if (!bossActive) {
      this.enemyTimer -= dt;
      if (this.enemyTimer <= 0) {
        this.enemyTimer = params.enemyInterval * (0.75 + Math.random() * 0.5);
        if (world.enemies.count() < params.maxEnemies) {
          const type = weightedPick(params.types);
          const x = (Math.random() * 2 - 1) * 7;
          world.enemies.spawn(type, x, CONFIG.spawnZ + 10, params);
          if (type === 'fighter' && world.difficulty.wave >= 3 && Math.random() < 0.4) {
            // V formation: the wingmen sit 3 units out, so the gap between them stays open.
            world.enemies.spawn('fighter', Math.max(-limit, x - 3), CONFIG.spawnZ + 6, params);
            world.enemies.spawn('fighter', Math.min(limit, x + 3), CONFIG.spawnZ + 6, params);
          }
        }
      }
    }

    this.powerTimer -= dt;
    if (this.powerTimer <= 0) {
      this.powerTimer = 16 + Math.random() * 8;
      world.dropPowerUp((Math.random() * 2 - 1) * 6, CONFIG.spawnZ + 20);
    }
  }

  spawnBoss(world) {
    this.bosses += 1;
    world.enemies.spawn('boss', 0, CONFIG.spawnZ, world.difficulty.params, 1 + (this.bosses - 1) * 0.5);
  }
}
