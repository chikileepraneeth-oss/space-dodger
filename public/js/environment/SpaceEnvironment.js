import * as THREE from 'three';
import { AsteroidField } from './AsteroidField.js';

function nebulaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.3)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#120818');
  gradient.addColorStop(0.42, '#241246');
  gradient.addColorStop(0.68, '#12304a');
  gradient.addColorStop(1, '#070b12');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 256);
  context.fillStyle = 'rgba(120, 60, 190, 0.35)';
  context.beginPath();
  context.ellipse(16, 100, 14, 36, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(30, 110, 160, 0.28)';
  context.beginPath();
  context.ellipse(8, 168, 12, 28, 0, 0, Math.PI * 2);
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class SpaceEnvironment {
  constructor(scene) {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(180, 28, 18),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    scene.add(sky);

    this.planets = [
      this.planet(scene, 7, 0x6a4a9a, -28, 10, -70),
      this.planet(scene, 4.2, 0xc46a3a, 24, -6, -58),
    ];
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(9, 12.5, 40),
      new THREE.MeshBasicMaterial({ color: 0xb79cff, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
    );
    ring.rotation.set(1.2, 0.3, 0);
    this.planets[0].add(ring);

    const glow = nebulaTexture();
    [[-40, 18, -150, 90, 0x7a3cff], [45, 4, -160, 110, 0x1ea0ff], [5, 30, -170, 80, 0xff4fa0]].forEach(([x, y, z, size, color]) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glow,
        color,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }));
      sprite.position.set(x, y, z);
      sprite.scale.setScalar(size);
      scene.add(sprite);
    });
    this.asteroids = new AsteroidField(scene);
  }

  planet(scene, radius, color, x, y, z) {
    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 1),
      new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.05 }),
    );
    body.position.set(x, y, z);
    scene.add(body);
    return body;
  }

  update(dt, paused) {
    this.asteroids.update(dt, paused);
    if (paused) return;
    this.planets[0].rotation.y += dt * 0.05;
    this.planets[1].rotation.y -= dt * 0.08;
  }
}
