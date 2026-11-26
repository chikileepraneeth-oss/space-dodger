import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Pool } from '../core/Pool.js';

const glow = (color, opacity) => new THREE.MeshBasicMaterial({
  color,
  transparent: true,
  opacity,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const KINDS = {
  laser: {
    core: [new THREE.BoxGeometry(0.08, 0.08, 1.7), new THREE.MeshBasicMaterial({ color: 0xc8fdff })],
    halo: [new THREE.BoxGeometry(0.26, 0.26, 2.1), glow(0x37e7ff, 0.45)],
    radius: 0.2,
  },
  bolt: {
    core: [new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0xffd0f4 })],
    halo: [new THREE.IcosahedronGeometry(0.42, 0), glow(0xff3fc8, 0.55)],
    radius: 0.3,
  },
};

class Projectile {
  constructor(kind) {
    const spec = KINDS[kind];
    this.object = new THREE.Mesh(...spec.core);
    this.object.add(new THREE.Mesh(...spec.halo));
    this.radius = spec.radius;
    this.kind = kind;
    this.vx = 0;
    this.vz = 0;
    this.damage = 1;
    this.prevZ = 0;
    this.active = false;
  }
}

export class ProjectilePool extends Pool {
  constructor(scene, kind) {
    super(scene, () => new Projectile(kind));
  }

  fire(x, z, vx, vz, damage = 1) {
    const p = this.acquire();
    p.object.position.set(x, 0, z);
    p.object.rotation.set(0, Math.atan2(vx, vz), 0);
    p.prevZ = z;
    p.vx = vx;
    p.vz = vz;
    p.damage = damage;
    return p;
  }

  update(dt) {
    for (const p of this.items) {
      if (!p.active) continue;
      const pos = p.object.position;
      p.prevZ = pos.z;
      pos.x += p.vx * dt;
      pos.z += p.vz * dt;
      if (p.kind === 'bolt') p.object.rotation.x += dt * 9;
      if (pos.z < CONFIG.spawnZ - 10 || pos.z > CONFIG.despawnZ || Math.abs(pos.x) > 22) this.release(p);
    }
  }
}
