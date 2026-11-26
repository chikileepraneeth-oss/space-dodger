import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class CameraManager {
  constructor(camera, player) {
    this.camera = camera;
    this.player = player;
    this.trauma = 0;
    this.camera.position.set(0, CONFIG.cameraOffset.y, CONFIG.cameraOffset.z);
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt) {
    const shipX = this.player.object.position.x;
    const blend = 1 - Math.exp(-CONFIG.cameraFollow * dt);
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, shipX * 0.72, blend);
    this.camera.position.y = CONFIG.cameraOffset.y;
    this.camera.position.z = CONFIG.cameraOffset.z;
    this.camera.lookAt(shipX * 0.28, 0.4, CONFIG.lookAhead);
    // Squared trauma keeps small hits subtle and big blasts punchy.
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.rotation.z += (Math.random() - 0.5) * s * 0.08;
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
    }
  }
}
