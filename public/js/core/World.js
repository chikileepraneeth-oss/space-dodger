import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ENEMY_TYPES, EnemyPool } from '../entities/Enemy.js';
import { Effects } from '../entities/Explosion.js';
import { MeteorPool } from '../entities/Meteor.js';
import { POWERUP_TYPES, PowerUpPool } from '../entities/PowerUp.js';
import { ProjectilePool } from '../entities/Projectile.js';
import { CollisionSystem, within } from '../systems/CollisionSystem.js';
import { DifficultySystem } from '../systems/DifficultySystem.js';
import { HealthSystem } from '../systems/HealthSystem.js';
import { POINTS, ScoreSystem } from '../systems/ScoreSystem.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';

const ROCK_COLORS = [0xffa860, 0xb08060, 0xffe2b0];

/** The gameplay simulation: entities, spawning, combat. Game.js owns menus and networking. */
export class World {
  constructor(scene, { player, camera, audio, emit }) {
    this.player = player;
    this.camera = camera;
    this.audio = audio;
    this.emit = emit;
    this.meteors = new MeteorPool(scene);
    this.enemies = new EnemyPool(scene);
    this.bolts = new ProjectilePool(scene, 'bolt');
    this.powerUps = new PowerUpPool(scene);
    this.weapons = new WeaponSystem(scene);
    this.lasers = this.weapons.lasers;
    this.torpedo = this.weapons.torpedo;
    this.effects = new Effects(scene);
    this.collisions = new CollisionSystem();
    this.spawner = new SpawnSystem();
    this.difficulty = new DifficultySystem();
    this.health = new HealthSystem();
    this.score = new ScoreSystem();
    this.tmp = new THREE.Vector3();
    this.enemyCtx = { playerX: 0, fireAt: (x, z, angle, straight) => this.fireBolt(x, z, angle, straight) };
    this.elapsed = 0;
  }

  reset() {
    [this.meteors, this.enemies, this.bolts, this.powerUps].forEach((pool) => pool.clear());
    this.weapons.reset();
    this.effects.clear();
    this.spawner.reset();
    this.difficulty.reset();
    this.health.reset();
    this.score.reset();
    this.player.object.position.x = 0;
    this.player.object.visible = true;
    this.player.setShield(false);
    this.dead = false;
  }

  update(dt, input) {
    this.elapsed += dt;
    this.effects.update(dt);
    if (this.dead) return;

    this.health.update(dt);
    this.score.update(dt);
    const event = this.difficulty.update(dt);
    if (event === 'wave') this.emit('banner', `Wave ${this.difficulty.wave}`);
    if (event === 'boss') {
      this.spawner.spawnBoss(this);
      this.audio.alarm();
      this.emit('banner', 'Warning: boss incoming');
    }
    this.spawner.update(dt, this);

    const px = this.player.object.position.x;
    this.enemyCtx.playerX = px;
    const { fired, detonate } = this.weapons.update(dt, input.fire, px);
    if (fired) this.audio.play('laser');
    if (detonate) this.detonate();

    this.meteors.update(dt);
    this.enemies.update(dt, this.enemyCtx);
    this.bolts.update(dt);
    this.powerUps.update(dt);
    this.collisions.run(this);

    // Engine trail and damage blink.
    const p = this.player.object;
    for (const side of [-0.32, 0.32]) {
      this.effects.emit(p.position.x + side, -0.02, 1.25, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, 6 + Math.random() * 3, 0.22, 0x37e7ff);
    }
    p.visible = this.health.invulnerable > 0 ? Math.floor(this.elapsed * 18) % 2 === 0 : true;
    this.player.setShield(this.health.shield > 0);
  }

  fireBolt(x, z, angle = 0, straight = false) {
    let dx = 0;
    let dz = 1;
    if (!straight) {
      dx = this.enemyCtx.playerX - x;
      dz = -z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
    }
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const speed = 19 * Math.sqrt(this.difficulty.params.fireRate);
    this.bolts.fire(x, z, (dx * cos + dz * sin) * speed, (-dx * sin + dz * cos) * speed);
    this.audio.play('enemyShot');
  }

  special() {
    if (this.dead) return;
    this.audio.play(this.weapons.special(this.player.object.position.x) ? 'launch' : 'empty');
  }

  damageMeteor(meteor, damage) {
    meteor.hp -= damage;
    this.effects.burst(meteor.object.position, 0xffc890, 6, 6, 0.3);
    if (meteor.hp <= 0) this.destroyMeteor(meteor, true);
    else this.audio.play('hit');
  }

  destroyMeteor(meteor, byPlayer, split = true) {
    // Copy before release: spawning the split pieces can reuse this same pooled object.
    const { x, z } = meteor.object.position;
    const { size, speed, radius } = meteor;
    this.meteors.release(meteor);
    ROCK_COLORS.forEach((c) => this.effects.burst(meteor.object.position, c, Math.round(radius * 10), 7 + radius * 3, 0.8));
    this.audio.play('rock');
    this.camera.shake(0.12 * radius);
    if (!byPlayer) return;
    this.score.add(POINTS.meteor[size]);
    if (size === 'large' && split) {
      for (const vx of [-4, 4]) this.meteors.spawn('small', x, z, speed, vx);
    }
    if (size === 'large' && Math.random() < 0.12) this.dropPowerUp(x, z);
  }

