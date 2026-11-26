import * as THREE from 'three';
import { CONFIG } from '../config.js';

function mesh(geometry, material) {
  return new THREE.Mesh(geometry, material);
}

export class Player {
  constructor() {
    this.object = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({
      color: 0x1c2b4d,
      flatShading: true,
      metalness: 0.48,
      roughness: 0.36,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.MeshStandardMaterial({
      color: 0x314874,
      flatShading: true,
      metalness: 0.3,
      roughness: 0.46,
    });
    const hot = new THREE.MeshStandardMaterial({
      color: 0xff7a3c,
      emissive: 0xff5a1f,
      emissiveIntensity: 0.55,
      flatShading: true,
    });
    this.glowMat = new THREE.MeshStandardMaterial({
      color: 0xbffbff,
      emissive: 0x37e7ff,
      emissiveIntensity: 1.5,
      flatShading: true,
    });

    const nose = mesh(new THREE.ConeGeometry(0.32, 1.65, 6), hull);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -1.2;
    const body = mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.25, 6), hull);
    body.rotation.x = Math.PI / 2;
    const canopy = mesh(new THREE.SphereGeometry(0.2, 6, 5), panel);
    canopy.scale.set(0.8, 0.62, 1.35);
    canopy.position.set(0, 0.28, -0.2);
    this.object.add(nose, body, canopy);

    const wing = new THREE.Shape();
    wing.moveTo(0.12, 0.22);
    wing.lineTo(1.9, 0.62);
    wing.lineTo(1.45, -0.42);
    wing.lineTo(0.18, -0.08);
    wing.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.06, bevelEnabled: false, steps: 1 });
    const leftWing = mesh(wingGeo, hull);
    leftWing.rotation.x = Math.PI / 2;
    leftWing.position.z = 0.2;
    const rightWing = mesh(wingGeo, hull);
    rightWing.rotation.x = Math.PI / 2;
    rightWing.scale.x = -1;
    rightWing.position.z = 0.2;
    this.object.add(leftWing, rightWing);

    const tip = new THREE.BoxGeometry(0.32, 0.045, 0.2);
    const leftTip = mesh(tip, hot);
    leftTip.position.set(-1.72, 0.02, 0.42);
    const rightTip = mesh(tip, hot);
    rightTip.position.set(1.72, 0.02, 0.42);
    this.object.add(leftTip, rightTip);

    this.flames = [];
    this.lights = [];
    [-0.32, 0.32].forEach((x) => {
      const nacelle = mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.5, 6), panel);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(x, -0.02, 0.68);
      const flame = mesh(new THREE.ConeGeometry(0.1, 0.48, 5), this.glowMat);
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(x, -0.02, 1.12);
      const light = new THREE.PointLight(0x37e7ff, 1.3, 5, 2);
      light.position.set(x, 0, 1.25);
      this.object.add(nacelle, flame, light);
      this.flames.push(flame);
      this.lights.push(light);
    });

    this.ring = mesh(new THREE.TorusGeometry(0.85, 0.04, 6, 18), this.glowMat.clone());
    this.ring.material.transparent = true;
    this.ring.visible = false;
    this.ringLife = 0;
    this.object.add(this.ring);
    this.baseGlow = this.glowMat.emissiveIntensity;

    this.radius = CONFIG.playerRadius;
    this.shield = mesh(new THREE.IcosahedronGeometry(1.5, 1), new THREE.MeshBasicMaterial({
      color: 0x37e7ff,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this.shield.scale.set(1.35, 0.6, 1.25);
    this.shield.visible = false;
    this.object.add(this.shield);
  }

  setShield(on) {
    this.shield.visible = on;
    if (on) this.shield.rotation.y += 0.02;
  }

  pulseSpecial() {
    this.ring.visible = true;
    this.ring.scale.setScalar(0.35);
    this.ring.material.opacity = 1;
    this.ringLife = 0.48;
  }

  update(dt, input) {
    const steer = input.paused ? this.object.position.x / CONFIG.maxHorizontalRange : input.effectiveX();
    const target = (input.paused ? this.object.position.x : steer * CONFIG.maxHorizontalRange);
    const blend = 1 - Math.exp(-CONFIG.movementSmoothing * dt);
    if (!input.paused) {
      this.object.position.x = THREE.MathUtils.lerp(this.object.position.x, target, blend);
      this.object.rotation.z = THREE.MathUtils.lerp(this.object.rotation.z, -steer * CONFIG.bankAngle, blend);
      this.object.rotation.y = THREE.MathUtils.lerp(this.object.rotation.y, steer * 0.16, blend);
    }
    const pulse = 1 + Math.sin(performance.now() / 90) * 0.14;
    const boost = input.fire && !input.paused ? 1.75 : 1;
    this.glowMat.emissiveIntensity = this.baseGlow * boost;
    this.flames.forEach((flame) => flame.scale.set(1, pulse * boost, 1));
    this.lights.forEach((light) => {
      light.intensity = 1.1 * boost;
    });
    if (this.ringLife > 0) {
      this.ringLife -= dt;
      const progress = 1 - this.ringLife / 0.48;
      this.ring.scale.setScalar(0.35 + progress * 3.4);
      this.ring.material.opacity = Math.max(0, 1 - progress);
      this.ring.visible = this.ringLife > 0;
    }
  }
}
