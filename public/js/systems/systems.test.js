import assert from 'node:assert/strict';
import test from 'node:test';
import { hits } from './CollisionSystem.js';
import { BOSS_EVERY, DifficultySystem, WAVE_LENGTH } from './DifficultySystem.js';
import { HealthSystem } from './HealthSystem.js';
import { ScoreSystem } from './ScoreSystem.js';
import { CLUSTER_GAP_HALF, clusterXs } from './SpawnSystem.js';

const body = (x, z, radius, prevZ) => ({ object: { position: { x, z } }, radius, prevZ });

test('meteor rows always leave a lane open', () => {
  for (let i = 0; i < 500; i += 1) {
    const gap = (Math.random() * 2 - 1) * 6;
    for (const x of clusterXs(5, 9, gap)) assert.ok(Math.abs(x - gap) >= CLUSTER_GAP_HALF);
  }
});

test('fast lasers cannot tunnel through a meteor in one frame', () => {
  // Laser moved from z=-8 to z=-12 this frame; the meteor sits at z=-10.
  assert.equal(hits(body(0, -12, 0.2, -8), body(0, -10, 0.8, -10)), true);
  assert.equal(hits(body(3, -12, 0.2, -8), body(0, -10, 0.8, -10)), false);
  assert.equal(hits(body(0, -30, 0.2, -26), body(0, -10, 0.8, -10)), false);
});

test('waves advance and the boss wave freezes the clock', () => {
  const d = new DifficultySystem();
  let events = [];
  for (let t = 0; t < WAVE_LENGTH * BOSS_EVERY; t += 0.5) events.push(d.update(0.5));
  events = events.filter(Boolean);
  assert.deepEqual(events, ['wave', 'wave', 'wave', 'boss']);
  assert.equal(d.update(WAVE_LENGTH * 3), null);
  assert.equal(d.wave, BOSS_EVERY);
  d.bossDefeated();
  assert.equal(d.update(WAVE_LENGTH), 'wave');
  assert.ok(d.params.types.includes('elite'));
});

test('shield absorbs a hit and invulnerability blocks repeats', () => {
  const h = new HealthSystem();
  assert.equal(h.hit(), 'hurt');
  assert.equal(h.hit(), 'ignored');
  h.update(5);
  h.addShield();
  assert.equal(h.hit(), 'shield');
  assert.equal(h.lives, 2);
  h.update(5);
  assert.equal(h.hit(), 'hurt');
  h.update(5);
  assert.equal(h.hit(), 'dead');
});

test('best score persists only when beaten', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const s = new ScoreSystem(storage);
  s.add(500);
  assert.equal(s.finish(), true);
  const next = new ScoreSystem(storage);
  assert.equal(next.best, 500);
  next.add(100);
  assert.equal(next.finish(), false);
});
