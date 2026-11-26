import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ProjectilePool } from '../entities/Projectile.js';

const TORPEDO_RANGE_Z = -48;

function torpedoMesh() {
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
  core.add(new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.95, 1),
    new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
  ));
  core.visible = false;
  return core;
}

export class WeaponSystem {
  constructor(scene) {
    this.lasers = new ProjectilePool(scene, 'laser');
    this.torpedo = { object: torpedoMesh(), radius: 0.8, active: false, prevZ: 0 };
    scene.add(this.torpedo.object);
    this.reset();
  }

  reset() {
    this.cooldown = 0;
    this.specialCooldown = 0;
    this.charges = CONFIG.specialCharges;
    this.rapid = 0;
    this.double = 0;
    this.lasers.clear();
    this.torpedo.active = false;
    this.torpedo.object.visible = false;
  }

  /** Returns { fired, detonate } so the world can play sounds and trigger the blast. */
  update(dt, firing, playerX, playerZ = 0) {
    this.rapid = Math.max(0, this.rapid - dt);
    this.double = Math.max(0, this.double - dt);
    this.cooldown -= dt;
    this.specialCooldown -= dt;

    let fired = false;
    if (firing && this.cooldown <= 0) {
      this.cooldown = this.rapid > 0 ? CONFIG.rapidFireInterval : CONFIG.fireInterval;
      const offsets = this.double > 0 ? [-0.55, 0.55] : [0];
      for (const o of offsets) this.lasers.fire(playerX + o, playerZ - 1.9, 0, -CONFIG.laserSpeed);
      fired = true;
    }
    this.lasers.update(dt);

    let detonate = false;
    const t = this.torpedo;
    if (t.active) {
      t.prevZ = t.object.position.z;
      t.object.position.z -= 46 * dt;
      t.object.rotation.y += dt * 6;
      if (t.object.position.z <= TORPEDO_RANGE_Z) detonate = true;
    }
    return { fired, detonate };
  }

  special(playerX, playerZ = 0) {
    if (this.charges <= 0 || this.specialCooldown > 0 || this.torpedo.active) return false;
    this.charges -= 1;
    this.specialCooldown = CONFIG.specialCooldown;
    this.torpedo.active = true;
    this.torpedo.object.visible = true;
    this.torpedo.object.position.set(playerX, 0, playerZ - 2);
    this.torpedo.prevZ = playerZ - 2;
    return true;
  }

  endTorpedo() {
    this.torpedo.active = false;
    this.torpedo.object.visible = false;
  }

  addCharge() {
    this.charges = Math.min(CONFIG.maxSpecialCharges, this.charges + 1);
  }
}
