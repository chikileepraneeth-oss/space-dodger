import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Pool } from '../core/Pool.js';

export const ENEMY_TYPES = {
  fighter: { hp: 1, radius: 0.95, speed: 24, fireInterval: 1.7, color: 0xff3d6e },
  heavy: { hp: 6, radius: 1.5, speed: 13, holdZ: -40, stay: 8, fireInterval: 2.3, color: 0xff9a2e },
  elite: { hp: 4, radius: 1.1, speed: 20, holdZ: -32, stay: 7, fireInterval: 1.3, color: 0xc04bff },
  boss: { hp: 80, radius: 3.6, speed: 9, holdZ: -44, stay: Infinity, fireInterval: 1.25, color: 0xff2a55 },
};

const hull = new THREE.MeshStandardMaterial({ color: 0x2b1d35, flatShading: true, metalness: 0.5, roughness: 0.42 });
const plate = new THREE.MeshStandardMaterial({ color: 0x4a3550, flatShading: true, metalness: 0.35, roughness: 0.5 });
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const accents = {};
for (const [type, spec] of Object.entries(ENEMY_TYPES)) {
  accents[type] = new THREE.MeshStandardMaterial({
    color: spec.color,
    emissive: spec.color,
    emissiveIntensity: 1.2,
    flatShading: true,
  });
}

const geoCache = new Map();
/** Geometry is built once per shape key and shared by every enemy of that type. */
function geo(key, build) {
  if (!geoCache.has(key)) geoCache.set(key, build());
  return geoCache.get(key);
}

function wingGeometry(points, depth = 0.07) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  return g;
}

function part(group, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

function mirroredWing(group, key, points, material, y = 0) {
  const g = geo(key, () => wingGeometry(points));
  part(group, g, material, 0, y, 0);
  part(group, g, material, 0, y, 0).scale.x = -1;
}

// Every model faces +z, toward the player.
const MODELS = {
  fighter(group, accent) {
    part(group, geo('f-body', () => new THREE.ConeGeometry(0.42, 1.9, 4).rotateX(Math.PI / 2)), hull);
    mirroredWing(group, 'f-wing', [[0.15, 0.3], [1.25, -0.55], [1.05, -0.85], [0.2, -0.55]], plate);
    part(group, geo('f-eye', () => new THREE.IcosahedronGeometry(0.16, 0)), accent, 0, 0.18, 0.35);
    part(group, geo('f-tail', () => new THREE.BoxGeometry(0.5, 0.12, 0.18)), accent, 0, 0, -0.95);
  },
  heavy(group, accent) {
    part(group, geo('h-body', () => new THREE.BoxGeometry(1.7, 0.6, 2.2)), hull);
    part(group, geo('h-top', () => new THREE.BoxGeometry(0.8, 0.4, 1.1)), plate, 0, 0.45, -0.2);
    const pod = geo('h-pod', () => new THREE.CylinderGeometry(0.36, 0.42, 2.5, 6).rotateX(Math.PI / 2));
    part(group, pod, plate, -1.25, 0, 0);
    part(group, pod, plate, 1.25, 0, 0);
    const stripe = geo('h-stripe', () => new THREE.BoxGeometry(0.12, 0.64, 2.26));
    part(group, stripe, accent, -0.55, 0, 0);
    part(group, stripe, accent, 0.55, 0, 0);
    const gun = geo('h-gun', () => new THREE.CylinderGeometry(0.1, 0.1, 0.9, 5).rotateX(Math.PI / 2));
    [-1.25, 0, 1.25].forEach((x) => part(group, gun, accent, x, 0, 1.4));
  },
  elite(group, accent) {
    part(group, geo('e-core', () => new THREE.OctahedronGeometry(0.62, 0)), accent).scale.set(1, 0.7, 1.4);
    mirroredWing(group, 'e-blade', [[0.3, 0.4], [1.8, 1.1], [1.2, 0.1], [1.9, -0.9], [0.3, -0.4]], hull);
    part(group, geo('e-ring', () => new THREE.TorusGeometry(0.8, 0.06, 5, 16).rotateX(Math.PI / 2)), plate);
  },
  boss(group, accent) {
    part(group, geo('b-core', () => new THREE.DodecahedronGeometry(2.1, 0)), hull).scale.set(1.5, 0.6, 1.1);
    mirroredWing(group, 'b-wing', [[1.5, 1.6], [5.2, 2.4], [5.6, 0.2], [4.4, -1.8], [1.6, -1.2]], plate);
    part(group, geo('b-eye', () => new THREE.IcosahedronGeometry(0.7, 0)), accent, 0, 0.3, 2.1);
    const spine = geo('b-spine', () => new THREE.BoxGeometry(0.18, 0.2, 3.4));
    [-3.6, -2.2, 2.2, 3.6].forEach((x) => part(group, spine, accent, x, 0.1, 0.4));
    const gun = geo('b-gun', () => new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6).rotateX(Math.PI / 2));
    [-4.4, -1.4, 1.4, 4.4].forEach((x) => part(group, gun, hull, x, -0.15, 2));
    const ring = part(group, geo('b-ring', () => new THREE.TorusGeometry(3.4, 0.12, 6, 28).rotateX(Math.PI / 2)), accent);
    ring.name = 'spin';
  },
};

