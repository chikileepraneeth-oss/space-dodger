import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Pool } from '../core/Pool.js';

export const METEOR_SIZES = {
  small: { radius: 0.8, hp: 1 },
  medium: { radius: 1.3, hp: 3 },
  large: { radius: 2, hp: 6 },
};

/** Low-poly rock: push each icosahedron corner in or out. Shared corners get the same push so the mesh stays closed. */
export function rockGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const push = new Map();
  for (let i = 0; i < pos.count; i += 1) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!push.has(key)) push.set(key, 0.72 + Math.random() * 0.48);
    const k = push.get(key);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

const GEOMETRIES = Array.from({ length: 6 }, rockGeometry);
const MATERIALS = [0x6e5b50, 0x4f5868, 0x7a4a3a].map((color) => new THREE.MeshStandardMaterial({
  color,
  flatShading: true,
  roughness: 0.92,
  metalness: 0.08,
}));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

class Meteor {
  constructor() {
    this.object = new THREE.Mesh(pick(GEOMETRIES), pick(MATERIALS));
    this.spin = new THREE.Vector3();
    this.active = false;
  }

  reset(size, x, z, speed, vx) {
    const spec = METEOR_SIZES[size];
    this.size = size;
    this.radius = spec.radius;
    this.hp = spec.hp;
    this.speed = speed;
    this.vx = vx;
    this.prevZ = z;
    this.object.position.set(x, 0, z);
    this.object.scale.setScalar(spec.radius * 1.05);
    this.object.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    this.spin.set((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.2);
  }
}

export class MeteorPool extends Pool {
  constructor(scene) {
    super(scene, () => new Meteor());
  }

  spawn(size, x, z, speed, vx = 0) {
    const meteor = this.acquire();
    meteor.reset(size, x, z, speed, vx);
    return meteor;
  }

  update(dt) {
    for (const m of this.items) {
      if (!m.active) continue;
      const pos = m.object.position;
      m.prevZ = pos.z;
      pos.z += m.speed * dt;
      pos.x += m.vx * dt;
      m.object.rotation.x += m.spin.x * dt;
      m.object.rotation.y += m.spin.y * dt;
      m.object.rotation.z += m.spin.z * dt;
      if (pos.z > CONFIG.despawnZ || Math.abs(pos.x) > 24) this.release(m);
    }
  }
}
