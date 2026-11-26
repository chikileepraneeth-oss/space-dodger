import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Pool } from '../core/Pool.js';

export const POWERUP_TYPES = {
  shield: { color: 0x37e7ff, label: 'Shield' },
  rapid: { color: 0xffd23f, label: 'Rapid fire' },
  double: { color: 0x6dff8a, label: 'Double laser' },
  health: { color: 0xff5c8a, label: 'Repair' },
  special: { color: 0xff8a2a, label: 'Nova charge' },
};

const crystalGeo = new THREE.OctahedronGeometry(0.55, 0);
const ringGeo = new THREE.TorusGeometry(0.85, 0.05, 5, 20);
const materials = {};
for (const [type, spec] of Object.entries(POWERUP_TYPES)) {
  materials[type] = {
    crystal: new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 0.9, flatShading: true }),
    ring: new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
}

class PowerUp {
  constructor() {
    this.object = new THREE.Group();
    this.crystal = new THREE.Mesh(crystalGeo, materials.shield.crystal);
    this.ring = new THREE.Mesh(ringGeo, materials.shield.ring);
    this.object.add(this.crystal, this.ring);
    this.radius = 0.95;
    this.active = false;
  }

  reset(type, x, z) {
    this.type = type;
    this.crystal.material = materials[type].crystal;
    this.ring.material = materials[type].ring;
    this.prevZ = z;
    this.object.position.set(x, 0, z);
  }
}

export class PowerUpPool extends Pool {
  constructor(scene) {
    super(scene, () => new PowerUp());
  }

  spawn(type, x, z) {
    const p = this.acquire();
    p.reset(type, x, z);
    return p;
  }

  update(dt) {
    for (const p of this.items) {
      if (!p.active) continue;
      const pos = p.object.position;
      p.prevZ = pos.z;
      pos.z += 15 * dt;
      p.crystal.rotation.y += dt * 2.5;
      p.ring.rotation.x += dt * 1.7;
      p.ring.rotation.y += dt * 1.1;
      pos.y = Math.sin(pos.z * 0.4) * 0.15;
      if (pos.z > CONFIG.despawnZ) this.release(p);
    }
  }
}