class Enemy {
  constructor(type) {
    this.type = type;
    this.spec = ENEMY_TYPES[type];
    this.radius = this.spec.radius;
    this.object = new THREE.Group();
    MODELS[type](this.object, accents[type]);
    this.meshes = [];
    this.object.traverse((child) => {
      if (child.isMesh) this.meshes.push(child);
    });
    this.materials = this.meshes.map((m) => m.material);
    this.spinner = this.object.getObjectByName('spin');
    this.active = false;
  }

  reset(x, z, params, hpScale = 1) {
    this.maxHp = Math.round(this.spec.hp * hpScale);
    this.hp = this.maxHp;
    this.baseX = x;
    this.prevZ = z;
    this.object.position.set(x, 0, z);
    this.object.rotation.set(0, 0, 0);
    this.t = Math.random() * 10;
    this.phase = 'enter';
    this.stayLeft = this.spec.stay;
    this.speedMul = params.enemySpeed;
    this.fireMul = params.fireRate;
    this.fireTimer = this.spec.fireInterval * (0.4 + Math.random() * 0.6);
    this.burst = 0;
    this.volley = 0;
    this.flashLeft = 0;
    this.setFlash(false);
  }

  setFlash(on) {
    this.meshes.forEach((m, i) => {
      m.material = on ? flashMat : this.materials[i];
    });
  }

  flash() {
    this.flashLeft = 0.07;
    this.setFlash(true);
  }

  /** Moves and fires. Returns true once the enemy has left the field. */
  update(dt, ctx) {
    const pos = this.object.position;
    this.prevZ = pos.z;
    this.t += dt;
    if (this.flashLeft > 0) {
      this.flashLeft -= dt;
      if (this.flashLeft <= 0) this.setFlash(false);
    }
    if (this.spinner) this.spinner.rotation.y += dt * 0.8;

    const speed = this.spec.speed * this.speedMul;
    const limit = CONFIG.playfieldX;
    const lastX = pos.x;
    if (this.type === 'fighter') {
      pos.z += speed * dt;
      pos.x = THREE.MathUtils.clamp(this.baseX + Math.sin(this.t * 2.2) * 1.6, -limit, limit);
    } else if (this.phase === 'enter') {
      pos.z = Math.min(this.spec.holdZ, pos.z + speed * dt);
      if (pos.z >= this.spec.holdZ) this.phase = 'hold';
    } else if (this.phase === 'hold') {
      if (this.type === 'heavy') pos.x = this.baseX + Math.sin(this.t * 0.6) * 3;
      if (this.type === 'elite') {
        const target = ctx.playerX + Math.sin(this.t * 2.4) * 3.5;
        pos.x += (target - pos.x) * (1 - Math.exp(-1.6 * dt));
      }
      if (this.type === 'boss') pos.x = Math.sin(this.t * 0.42) * 5.5;
      pos.x = THREE.MathUtils.clamp(pos.x, -limit, limit);
      this.stayLeft -= dt;
      if (this.stayLeft <= 0) this.phase = 'exit';
    } else {
      pos.x += Math.sign(pos.x || 1) * 12 * dt;
      pos.z -= 4 * dt;
      if (Math.abs(pos.x) > 18) return true;
    }
    this.object.rotation.z = THREE.MathUtils.clamp((lastX - pos.x) / Math.max(dt, 1e-3) * 0.05, -0.6, 0.6);

    if (this.phase !== 'exit' && pos.z > -95 && pos.z < -18) this.fireLogic(dt, ctx);
    return pos.z > CONFIG.despawnZ;
  }

  fireLogic(dt, ctx) {
    const pos = this.object.position;
    this.fireTimer -= dt * this.fireMul;
    if (this.fireTimer > 0) return;
    const enraged = this.type === 'boss' && this.hp < this.maxHp * 0.4;
    this.fireTimer = this.spec.fireInterval * (enraged ? 0.7 : 1);

    if (this.type === 'fighter') {
      ctx.fireAt(pos.x, pos.z, 0);
    } else if (this.type === 'heavy') {
      [-0.22, 0, 0.22].forEach((a) => ctx.fireAt(pos.x, pos.z + 1.2, a));
    } else if (this.type === 'elite') {
      ctx.fireAt(pos.x, pos.z, 0);
      if (this.burst === 0) {
        this.burst = 1;
        this.fireTimer = 0.18;
      } else {
        this.burst = 0;
      }
    } else {
      this.volley += 1;
      if (this.volley % 3 === 0) {
        // Fan with ~5.5 units between bolts at the player's row: always a lane to slip through.
        for (let i = -4; i <= 4; i += 1) ctx.fireAt(pos.x, pos.z + 2, i * 0.13, true);
      } else {
        [-4.4, 4.4].forEach((dx) => ctx.fireAt(pos.x + dx, pos.z + 2, 0));
        if (enraged) ctx.fireAt(pos.x, pos.z + 2, 0);
      }
    }
  }
}

export class EnemyPool extends Pool {
  constructor(scene) {
    super(scene, (type) => new Enemy(type));
  }

  spawn(type, x, z, params, hpScale) {
    const enemy = this.acquire(type);
    enemy.reset(x, z, params, hpScale);
    return enemy;
  }

  update(dt, ctx) {
    for (const enemy of this.items) {
      if (enemy.active && enemy.update(dt, ctx)) this.release(enemy);
    }
  }
}