  damageEnemy(enemy, damage) {
    enemy.hp -= damage;
    enemy.flash();
    this.effects.burst(enemy.object.position, 0xffffff, 5, 6, 0.25);
    if (enemy.hp <= 0) this.destroyEnemy(enemy, true);
    else this.audio.play('hit');
  }

  destroyEnemy(enemy, byPlayer) {
    const pos = enemy.object.position;
    const color = ENEMY_TYPES[enemy.type].color;
    const big = enemy.type === 'boss';
    this.enemies.release(enemy);
    this.effects.burst(pos, color, big ? 260 : 60, big ? 22 : 11, big ? 1.6 : 0.9);
    this.effects.burst(pos, 0xffffff, big ? 80 : 20, big ? 14 : 7, 0.5);
    this.effects.ring(pos, color, big ? 16 : 5, big ? 1 : 0.45);
    this.audio.play('explode');
    this.camera.shake(big ? 1 : 0.3);
    if (big) {
      this.difficulty.bossDefeated();
      this.emit('banner', 'Boss destroyed');
    }
    if (!byPlayer) return;
    this.score.kill(POINTS.enemy[enemy.type]);
    if (big) {
      ['health', 'special', 'double'].forEach((t, i) => this.spawnPowerUp(t, pos.x + (i - 1) * 3, pos.z));
    } else if (Math.random() < 0.18) {
      this.dropPowerUp(pos.x, pos.z);
    }
  }

  hurtPlayer() {
    const result = this.health.hit();
    if (result === 'ignored') return;
    const pos = this.player.object.position;
    if (result === 'shield') {
      this.effects.ring(pos, 0x37e7ff, 4, 0.4);
      this.audio.play('shield');
      return;
    }
    this.audio.play('damage');
    this.camera.shake(0.7);
    this.effects.burst(pos, 0xff7a3c, 40, 9, 0.6);
    this.emit('hurt');
    if (result === 'dead') {
      this.dead = true;
      this.player.object.visible = false;
      this.player.setShield(false);
      this.effects.burst(pos, 0x37e7ff, 220, 16, 1.5);
      this.effects.burst(pos, 0xffffff, 80, 10, 1);
      this.effects.ring(pos, 0x37e7ff, 10, 0.9);
      this.audio.play('explode');
      this.camera.shake(1.2);
      this.emit('dead');
    }
  }

  dropPowerUp(x, z) {
    const types = Object.keys(POWERUP_TYPES).filter((t) => t !== 'health' || this.health.lives < CONFIG.maxLives);
    if (this.health.lives === 1 && Math.random() < 0.4) types.push('health', 'health');
    this.spawnPowerUp(types[Math.floor(Math.random() * types.length)], x, z);
  }

  spawnPowerUp(type, x, z) {
    this.powerUps.spawn(type, Math.max(-CONFIG.playfieldX, Math.min(CONFIG.playfieldX, x)), z);
  }

  collect(powerUp) {
    const { type } = powerUp;
    this.powerUps.release(powerUp);
    if (type === 'shield') this.health.addShield();
    if (type === 'rapid') this.weapons.rapid = CONFIG.powerUpTime;
    if (type === 'double') this.weapons.double = CONFIG.powerUpTime;
    if (type === 'health') this.health.heal();
    if (type === 'special') this.weapons.addCharge();
    this.score.add(POINTS.powerUp);
    this.effects.ring(this.player.object.position, POWERUP_TYPES[type].color, 3.5, 0.4);
    this.effects.burst(this.player.object.position, POWERUP_TYPES[type].color, 30, 6, 0.5);
    this.audio.powerUp();
    this.emit('toast', POWERUP_TYPES[type].label);
  }

  /** Nova blast: clears enemy fire everywhere, wrecks everything within the radius. */
  detonate() {
    const center = this.tmp.copy(this.torpedo.object.position);
    this.weapons.endTorpedo();
    const r = CONFIG.specialRadius;
    this.effects.ring(center, 0xff8a2a, r, 0.8);
    this.effects.ring(center, 0xfff1d6, r * 0.6, 0.6);
    this.effects.burst(center, 0xff8a2a, 200, 20, 1.2);
    this.effects.burst(center, 0xffffff, 60, 12, 0.7);
    this.audio.play('nova');
    this.camera.shake(0.9);
    this.bolts.forEachActive((bolt) => {
      this.effects.burst(bolt.object.position, 0xff3fc8, 4, 4, 0.3);
      this.bolts.release(bolt);
    });
    for (const meteor of this.meteors.items) {
      if (meteor.active && within(meteor, center.x, center.z, r)) this.destroyMeteor(meteor, true, false);
    }
    for (const enemy of this.enemies.items) {
      if (enemy.active && within(enemy, center.x, center.z, r)) this.damageEnemy(enemy, enemy.type === 'boss' ? 14 : 8);
    }
  }

  snapshot() {
    const boss = this.enemies.find((e) => e.type === 'boss');
    return {
      score: this.score.score,
      best: Math.max(this.score.best, this.score.score),
      kills: this.score.kills,
      time: this.score.time,
      lives: this.health.lives,
      shield: this.health.shield,
      wave: this.difficulty.wave,
      enemies: this.enemies.count(),
      charges: this.weapons.charges,
      rapid: this.weapons.rapid,
      double: this.weapons.double,
      boss: boss ? boss.hp / boss.maxHp : null,
    };
  }
}
